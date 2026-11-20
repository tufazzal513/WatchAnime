// HTTP API (Node built-in http, no frameworks).
//   GET    /api/db/<path>[?orderBy=c&limitToLast=12]
//   PUT    /api/db/<path>      body = JSON value      (set)
//   PATCH  /api/db/<path>      body = { "a/b": v }    (update, multi-path; path may be empty)
//   DELETE /api/db/<path>                              (remove)
//   GET    /api/admin/backup   (admin)  download a fresh gzip backup
//   POST   /api/admin/backup   (admin)  run the backup job now (local + Google Drive)
//   GET    /api/health
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { openStore, clean } from './store.js';
import { isLocked, releaseMs, publicMovies, publicMoviePath, publicBanners } from './visibility.js';
import { canRead, checkWrite } from './rules.js';
import { createVerifier } from './auth.js';
import { createBackupManager } from './backup.js';
import { createTelegram } from './telegram.js';
import { createPuller } from './sync.js';
import { createActivity } from './activity.js';
import { mergeFirebaseTree } from './importer.js';
import { HttpError, bad, deny } from './util.js';

const SEG_BAD = /[.$#\[\]\/\u0000-\u001f]/;
const PUBLIC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const STATIC_TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

function serveFrontend(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  let root, relative;
  if (pathname === '/admin' || pathname === '/admin/' || pathname.startsWith('/admin/')) {
    root = path.join(PUBLIC_ROOT, 'admin');
    relative = pathname.replace(/^\/admin\/?/, '');
    if (!relative || relative === 'login' || relative === 'dashboard') relative = 'index.html';
  } else if (pathname.startsWith('/assets/')) {
    root = path.join(PUBLIC_ROOT, 'assets');
    relative = pathname.slice('/assets/'.length);
  } else return false;

  let decoded;
  try { decoded = decodeURIComponent(relative); } catch { res.writeHead(400); res.end('Bad request'); return true; }
  if (decoded.includes('\0') || decoded.split(/[\\/]/).some(part => part === '..')) { res.writeHead(400); res.end('Bad request'); return true; }
  let file = path.resolve(root, decoded || 'index.html');
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { res.writeHead(403); res.end('Forbidden'); return true; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    // The Admin UI is a single-page interface. Unknown /admin routes load its entry point.
    if (root.endsWith(path.sep + 'admin')) file = path.join(root, 'index.html');
    else { res.writeHead(404, { 'X-Content-Type-Options': 'nosniff' }); res.end('Not found'); return true; }
  }
  const ext = path.extname(file).toLowerCase();
  const headers = {
    'Content-Type': STATIC_TYPES[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
  };
  res.writeHead(200, headers);
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(file).on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); }).pipe(res);
  return true;
}
const validSeg = (s) => s && s.length <= 400 && !SEG_BAD.test(s);

function limiter(max, windowMs) {
  const m = new Map();
  setInterval(() => { const n = Date.now(); for (const [k, v] of m) if (v.reset < n) m.delete(k); }, windowMs).unref();
  return (key) => {
    const n = Date.now();
    let e = m.get(key);
    if (!e || e.reset < n) { e = { c: 0, reset: n + windowMs }; m.set(key, e); }
    return ++e.c <= max;
  };
}

