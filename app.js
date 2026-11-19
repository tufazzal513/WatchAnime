// MoveX WORKER server (read replica). No Admin Panel, no backups, no Telegram here.
//   GET  /api/db/...   served from the local synced copy
//   writes / admin API calls / live presence are forwarded to the MAIN server
//   GET  /api/health
//   POST /api/notify   (main -> worker: "pull changes now")
import http from 'node:http';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { openStore, clean } from './store.js';
import { isLocked, releaseMs, publicMovies, publicMoviePath, publicBanners } from './visibility.js';
import { canRead, checkWrite } from './rules.js';
import { createVerifier } from './auth.js';
import { createPuller } from './sync.js';
import { HttpError, bad, deny } from './util.js';

const SEG_BAD = /[.$#\[\]\/\u0000-\u001f]/;
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
  const role = 'worker';
  const isWorker = true;
  const log = cfg.log || console;
  // All server settings come from environment variables only (see .env.example). There is no admin-panel editor for them.
  const allowedOrigins = String(cfg.allowedOrigins || '*').split(',').map(x => x.trim().replace(/\/+$/, '')).filter(Boolean);
  const puller = createPuller({ store, mainUrl: cfg.mainUrl, key: cfg.workerKey, publicUrl: cfg.publicUrl, intervalMs: (cfg.syncEverySec || 5) * 1000, log });
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
          for (const [k, v] of Object.entries(m)) if (k !== 'seasons' && !/^server\d*$/.test(k)) c[k] = v;
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
  async function proxy(req, res, url, ip) {
    const body = (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') ? undefined : await readRawBody(req);
    const h = { 'X-Worker-Key': cfg.workerKey, 'X-MX-Client-IP': ip };
    if (req.headers.authorization) h.Authorization = req.headers.authorization;
    if (req.headers['content-type']) h['Content-Type'] = req.headers['content-type'];
    let r;
    try { r = await fetch(cfg.mainUrl.replace(/\/+$/, '') + url.pathname + url.search, { method: req.method, headers: h, body }); }
    catch { throw new HttpError(502, 'main_unreachable'); }
    const buf = Buffer.from(await r.arrayBuffer());
    if (r.ok && req.method !== 'GET') await Promise.race([puller.syncNow(), new Promise(ok => setTimeout(ok, 1500))]);
    const out = { ...corsHeaders(req), 'Content-Type': r.headers.get('content-type') || 'application/json' };
    for (const k of ['content-disposition', 'etag', 'cache-control']) if (r.headers.get(k)) out[k] = r.headers.get(k);
    res.writeHead(r.status, out); res.end(buf);
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, corsHeaders(req)); return res.end(); }
      const url = new URL(req.url, 'http://localhost');
      const ip = clientIp(req);
      if (!ipLimit(ip)) throw new HttpError(429, 'rate_limited');

      if (url.pathname === '/api/health') return send(req, res, 200, { ok: true, role, ...puller.status() });
      if (url.pathname === '/api/notify' && req.method === 'POST') {
        const want = crypto.createHash('sha256').update(String(cfg.workerKey)).digest();
        const got = Buffer.from(String(req.headers['x-notify'] || ''), 'hex');
        if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) throw new HttpError(401, 'bad_notify');
        puller.syncNow();
        return send(req, res, 200, { ok: true });
      }
      if (url.pathname === '/api/servers') return await proxy(req, res, url, ip);   // site asks main which workers are online

      const isDb = url.pathname === '/api/db' || url.pathname.startsWith('/api/db/');
      const isAdminRoute = url.pathname === '/api/admin' || url.pathname.startsWith('/api/admin/');
      if (!isDb && !isAdminRoute) throw new HttpError(404, 'not_found');

      const live = /^\/api\/db\/online_users(\/|$)/.test(url.pathname);
      if (isAdminRoute || req.method !== 'GET' || live) return await proxy(req, res, url, ip);
      if (!puller.ready) throw new HttpError(503, 'warming_up');

      const auth = await authenticate(req);
      if (auth && !uidLimit(auth.uid)) throw new HttpError(429, 'rate_limited');
      // Admin access is controlled only by the host's ADMIN_UID, never by imported database data.
      const admin = !!auth && !!cfg.adminUid && auth.uid === cfg.adminUid;

      const segs = parseSegs(url.pathname, '/api/db');
      if (req.method === 'GET') return handleGet(req, res, segs, url, auth, admin);
      if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
        const body = req.method === 'DELETE' ? undefined : await readBody(req);
        return handleWrite(req, res, req.method, segs, body, auth, admin, ip);
      }
      throw new HttpError(405, 'method_not_allowed');
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) (cfg.log || console).error('[error]', e);
      if (!res.headersSent) send(req, res, status, { error: e instanceof HttpError ? e.code : 'server_error' });
    }
  });

  return { server, store, puller, role, close: () => new Promise((r) => { server.close(() => { try { store.close(); } catch { /* ignore */ } r(); }); server.closeAllConnections?.(); }) };
}
