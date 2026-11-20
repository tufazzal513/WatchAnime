import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { createVerifier } from '../src/auth.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'movex-test-'));
let app, base;
const ADMIN = 'dev:admin1', U1 = 'dev:user1', U2 = 'dev:user2';

async function call(method, p, { token, body, headers = {} } = {}) {
  const r = await fetch(base + '/api/db/' + p, {
    method,
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return { status: r.status, json: text ? JSON.parse(text) : undefined, headers: r.headers };
}

before(async () => {
  app = createApp({ dbPath: path.join(dir, 'db.sqlite'), backupDir: path.join(dir, 'bk'), projectId: 'movex-test', devInsecureAuth: true, adminUid: 'admin1', log: { log() {}, error() {} } });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + app.server.address().port;
  app.store.writeAt(['settings', 'adminUIDs', 'admin1'], true); // legacy entry must not control admin access
  app.store.writeAt(['settings', 'adminUIDs', 'legacy-admin'], true);
  app.store.writeAt(['settings', 'appName'], 'MoveX');
});
after(async () => { await app.close(); fs.rmSync(dir, { recursive: true, force: true }); });


test('serves the Admin Panel from the backend without changing API routes', async () => {
  const page = await fetch(base + '/admin');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') || '', /text\/html/);
  assert.match(await page.text(), /MoveX - Admin Panel/);

  const loginRoute = await fetch(base + '/admin/login');
  assert.equal(loginRoute.status, 200);
  assert.match(await loginRoute.text(), /data-include=\"partials\/login.html\"/);
  const loginPartial = await fetch(base + '/admin/partials/login.html');
  assert.equal(loginPartial.status, 200);
  assert.match(await loginPartial.text(), /admin-login-form/);

  const script = await fetch(base + '/assets/js/admin/bootstrap.js');
  assert.equal(script.status, 200);
  assert.match(await script.text(), /loadIncludes/);

  const css = await fetch(base + '/assets/css/admin/base.css');
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type') || '', /text\/css/);
});

test('admin access is controlled only by ADMIN_UID, not legacy database adminUIDs', async () => {
  const ok = await fetch(base + '/api/admin/status', { headers: { Authorization: 'Bearer ' + ADMIN } });
  assert.equal(ok.status, 200);
  const legacy = await fetch(base + '/api/admin/status', { headers: { Authorization: 'Bearer dev:legacy-admin' } });
  assert.equal(legacy.status, 403);
  const normal = await fetch(base + '/api/admin/status', { headers: { Authorization: 'Bearer ' + U1 } });
  assert.equal(normal.status, 403);
});

test('Admin JSON import merges missing series episodes and never overwrites existing data', async () => {
  app.store.writeAt(['movies', 'seriesA'], {
    title: 'Original Series', contentType: 'series', year: '2020', posterUrl: 'old-poster',
    seasons: { 'Season 1': [1, 2, 3, 4].map(n => ({ name: `Episode ${n}`, server1: `old-${n}` })) }
  });
  app.store.writeAt(['movies', 'keepOnly'], { title: 'Keep Existing', contentType: 'movie' });

  const incomingEpisodes = Array.from({ length: 10 }, (_, i) => ({ name: `Episode ${i + 1}`, server1: `incoming-${i + 1}` }));
  const data = {
    movies: {
      seriesA: { title: 'Changed Title', contentType: 'series', year: '2099', posterUrl: 'new-poster', seasons: { 'Season 1': incomingEpisodes, 'Season 2': [{ name: 'Episode 1', server1: 's2-e1' }] } },
      newMovie: { title: 'New Movie', contentType: 'movie', year: '2026' },
      malformed: { posterUrl: 'missing-title' }
    },
    settings: { adminUIDs: { intruder: true }, appName: 'Injected Name' },
    categories: { drama: { name: 'Drama' } }
  };

  const denied = await fetch(base + '/api/admin/import-json', { method: 'POST', headers: { Authorization: 'Bearer ' + U1, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  assert.equal(denied.status, 403);
  const response = await fetch(base + '/api/admin/import-json', { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.addedMovies, 1);
  assert.equal(report.addedSeasons, 1);
  assert.equal(report.addedEpisodes, 7);
  assert.equal(report.duplicateEpisodes, 4);
  assert.ok(report.skipped >= 2);

  const series = (await call('GET', 'movies/seriesA', { token: U1 })).json;
  assert.equal(series.title, 'Original Series');
  assert.equal(series.year, '2020');
  assert.equal(series.posterUrl, 'old-poster');
  assert.equal(series.seasons['Season 1'].length, 10);
  assert.equal(series.seasons['Season 1'][0].server1, 'old-1');
  assert.equal(series.seasons['Season 1'][3].server1, 'old-4');
  assert.equal(series.seasons['Season 1'][4].server1, 'incoming-5');
  assert.equal(series.seasons['Season 2'].length, 1);
  assert.equal((await call('GET', 'movies/keepOnly/title', { token: U1 })).json, 'Keep Existing');
  assert.equal((await call('GET', 'movies/newMovie/title', { token: U1 })).json, 'New Movie');
  assert.equal((await call('GET', 'settings/appName')).json, 'MoveX');
  assert.equal(app.store.readRaw(['settings', 'adminUIDs', 'intruder']), undefined);
  assert.equal((await call('GET', 'categories/drama/name', { token: U1 })).json, 'Drama');

  // Re-importing the same file is idempotent: no additional seasons or episodes are created.
  const again = await fetch(base + '/api/admin/import-json', { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const againReport = await again.json();
  assert.equal(againReport.addedEpisodes, 0);
  assert.equal(againReport.addedSeasons, 0);
  assert.equal((await call('GET', 'movies/seriesA', { token: U1 })).json.seasons['Season 1'].length, 10);
});

test('settings are public, movies need login', async () => {
  assert.equal((await call('GET', 'settings/appName')).json, 'MoveX');
  assert.equal((await call('GET', 'movies')).status, 403);
  assert.equal((await call('GET', 'movies', { token: U1 })).status, 200);
});

test('only admins write movies; arrays round-trip; push-style ids', async () => {
  const movie = { title: 'A', seasons: { S1: [{ name: 'E1', server1: 'x' }, { name: 'E2', server1: 'y' }] }, isUpcoming: true, nothing: null };
  assert.equal((await call('PUT', 'movies/-Oabc', { token: U1, body: movie })).status, 403);
  assert.equal((await call('PUT', 'movies/-Oabc', { token: ADMIN, body: movie })).status, 200);
  const got = (await call('GET', 'movies/-Oabc', { token: U1 })).json;
  assert.equal(got.title, 'A');
  assert.ok(Array.isArray(got.seasons.S1));
  assert.equal(got.seasons.S1[1].name, 'E2');
  assert.equal('nothing' in got, false);
  // this title is upcoming (no release time yet): normal users get the episode names but never the stream links
  assert.equal('server1' in got.seasons.S1[0], false);
  const adminGot = (await call('GET', 'movies/-Oabc', { token: ADMIN })).json;
  assert.equal(adminGot.seasons.S1[0].server1, 'x');
});

test('private titles are hidden from users; upcoming titles keep no stream links until release', async () => {
  const past = Date.now() - 60e3, future = Date.now() + 3600e3;
  const put = (id, body) => call('PUT', 'movies/' + id, { token: ADMIN, body });
  await put('-Vpriv', { title: 'Secret', isPrivate: true, server1: 'https://secret/stream' });
  await put('-Vsoon', { title: 'Soon', isUpcoming: true, releaseTs: future, server1: 'https://soon/stream', seasons: { S1: [{ name: 'E1', server1: 'https://soon/e1' }] } });
  await put('-Vout', { title: 'Out', isUpcoming: true, releaseTs: past, server1: 'https://out/stream' });
  await put('-Vpub', { title: 'Public', server1: 'https://pub/stream' });
  await call('PUT', 'banners/b1', { token: ADMIN, body: { movieId: '-Vpriv', imageUrl: 'x' } });
  await call('PUT', 'banners/b2', { token: ADMIN, body: { movieId: '-Vpub', imageUrl: 'y' } });
  await call('PUT', 'banners/b3', { token: ADMIN, body: { imageUrl: 'z' } });

  const list = (await call('GET', 'movies', { token: U1 })).json;
  assert.equal('-Vpriv' in list, false);
  assert.equal(list['-Vsoon'].title, 'Soon');
  assert.equal(JSON.stringify(list['-Vsoon']).includes('soon/'), false);
  assert.equal(list['-Vout'].server1, 'https://out/stream');
  assert.equal(list['-Vpub'].server1, 'https://pub/stream');
  assert.equal((await call('GET', 'movies/-Vpriv', { token: U1 })).json, null);
  assert.equal((await call('GET', 'movies/-Vpriv/server1', { token: U1 })).json, null);
  assert.equal((await call('GET', 'movies/-Vsoon/seasons/S1/0/server1', { token: U1 })).json, null);
  assert.equal((await call('GET', 'movies/-Vsoon/seasons/S1/0/name', { token: U1 })).json, 'E1');
  assert.equal((await call('GET', 'movies/-Vpub/server1', { token: U1 })).json, 'https://pub/stream');
  const lite = (await call('GET', 'movies?lite=1', { token: U1 })).json;
  assert.equal('-Vpriv' in lite, false);

  const adminList = (await call('GET', 'movies', { token: ADMIN })).json;
  assert.equal(adminList['-Vpriv'].server1, 'https://secret/stream');
  assert.equal(adminList['-Vsoon'].server1, 'https://soon/stream');

  const banners = (await call('GET', 'banners', { token: U1 })).json;
  assert.deepEqual(Object.keys(banners).sort(), ['b2', 'b3']);
  assert.deepEqual(Object.keys((await call('GET', 'banners', { token: ADMIN })).json).sort(), ['b1', 'b2', 'b3']);

  // the admin's cached copy must never be served to a normal user (separate ETags)
  const etagAdmin = (await call('GET', 'movies', { token: ADMIN })).headers.get('etag');
  assert.notEqual((await call('GET', 'movies', { token: U1, headers: { 'If-None-Match': etagAdmin } })).status, 304);

  // release time passes -> links appear without any edit (ETag changes by itself)
  const before = (await call('GET', 'movies', { token: U1 })).headers.get('etag');
  app.store.writeAt(['movies', '-Vsoon', 'releaseTs'], Date.now() + 300);
  await new Promise(r => setTimeout(r, 50));
  const mid = await call('GET', 'movies/-Vsoon', { token: U1 });
  assert.equal(mid.json.seasons.S1[0].server1, undefined);
  await new Promise(r => setTimeout(r, 450));
  const after = await call('GET', 'movies', { token: U1, headers: { 'If-None-Match': before } });
  assert.equal(after.status, 200);
  assert.equal(after.json['-Vsoon'].seasons.S1[0].server1, 'https://soon/e1');
  await call('DELETE', 'movies/-Vpriv', { token: ADMIN }); await call('DELETE', 'movies/-Vsoon', { token: ADMIN });
  await call('DELETE', 'movies/-Vout', { token: ADMIN }); await call('DELETE', 'movies/-Vpub', { token: ADMIN });
  for (const b of ['b1', 'b2', 'b3']) await call('DELETE', 'banners/' + b, { token: ADMIN });
});

test('multi-path update from root (upcoming checker) works for admin only', async () => {
  const body = { 'movies/-Oabc/isUpcoming': false };
  assert.equal((await call('PATCH', '', { token: U1, body })).status, 403);
  assert.equal((await call('PATCH', '', { token: ADMIN, body })).status, 200);
  assert.equal((await call('GET', 'movies/-Oabc/isUpcoming', { token: U1 })).json, false);
});

test('ETag / 304 and refresh after write', async () => {
  const a = await call('GET', 'movies', { token: U1 });
  const etag = a.headers.get('etag');
  const beforeCount = Object.keys(a.json).length;
  assert.ok(etag);
  assert.equal((await call('GET', 'movies', { token: U1, headers: { 'If-None-Match': etag } })).status, 304);
  await call('PUT', 'movies/-Odef', { token: ADMIN, body: { title: 'B' } });
  const b = await call('GET', 'movies', { token: U1, headers: { 'If-None-Match': etag } });
  assert.equal(b.status, 200);
  assert.equal(Object.keys(b.json).length, beforeCount + 1);
});

test('users: own record only, status cannot be changed by user', async () => {
  const rec = { uid: 'user1', name: 'U', status: 'active', createdAt: { '.sv': 'timestamp' } };
  assert.equal((await call('PUT', 'users/user1', { token: U1, body: rec })).status, 200);
  assert.equal(typeof (await call('GET', 'users/user1', { token: U1 })).json.createdAt, 'number');
  assert.equal((await call('GET', 'users/user1', { token: U2 })).status, 403);
  assert.equal((await call('GET', 'users', { token: U1 })).status, 403);
  assert.equal((await call('GET', 'users', { token: ADMIN })).status, 200);
  assert.equal((await call('PUT', 'users/user1/status', { token: U1, body: 'frozen' })).status, 403);
  assert.equal((await call('PUT', 'users/user1', { token: U2, body: rec })).status, 403);
  assert.equal((await call('PUT', 'users/user1/status', { token: ADMIN, body: 'frozen' })).status, 200);
  assert.equal((await call('PUT', 'users/user1/status', { token: ADMIN, body: 'active' })).status, 200);
});

test('my list + progress validation', async () => {
  assert.equal((await call('PUT', 'users/user1/myList/-Oabc', { token: U1, body: { '.sv': 'timestamp' } })).status, 200);
  assert.equal((await call('PUT', 'users/user1/myList/-Odef', { token: U1, body: 'nope' })).status, 403);
  assert.equal((await call('PUT', 'users/user1/progress/-Oabc', { token: U1, body: { t: 10, d: 100, ep: null } })).status, 200);
  assert.equal((await call('PUT', 'users/user1/progress/-Odef', { token: U1, body: { t: 10 } })).status, 403);
  assert.equal((await call('DELETE', 'users/user1/myList/-Oabc', { token: U1 })).status, 200);
});

test('watch history: own entries only, validated', async () => {
  assert.equal((await call('PUT', 'users/user1/history/-Oabc', { token: U1, body: { at: { '.sv': 'timestamp' }, t: 10, d: 100, ep: null, season: null, done: false } })).status, 200);
  assert.equal((await call('PUT', 'users/user1/history/-Odef', { token: U1, body: { t: 10 } })).status, 403);
  assert.equal((await call('PUT', 'users/user1/history/-Odef', { token: U1, body: { at: 1, done: 'yes' } })).status, 403);
  assert.equal((await call('GET', 'users/user1/history', { token: U2 })).status, 403);
  assert.equal((await call('DELETE', 'users/user1/history', { token: U1 })).status, 200);
});

test('deleted user can remove own record only after admin marked it deleted', async () => {
  assert.equal((await call('DELETE', 'users/user1', { token: U1 })).status, 403);
  await call('PUT', 'users/user1', { token: ADMIN, body: { uid: 'user1', status: 'deleted', deletedAt: { '.sv': 'timestamp' } } });
  assert.equal((await call('DELETE', 'users/user1', { token: U1 })).status, 200);
});

test('stats counters accept only +1', async () => {
  assert.equal((await call('PUT', 'stats/-Oabc/plays', { token: U1, body: 1 })).status, 200);
  assert.equal((await call('PUT', 'stats/-Oabc/plays', { token: U1, body: 5 })).status, 403);
  assert.equal((await call('PUT', 'stats/-Oabc/plays', { token: U1, body: 2 })).status, 200);
  assert.equal((await call('PUT', 'stats/-Oabc/hack', { token: U1, body: 1 })).status, 403);
  assert.equal((await call('PUT', 'stats/-Oabc/lists', { token: U1, body: 1 })).status, 200);
  assert.equal((await call('PUT', 'stats/-Oabc/lists', { token: U1, body: 0 })).status, 200);
  assert.equal((await call('PUT', 'stats/-Oabc/lists', { token: U1, body: -1 })).status, 403);
  assert.deepEqual((await call('GET', 'stats', { token: U2 })).json, { '-Oabc': { plays: 2, lists: 0 } });
});

test('search stats: transaction-style writes + top-N query', async () => {
  for (const [k, c] of [['batman', 5], ['dune', 3], ['up', 1]]) {
    for (let i = 1; i <= c; i++) {
      const r = await call('PUT', 'searchStats/' + k, { token: U1, body: { t: k.length < 2 ? k + k : k, c: i, at: Date.now() } });
      assert.equal(r.status, 200, k + i);
    }
  }
  assert.equal((await call('PUT', 'searchStats/batman', { token: U1, body: { t: 'batman', c: 99, at: 1 } })).status, 403);
  const top = (await call('GET', 'searchStats?orderBy=c&limitToLast=2', { token: U1 })).json;
  assert.deepEqual(Object.keys(top).sort(), ['batman', 'dune']);
});

test('password-reset log works logged out, rejects non-numbers, anon cannot touch anything else', async () => {
  assert.equal((await call('PUT', 'pwd_resets/a@b_com', { body: { k1: Date.now() } })).status, 200);
  assert.equal((await call('GET', 'pwd_resets/a@b_com')).status, 200);
  assert.equal((await call('GET', 'pwd_resets')).status, 403);
  assert.equal((await call('PUT', 'pwd_resets/a@b_com', { body: { k1: 'x' } })).status, 403);
  assert.equal((await call('PUT', 'movies/x', { body: { t: 1 } })).status, 403);
  assert.equal((await call('GET', 'settings')).status, 200);
});

test('broken links + error log', async () => {
  assert.equal((await call('PUT', 'broken_links/-Oabc', { token: U1, body: { at: 1 } })).status, 200);
  assert.equal((await call('GET', 'broken_links', { token: U1 })).status, 403);
  assert.equal((await call('GET', 'broken_links', { token: ADMIN })).status, 200);
  assert.equal((await call('PUT', 'analytics/errors/e1', { token: U1, body: { msg: 'boom', ts: 1 } })).status, 200);
  assert.equal((await call('PUT', 'analytics/errors/e1', { token: U1, body: { msg: 'again' } })).status, 403);
  assert.equal(Object.keys((await call('GET', 'analytics/errors', { token: ADMIN })).json).length, 1);
});

test('presence lives in memory; admin sees it', async () => {
  assert.equal((await call('PUT', 'online_users/user1', { token: U1, body: { name: 'U', last_seen: Date.now() } })).status, 200);
  assert.equal((await call('PATCH', 'online_users/user1', { token: U1, body: { last_seen: Date.now() } })).status, 200);
  assert.equal((await call('PUT', 'online_users/user2', { token: U1, body: { name: 'x' } })).status, 403);
  assert.equal((await call('GET', 'online_users', { token: U1 })).status, 403);
  const online = (await call('GET', 'online_users', { token: ADMIN })).json;
  assert.deepEqual(Object.keys(online), ['user1']);
  assert.equal((await call('DELETE', 'online_users/user1', { token: U1 })).status, 200);
  assert.equal((await call('GET', 'online_users', { token: ADMIN })).json, null);
});

test('bad paths / bodies are rejected, not crashed', async () => {
  assert.equal((await call('GET', 'movies/a.b', { token: U1 })).status, 400);
  assert.equal((await call('PUT', 'movies/x', { token: ADMIN, body: { 'a.b': 1 } })).status, 400);
  assert.equal((await call('PUT', '', { token: ADMIN, body: {} })).status, 400);
  assert.equal((await call('GET', 'nothing', { token: ADMIN })).status, 403);
  const r = await fetch(base + '/api/db/movies/x', { method: 'PUT', headers: { Authorization: 'Bearer ' + ADMIN }, body: '{oops' });
  assert.equal(r.status, 400);
  assert.equal((await call('GET', 'movies', { token: 'garbage' })).status, 401);
});

test('backup download is admin-only and a valid database', async () => {
  const bad = await fetch(base + '/api/admin/backup', { headers: { Authorization: 'Bearer ' + U1 } });
  assert.equal(bad.status, 403);
  const ok = await fetch(base + '/api/admin/backup', { headers: { Authorization: 'Bearer ' + ADMIN } });
  assert.equal(ok.status, 200);
  const buf = (await import('node:zlib')).gunzipSync(Buffer.from(await ok.arrayBuffer()));
  assert.equal(buf.subarray(0, 15).toString(), 'SQLite format 3');
  const run = await fetch(base + '/api/admin/backup', { method: 'POST', headers: { Authorization: 'Bearer ' + ADMIN } });
  assert.equal(run.status, 200);
  assert.ok(fs.readdirSync(path.join(dir, 'bk')).some(f => f.endsWith('.db.gz')));
});

test('real Firebase-style RS256 token verification (local keypair)', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
  const verifier = createVerifier({ projectId: 'movex-test', fetchKeys: async () => ({ jwk: { keys: [jwk] }, ttl: 3600e3 }) });
  const mk = (claims, key = privateKey, kid = 'k1') => {
    const now = Math.floor(Date.now() / 1000);
    const h = Buffer.from(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })).toString('base64url');
    const p = Buffer.from(JSON.stringify({ iss: 'https://securetoken.google.com/movex-test', aud: 'movex-test', sub: 'abc', iat: now - 5, exp: now + 3600, ...claims })).toString('base64url');
    return `${h}.${p}.${crypto.sign('RSA-SHA256', Buffer.from(h + '.' + p), key).toString('base64url')}`;
  };
  assert.equal((await verifier.verify(mk({}))).uid, 'abc');
  await assert.rejects(verifier.verify(mk({ aud: 'other' })));
  await assert.rejects(verifier.verify(mk({ iss: 'https://evil' })));
  await assert.rejects(verifier.verify(mk({ exp: 1 })));
  await assert.rejects(verifier.verify(mk({ sub: '' })));
  await assert.rejects(verifier.verify(mk({}, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)));
  await assert.rejects(verifier.verify('dev:admin1'));   // dev tokens are refused unless DEV_INSECURE_AUTH=1
});

test('worker key can be viewed again, env block is complete, legacy workers can get a new key', async () => {
  const H = (t) => ({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
  const mk = await fetch(base + '/api/admin/workers', { method: 'POST', headers: H(ADMIN), body: JSON.stringify({ name: 'wk-view', url: 'https://wk.example', main: 'https://main.example/', origin: 'https://site.example' }) });
  assert.equal(mk.status, 200);
  const made = await mk.json();
  assert.match(made.key, /^wk_/);
  const again = await (await fetch(base + '/api/admin/workers?id=' + made.id + '&main=https%3A%2F%2Fmain.example&origin=https%3A%2F%2Fsite.example', { headers: H(ADMIN) })).json();
  assert.equal(again.key, made.key);                                   // same key, any number of times
  for (const line of ['ROLE=worker', 'MAIN_URL=https://main.example', 'WORKER_KEY=' + made.key, 'PUBLIC_URL=https://wk.example', 'ADMIN_UID=admin1', 'FIREBASE_PROJECT_ID=movex-test', 'ALLOWED_ORIGINS=https://site.example', 'TRUST_PROXY=1', 'PORT=3000', 'SYNC_EVERY_SEC=60'])
    assert.ok(again.env.split('\n').includes(line), 'missing ' + line);
  assert.equal((await fetch(base + '/api/admin/workers?id=' + made.id, { headers: H(U1) })).status, 403);   // admin only
  // key from the stored copy really authenticates the worker
  assert.equal((await fetch(base + '/api/sync?since=0', { headers: { 'X-Worker-Key': made.key } })).status, 200);
  // legacy worker (no stored key) -> hasKey=false, then a new key works and the old one stops working
  app.store.db.prepare('UPDATE workers SET key_plain = NULL WHERE id = ?').run(made.id);
  const legacy = await (await fetch(base + '/api/admin/workers?id=' + made.id, { headers: H(ADMIN) })).json();
  assert.equal(legacy.hasKey, false);
  const rot = await (await fetch(base + '/api/admin/workers', { method: 'PATCH', headers: H(ADMIN), body: JSON.stringify({ id: made.id }) })).json();
  assert.notEqual(rot.key, made.key);
  assert.equal((await fetch(base + '/api/sync?since=0', { headers: { 'X-Worker-Key': made.key } })).status, 401);
  assert.equal((await fetch(base + '/api/sync?since=0', { headers: { 'X-Worker-Key': rot.key } })).status, 200);
  const st = await (await fetch(base + '/api/admin/status', { headers: H(ADMIN) })).json();
  assert.equal(st.workers.find(w => w.id === made.id).hasKey, true);
  await fetch(base + '/api/admin/workers?id=' + made.id, { method: 'DELETE', headers: H(ADMIN) });
});