export function createApp(cfg) {
  const store = openStore(cfg.dbPath);
  const verifier = cfg.verifier || createVerifier({ projectId: cfg.projectId, devInsecure: cfg.devInsecureAuth });
  const role = cfg.role === 'worker' ? 'worker' : 'main';
  const isWorker = role === 'worker';
  const rawLog = cfg.log || console;
  const act = cfg.activity || createActivity({ level: cfg.logLevel || 'normal', log: rawLog, role });
  const log = act.logger;   // every log line gets time + role
  // All server settings come from environment variables only (see .env.example). There is no admin-panel editor for them.
  const allowedOrigins = String(cfg.allowedOrigins || '*').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);
  const tg = cfg.tg || createTelegram({ token: cfg.tgToken, chatId: cfg.tgChatId, apiId: cfg.tgApiId, apiHash: cfg.tgApiHash, session: cfg.tgSession, keep: Number(cfg.tgKeep || 30), dir: cfg.backupDir, log });
  const driveNow = () => ({ clientId: cfg.drive && cfg.drive.clientId, clientSecret: cfg.drive && cfg.drive.clientSecret, refreshToken: cfg.drive && cfg.drive.refreshToken, folderId: cfg.drive && cfg.drive.folderId });
  const backups = createBackupManager({ store, dir: cfg.backupDir, keepLocal: () => Number(cfg.backupKeepLocal || 7), drive: driveNow, driveKeepDays: () => Number(cfg.driveKeepDays || 30), tg, log });
  const puller = isWorker ? createPuller({ store, mainUrl: cfg.mainUrl, key: cfg.workerKey, publicUrl: cfg.publicUrl, intervalMs: (cfg.syncEverySec || 5) * 1000, log, act }) : null;
  const bootId = crypto.randomBytes(4).toString('hex');
  const ipLimit = limiter(cfg.ipPerMinute || 900, 60e3);
  const uidLimit = limiter(cfg.uidPerMinute || 300, 60e3);
  const anonWriteLimit = limiter(cfg.anonWritesPerMinute || 20, 60e3);
  const cache = new Map();                 // url -> { etag, raw, gz }
  const lastPersist = new Map();           // uid -> last time last_seen was saved to disk

  const corsHeaders = (req) => {
    const origins = allowedOrigins.length ? allowedOrigins : ['*'];
    const o = req.headers.origin;
    const allow = origins.includes('*') ? '*' : (o && origins.includes(o) ? o : origins[0]);
    return {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-None-Match, X-Worker-Key',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Expose-Headers': 'ETag',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin, Authorization, Accept-Encoding',
      'X-Content-Type-Options': 'nosniff',
    };
  };

  const clientIp = (req) => {
    if (!isWorker && req.headers['x-worker-key'] && req.headers['x-mx-client-ip'] && store.workerByKey(String(req.headers['x-worker-key']))) return String(req.headers['x-mx-client-ip']).slice(0, 64);
    if (cfg.trustProxy) return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
    return req.socket.remoteAddress;
  };

  function readBody(req, limit = 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'body_too_large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => {
        if (!chunks.length) return resolve(undefined);
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'invalid_json')); }
      });
      req.on('error', reject);
    });
  }

  async function authenticate(req) {
    const h = req.headers.authorization;
    if (!h) return null;
    const m = /^Bearer (.+)$/.exec(h);
    if (!m) throw new HttpError(401, 'invalid_token');
    try { return await verifier.verify(m[1]); }
    catch { throw new HttpError(401, 'invalid_token'); }
  }

  const parseSegs = (pathname, prefix) => {
    const rest = pathname.slice(prefix.length).replace(/^\/+|\/+$/g, '');
    if (!rest) return [];
    const segs = rest.split('/').map(s => { try { return decodeURIComponent(s); } catch { return bad('bad_path'); } });
    if (!segs.every(validSeg)) bad('bad_path');
    return segs;
  };

  function send(req, res, status, body, extra = {}) {
    const buf = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req), ...extra });
    res.end(buf);
  }

  // Non-admin movie reads depend on the clock too (an upcoming title unlocks by itself at its release time), so the ETag carries
  // the number of titles that are still locked, and the gate is recomputed when the next release time passes.
  let gateCache = null;
  function moviesGate(ver) {
    const now = Date.now();
    if (gateCache && gateCache.ver === ver && now < gateCache.until) return gateCache;
    const all = store.readRaw(['movies']) || {};
    let locked = 0, until = Infinity;
    for (const m of Object.values(all)) {
      if (!isLocked(m, now)) continue;
      locked++;
      const ms = releaseMs(m);
      if (ms > now && ms < until) until = ms;
    }
    gateCache = { ver, locked, until };
    return gateCache;
  }

  function handleGet(req, res, segs, url, auth, admin) {
    if (!segs.length) deny();
    if (!canRead(segs, auth, admin)) deny();
    const orderBy = url.searchParams.get('orderBy');
    const limit = url.searchParams.get('limitToLast');
    if (orderBy && !/^[A-Za-z0-9_]{1,40}$/.test(orderBy)) bad('bad_query');
    if (limit && !/^\d{1,4}$/.test(limit)) bad('bad_query');

    // ?lite=1 on the movie list: cards only. Episode lists and stream links are left out and fetched per title when it is opened.
    const lite = url.searchParams.get('lite') === '1' && segs.length === 1 && segs[0] === 'movies';
    // Normal users get a filtered view of movies (no private titles, no stream links of unreleased titles) and of banners (none that point to a private title).
    const hideMovies = segs[0] === 'movies' && !admin;
    const hideBanners = segs[0] === 'banners' && segs.length === 1 && !admin;
    const gate = hideMovies ? moviesGate(store.version(['movies'])) : null;
    const viewTag = (admin && (segs[0] === 'movies' || segs[0] === 'banners') ? 'a' : '') + (gate ? '-l' + gate.locked : '') + (hideBanners ? '-m' + store.version(['movies']) : '');
    const key = segs.join('/') + '?' + (orderBy || '') + '&' + (limit || '') + (lite ? '&lite' : '') + '&' + viewTag;
    const etag = `W/"${segs[0] === 'online_users' ? bootId + '-' : ''}${store.version(segs)}${viewTag}"`;   // same data => same ETag on main and every worker
    const noStore = { 'Cache-Control': 'private, no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ...corsHeaders(req), ...noStore }); return res.end(); }

    let entry = cache.get(key);
    if (!entry || entry.etag !== etag) {
      let data = store.query(segs, { orderBy, limitToLast: limit ? Number(limit) : 0 });
      if (hideMovies) {
        const now = Date.now();
        if (segs.length === 1) data = publicMovies(data, now);
        else {   // movies/<id>[/...]: filter the whole title first, then walk into it
          const movie = segs.length === 2 ? data : store.query(['movies', segs[1]]);
          const hit = publicMoviePath(movie, segs.slice(2), now);
          data = hit === undefined ? null : hit;
        }
      } else if (hideBanners) {
        data = publicBanners(data, store.readRaw(['movies']));
      }
      if (lite && data && typeof data === 'object') {
        const out = {};
        for (const [id, m] of Object.entries(data)) {
          if (!m || typeof m !== 'object') { out[id] = m; continue; }
          const c = {};
          for (const [k, v] of Object.entries(m)) if (k !== 'seasons' && !/^(server\d*|link|q\d{3,4})$/.test(k)) c[k] = v;
          out[id] = c;
        }
        data = out;
      }
      const raw = JSON.stringify(data);
      entry = { etag, raw: Buffer.from(raw), gz: null };
      if (cache.size > 800) cache.clear();
      cache.set(key, entry);
    }
    const wantsGz = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && entry.raw.length > 1024;
    if (wantsGz) { entry.gz = entry.gz || zlib.gzipSync(entry.raw); }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(req), ...noStore, ...(wantsGz ? { 'Content-Encoding': 'gzip' } : {}) });
    res.end(wantsGz ? entry.gz : entry.raw);
  }

  function buildWrites(method, segs, body) {
    if (method === 'PATCH') {
      if (!body || typeof body !== 'object' || Array.isArray(body)) bad('invalid_body');
      const w = [];
      for (const [k, v] of Object.entries(body)) {
        const sub = k.split('/').filter(Boolean);
        if (!sub.length || !sub.every(validSeg)) bad('invalid_key');
        w.push({ segs: [...segs, ...sub], value: v });
      }
      if (w.length > 500) bad('too_many_writes');
      return w;
    }
    if (!segs.length) bad('bad_path');
    return [{ segs, value: method === 'DELETE' ? null : body }];
  }

  function handleWrite(req, res, method, segs, body, auth, admin, ip) {
    const writes = buildWrites(method, segs, body);
    if (!auth && !writes.every(w => w.segs[0] === 'pwd_resets')) deny();
    if (!auth && !anonWriteLimit(ip)) throw new HttpError(429, 'rate_limited');
    const ctx = { auth, isAdmin: admin, store };
    store.transaction(() => {
      for (const w of writes) {
        const v = clean(w.value);
        checkWrite(w.segs, v, ctx);
        store.writeAt(w.segs, v);
      }
    });
    {   // activity log: presence heartbeats are only counted, everything else gets one line (paths only, never values)
      const real = writes.filter(w => w.segs[0] !== 'online_users');
      act.count('writes', writes.length);
      if (real.length) {
        const paths = [...new Set(real.map(w => w.segs.join('/')))];
        act.event('WRITE', { uid: auth && auth.uid, ip }, `${method}${admin ? ' (admin)' : ''} ${paths.slice(0, 3).join(', ')}${paths.length > 3 ? ' +' + (paths.length - 3) + ' more' : ''}`);
      } else act.count('presence', writes.length);
    }
    // presence heartbeat -> remember "last seen" on disk, but at most every 10 minutes per user
    for (const w of writes) {
      if (w.segs[0] === 'online_users' && w.segs[1] && auth && auth.uid === w.segs[1]) {
        const last = lastPersist.get(w.segs[1]) || 0;
        if (Date.now() - last > 10 * 60e3) { lastPersist.set(w.segs[1], Date.now()); store.touchLastSeen(w.segs[1]); }
        break;
      }
    }
    send(req, res, 200, 'null');
  }

  function readRawBody(req, limit = 2 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      let size = 0; const chunks = [];
      req.on('data', (c) => { size += c.length; if (size > limit) { reject(new HttpError(413, 'body_too_large')); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined));
      req.on('error', reject);
    });
  }

  // WORKER: forward to the main server (writes, admin calls, live presence), then catch up so the caller sees their own change.
  async function proxy(req, res, url, ip, who = { ip }) {
    const body = (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') ? undefined : await readRawBody(req);
    const h = { 'X-Worker-Key': cfg.workerKey, 'X-MX-Client-IP': ip };
    if (req.headers.authorization) h.Authorization = req.headers.authorization;
    if (req.headers['content-type']) h['Content-Type'] = req.headers['content-type'];
    let r;
    try { r = await fetch(cfg.mainUrl.replace(/\/+$/, '') + url.pathname + url.search, { method: req.method, headers: h, body }); }
    catch { throw new HttpError(502, 'main_unreachable'); }
    const buf = Buffer.from(await r.arrayBuffer());
    act.count('proxied');
    if (!r.ok) { try { res.mxErr = JSON.parse(buf.toString('utf8')).error; } catch { /* not json */ } }
    if (req.method !== 'GET' && !/^\/api\/db\/online_users/.test(url.pathname)) act.event('PROXY', who, `${req.method} ${url.pathname} -> main ${r.status}`);
    if (r.ok && req.method !== 'GET') await Promise.race([puller.syncNow(), new Promise(ok => setTimeout(ok, 1500))]);
    const out = { ...corsHeaders(req), 'Content-Type': r.headers.get('content-type') || 'application/json' };
    for (const k of ['content-disposition', 'etag', 'cache-control']) if (r.headers.get(k)) out[k] = r.headers.get(k);
    res.writeHead(r.status, out); res.end(buf);
  }

  const ONLINE_MS = 75e3;
  // MAIN -> workers: "something changed, pull now". Changes within 200 ms are merged into one ping.
  if (!isWorker) {
    let t = null;
    const ping = () => {
      let targets = [];
      try { targets = store.workerTargets(); } catch { return; }   // store already closed (shutdown)
      for (const w of targets) {
        fetch(w.url.replace(/\/+$/, '') + '/api/notify', { method: 'POST', headers: { 'X-Notify': w.key_hash }, signal: AbortSignal.timeout(3000) }).catch(() => {});
      }
    };
    store.setOnChange(() => { if (!t) { t = setTimeout(() => { t = null; ping(); }, 200); t.unref?.(); } });
  }
  // MAIN: tell the console when a worker goes online / offline
  let wTimer = null;
  if (!isWorker) {
    const wState = new Map();
    const checkWorkers = () => {
      try {
        const seen = new Set();
        for (const w of store.listWorkers()) {
          seen.add(w.id);
          const on = Date.now() - w.last_seen < ONLINE_MS * 2;
          const prev = wState.get(w.id);
          if (prev !== undefined && prev !== on) act.event('WORKER', {}, `"${w.name}" is now ${on ? 'ONLINE' : 'OFFLINE'}${w.url ? ' (' + w.url + ')' : ''}`);
          wState.set(w.id, on);
        }
        for (const id of [...wState.keys()]) if (!seen.has(id)) wState.delete(id);
      } catch { /* store closed */ }
    };
    checkWorkers();
    wTimer = setInterval(checkWorkers, 20e3); wTimer.unref?.();
    act.setGauges(() => { try { const ws = store.listWorkers(); return `seq=${store.seq()} workers=${ws.filter(w => Date.now() - w.last_seen < ONLINE_MS * 2).length}/${ws.length} online`; } catch { return ''; } });
  } else act.setGauges(() => { const st = puller.status(); return `seq=${st.seq} sync=${st.lastError ? 'ERROR' : st.ready ? 'ok' : 'warming'}`; });
  act.start();

  // Text for the worker's .env file (shown in Admin -> Settings -> Server). Built here so every needed variable is included.
  function buildWorkerEnv(req, w, hint = {}) {
    const okUrl = (u) => (/^https?:\/\/[^\s]+$/.test(String(u || '')) ? String(u).replace(/\/+$/, '') : '');
    const proto = (cfg.trustProxy && String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()) || (req.socket.encrypted ? 'https' : 'http');
    const guess = req.headers.host ? `${proto}://${req.headers.host}` : '';
    const main = okUrl(hint.main) || okUrl(guess) || 'https://YOUR-MAIN-SERVER';
    const origins = (!allowedOrigins.length || allowedOrigins.includes('*')) ? (okUrl(hint.origin) || '*') : allowedOrigins.join(',');
    const name = String(w.name || '').replace(/[^\w .-]/g, '').slice(0, 60);
    return [
      `# MoveX WORKER server: ${name}  (paste into the host's environment variables or into .env)`,
      'ROLE=worker',
      `MAIN_URL=${main}`,
      `WORKER_KEY=${w.key}`,
      `PUBLIC_URL=${okUrl(w.url) || 'https://YOUR-WORKER-ADDRESS'}`,
      `ADMIN_UID=${cfg.adminUid || 'your_firebase_auth_uid'}`,
      `FIREBASE_PROJECT_ID=${cfg.projectId || 'movex-513'}`,
      `ALLOWED_ORIGINS=${origins}`,
      'TRUST_PROXY=1',
      'PORT=3000',
      'DB_PATH=./data/database.db',
      'SYNC_EVERY_SEC=60',
      'LOG_LEVEL=normal',
    ].join('\n');
  }

  function handleSync(req, res, url) {   // main only: workers pull changes here
    const w = store.workerByKey(String(req.headers['x-worker-key'] || ''));
    if (!w) throw new HttpError(401, 'invalid_worker_key');
    act.count('syncPulls');
    const since = Number(url.searchParams.get('since') || 0);
    const limit = Math.min(2000, Math.max(10, Number(url.searchParams.get('limit') || 1000)));
    const wurl = String(req.headers['x-worker-url'] || '').slice(0, 200);
    store.touchWorker(w.id, /^https?:\/\//.test(wurl) ? wurl : null, since);
    const body = Buffer.from(JSON.stringify(store.changesSince(since, limit)));
    const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '') && body.length > 1024;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
    res.end(gz ? zlib.gzipSync(body) : body);
  }
  function handleServers(req, res) {   // public: the site asks "which worker should I read from?"
    const now = Date.now();
    const list = store.listWorkers().filter(w => w.url && now - w.last_seen < ONLINE_MS * 2 && store.seq() - w.last_seq < 5000).map(w => ({ name: w.name, url: w.url }));
    send(req, res, 200, { workers: list }, { 'Cache-Control': 'public, max-age=60' });
  }

  async function handleAdmin(req, res, url, auth, admin, ip) {
    if (!admin) deny();
    const me = { uid: auth.uid, ip };
    const sub = url.pathname.replace(/^\/api\/admin\/?/, '');
    if (sub === 'import-json') {
      if (req.method !== 'POST') bad('method_not_allowed');
      const data = await readBody(req, 15 * 1024 * 1024);
      const result = mergeFirebaseTree(store, data);
      act.event('ADMIN', me, 'imported old JSON data');
      return send(req, res, 200, result);
    }
    if (sub === 'status') {
      const ws = store.listWorkers().map(w => ({ id: w.id, name: w.name, url: w.url, lastSeen: w.last_seen, behind: Math.max(0, store.seq() - w.last_seq), online: Date.now() - w.last_seen < ONLINE_MS * 2, hasKey: w.has_key }));
      return send(req, res, 200, { role, seq: store.seq(), backup: backups.status(), workers: ws });
    }
    if (sub === 'workers') {
      if (req.method === 'GET') {   // view / copy a worker's env again, any time
        const w = store.getWorker(url.searchParams.get('id') || '');
        if (!w) throw new HttpError(404, 'not_found');
        act.event('ADMIN', me, `viewed env of worker "${w.name}"`);
        if (!w.key) return send(req, res, 200, { id: w.id, name: w.name, hasKey: false });
        return send(req, res, 200, { id: w.id, name: w.name, hasKey: true, key: w.key, env: buildWorkerEnv(req, w, { main: url.searchParams.get('main'), origin: url.searchParams.get('origin') }) });
      }
      if (req.method === 'POST') {
        const b = await readBody(req);
        const name = String((b && b.name) || '').trim();
        if (!name) bad('name_required');
        const u = String((b && b.url) || '').trim();
        const w = store.createWorker(name, /^https?:\/\//.test(u) ? u : null);
        act.event('ADMIN', me, `added worker "${w.name}"`);
        return send(req, res, 200, { ...w, hasKey: true, env: buildWorkerEnv(req, { ...w, url: /^https?:\/\//.test(u) ? u : null }, { main: b && b.main, origin: b && b.origin }) });
      }
      if (req.method === 'PATCH') {   // new key for a worker (needed for workers made by an older version, or if a key leaked)
        const b = await readBody(req);
        const w = store.rotateWorkerKey(String((b && b.id) || ''));
        if (!w) throw new HttpError(404, 'not_found');
        act.event('ADMIN', me, `new key for worker "${w.name}"`);
        return send(req, res, 200, { id: w.id, name: w.name, hasKey: true, key: w.key, env: buildWorkerEnv(req, w, { main: b && b.main, origin: b && b.origin }) });
      }
      if (req.method === 'DELETE') { const id = url.searchParams.get('id') || ''; const ok = store.deleteWorker(id); act.event('ADMIN', me, `removed worker ${id}`); return send(req, res, 200, { deleted: ok }); }
      bad('method_not_allowed');
    }
    if (sub !== 'backup') throw new HttpError(404, 'not_found');
    if (req.method === 'POST') {
      act.event('ADMIN', me, 'manual backup started');
      const r = await backups.run();
      return send(req, res, 200, { ok: true, ...r, file: undefined });
    }
    if (req.method !== 'GET') bad('method_not_allowed');
    act.event('ADMIN', me, 'downloaded a backup');
    const tmp = path.join(cfg.backupDir, `.dl-${Date.now()}.db`);
    store.backupTo(tmp);
    const gz = zlib.gzipSync(fs.readFileSync(tmp));
    fs.unlinkSync(tmp);
    res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Disposition': 'attachment; filename="movex-backup.db.gz"', ...corsHeaders(req) });
    res.end(gz);
  }

  function peekUid(req) {   // log only: NOT a login check
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m) return null;
    const t = m[1];
    if (t.startsWith('dev:')) return t.slice(4, 60) || null;
    const parts = t.split('.');
    if (parts.length !== 3) return null;
    try { const j = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')); return String(j.user_id || j.sub || '').slice(0, 60) || null; } catch { return null; }
  }
  // first request of a user (or the first one after 30 quiet minutes) = one "USER" line
  const seenUsers = new Map();
  function noteUser(uid, ip, isAdminUser) {
    const now = Date.now();
    if (now - (seenUsers.get(uid) || 0) < 30 * 60e3) return;
    if (seenUsers.size > 5000) seenUsers.clear();
    seenUsers.set(uid, now);
    act.event('USER', { uid, ip }, isAdminUser ? 'active (admin)' : 'active');
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
      const url = new URL(req.url, 'http://localhost');
      if (serveFrontend(req, res, url.pathname)) { act.count('static'); return; }
      const ip = clientIp(req);
      const who = { uid: null, ip };
      res.on('finish', () => {   // one place that sees every API answer: count the busy ones, log the interesting ones
        const st = res.statusCode;
        if (st >= 500) { act.count('errors'); if (st !== 500) act.event('ERROR', who, `${req.method} ${url.pathname} -> ${st} ${res.mxErr || ''}`); return; }
        if (st === 404) return act.count('notfound');
        if (st >= 400) { act.count('denied'); return act.event('DENY', who, `${req.method} ${url.pathname} -> ${st} ${res.mxErr || ''}`); }
        if (req.method === 'GET' && (url.pathname === '/api/db' || url.pathname.startsWith('/api/db/'))) {
          act.count('reads'); if (st === 304) act.count('r304');
          act.verbose('READ', who, `${url.pathname} -> ${st}`);
        }
      });
      if (!ipLimit(ip)) throw new HttpError(429, 'rate_limited');

      if (url.pathname === '/api/health') return send(req, res, 200, isWorker ? { ok: true, role, ...puller.status() } : { ok: true, role, seq: store.seq() });
      if (isWorker && url.pathname === '/api/notify' && req.method === 'POST') {
        const want = crypto.createHash('sha256').update(String(cfg.workerKey)).digest();
        const got = Buffer.from(String(req.headers['x-notify'] || ''), 'hex');
        if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) throw new HttpError(401, 'bad_notify');
        puller.syncNow();
        return send(req, res, 200, { ok: true });
      }
      if (!isWorker && url.pathname === '/api/sync') return handleSync(req, res, url);
      if (!isWorker && url.pathname === '/api/servers') return handleServers(req, res);

      const isDb = url.pathname === '/api/db' || url.pathname.startsWith('/api/db/');
      const isAdminRoute = url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/');
      if (!isDb && !isAdminRoute) throw new HttpError(404, 'not_found');

      if (isWorker) {
        // the worker does not verify tokens (main does), but it can still read the uid out of the token for its own log
        who.uid = peekUid(req);
        if (who.uid) noteUser(who.uid, ip, who.uid === cfg.adminUid);
        const live = /^\/api\/db\/online_users(\/|$)/.test(url.pathname);
        if (isAdminRoute || req.method !== 'GET' || live) return await proxy(req, res, url, ip, who);
        if (url.pathname === '/api/servers') return await proxy(req, res, url, ip, who);
        if (!puller.ready) throw new HttpError(503, 'warming_up');
      }

      const auth = await authenticate(req);
      if (auth) { who.uid = auth.uid; noteUser(auth.uid, ip, auth.uid === cfg.adminUid); }
      if (auth && !uidLimit(auth.uid)) throw new HttpError(429, 'rate_limited');
      // Admin access is controlled only by the host's ADMIN_UID, never by imported database data.
      const admin = !!auth && !!cfg.adminUid && auth.uid === cfg.adminUid;

      if (isAdminRoute) return await handleAdmin(req, res, url, auth, admin, ip);

      const segs = parseSegs(url.pathname, '/api/db');
      if (req.method === 'GET') return handleGet(req, res, segs, url, auth, admin);
      if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
        const body = req.method === 'DELETE' ? undefined : await readBody(req);
        return handleWrite(req, res, req.method, segs, body, auth, admin, ip);
      }
      throw new HttpError(405, 'method_not_allowed');
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) log.error('[error]', e);
      res.mxErr = e instanceof HttpError ? e.code : 'server_error';
      if (!res.headersSent) send(req, res, status, { error: e instanceof HttpError ? e.code : 'server_error' });
    }
  });

  return { server, store, backups, tg, puller, role, activity: act, close: () => new Promise((r) => { act.stop(); if (wTimer) clearInterval(wTimer); server.close(() => { try { store.close(); } catch { /* ignore */ } r(); }); server.closeAllConnections?.(); }) };
}
