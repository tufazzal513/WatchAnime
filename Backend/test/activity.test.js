import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createActivity } from '../src/activity.js';
import { createApp } from '../src/app.js';

const grab = () => { const lines = []; return { lines, log: { log: (...a) => lines.push(a.join(' ')), error: (...a) => lines.push(a.join(' ')) } }; };

test('flood guard caps lines, counts the rest, quiet level hides activity', () => {
  const g = grab();
  const a = createActivity({ level: 'normal', log: g.log, role: 'main', maxPerWindow: 5 });
  for (let i = 0; i < 100; i++) a.event('WRITE', { uid: 'u' + i, ip: '1.1.1.1' }, 'PUT x');
  a.count('reads', 7);
  a.summary();
  assert.equal(g.lines.filter(l => l.includes('WRITE')).length, 5);
  assert.ok(g.lines.some(l => l.includes('95 more activity lines hidden')));
  assert.ok(g.lines.some(l => l.includes('STAT') && l.includes('reads=7')));
  const q = grab(); const qa = createActivity({ level: 'quiet', log: q.log });
  qa.event('WRITE', {}, 'x'); qa.count('reads'); qa.summary();
  assert.equal(q.lines.length, 0);
  const v = grab(); const va = createActivity({ level: 'normal', log: v.log });
  va.verbose('READ', {}, 'x'); assert.equal(v.lines.length, 0);
  va.event('X', { uid: 'a\nb', ip: 'i' }, 'line1\nline2'); assert.equal(v.lines.length, 1);   // no log injection through newlines
});

test('server logs users, writes, denials and admin actions with uid + ip, never values', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'movex-act-'));
  const g = grab();
  const app = createApp({ dbPath: path.join(dir, 'db.sqlite'), backupDir: path.join(dir, 'bk'), projectId: 'p', devInsecureAuth: true, adminUid: 'admin1', log: g.log });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + app.server.address().port;
  const H = (t) => ({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });
  await fetch(base + '/api/db/users/user1', { method: 'PUT', headers: H('dev:user1'), body: JSON.stringify({ name: 'SECRET-VALUE' }) });
  await fetch(base + '/api/db/movies', { headers: H('dev:user1') });
  await fetch(base + '/api/admin/status', { headers: H('dev:user1') });          // denied
  await fetch(base + '/api/admin/backup', { method: 'POST', headers: H('dev:admin1') });
  app.activity.summary();
  const all = g.lines.join('\n');
  assert.match(all, /USER .*uid=user1 ip=127\.0\.0\.1/);
  assert.match(all, /WRITE .*uid=user1 .*PUT users\/user1/);
  assert.match(all, /DENY .*uid=user1 .*-> 403/);
  assert.match(all, /ADMIN .*uid=admin1 .*manual backup/);
  assert.match(all, /STAT .*reads=1/);
  assert.ok(!all.includes('SECRET-VALUE'));
  await app.close(); fs.rmSync(dir, { recursive: true, force: true });
});
