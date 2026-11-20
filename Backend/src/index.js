import fs from 'node:fs';
import { createApp } from './app.js';
import { createTelegram } from './telegram.js';
import { restoreIfEmpty } from './restore.js';
import { stripLegacyLinks } from './visibility.js';

try { if (fs.existsSync('.env')) process.loadEnvFile('.env'); } catch { /* env vars can also come from the hosting panel */ }

const env = process.env;
const role = (env.ROLE || 'main').toLowerCase() === 'worker' ? 'worker' : 'main';
const cfg = {
  role,
  dbPath: env.DB_PATH || './data/database.db',
  projectId: env.FIREBASE_PROJECT_ID || 'movex-513',
  adminUid: String(env.ADMIN_UID || '').trim(),
  allowedOrigins: env.ALLOWED_ORIGINS || '*',
  trustProxy: env.TRUST_PROXY === '1',
  devInsecureAuth: env.DEV_INSECURE_AUTH === '1',
  backupDir: env.BACKUP_DIR || './data/backups',
  backupKeepLocal: Number(env.BACKUP_KEEP_LOCAL || 7),
  driveKeepDays: Number(env.GDRIVE_KEEP_DAYS || 30),
  drive: { clientId: env.GDRIVE_CLIENT_ID, clientSecret: env.GDRIVE_CLIENT_SECRET, refreshToken: env.GDRIVE_REFRESH_TOKEN, folderId: env.GDRIVE_FOLDER_ID },
  logLevel: (env.LOG_LEVEL || 'normal').toLowerCase(),
  backupEveryHours: Number(env.BACKUP_EVERY_HOURS || 0) || undefined,
  tgToken: env.TG_BOT_TOKEN, tgChatId: env.TG_CHAT_ID, tgApiId: env.TG_API_ID, tgApiHash: env.TG_API_HASH, tgSession: env.TG_SESSION, tgKeep: Number(env.TG_KEEP || 30),
  mainUrl: env.MAIN_URL, workerKey: env.WORKER_KEY, publicUrl: env.PUBLIC_URL, syncEverySec: Number(env.SYNC_EVERY_SEC || 60),
};
if (cfg.devInsecureAuth) console.warn('!!! DEV_INSECURE_AUTH=1 : anyone can log in as anybody. Use only for local tests. !!!');
if (role === 'worker' && (!cfg.mainUrl || !cfg.workerKey)) { console.error('ROLE=worker needs MAIN_URL and WORKER_KEY (create the key in Admin -> Settings -> Servers).'); process.exit(1); }

// Fresh/empty MAIN server -> pull the newest backup from the Telegram channel before serving anything.
if (role === 'main') {
  const tg = createTelegram({ token: cfg.tgToken, chatId: cfg.tgChatId, apiId: cfg.tgApiId, apiHash: cfg.tgApiHash, session: cfg.tgSession, dir: cfg.backupDir });
  const r = await restoreIfEmpty({ dbPath: cfg.dbPath, tg });
  if (r.restored) console.log('[start] database restored from Telegram:', r);
}

const app = createApp(cfg);
// One-time cleanup (MAIN only): the old default video link fields (server1 / server2 / link) are removed from every stored title and episode.
// Workers receive the cleaned data through the normal sync.
if (role === 'main') {
  try {
    if (app.store.getMeta('legacy_links_removed') !== '1') {
      const all = app.store.readRaw(['movies']) || {};
      let n = 0;
      app.store.transaction(() => {
        for (const [id, m] of Object.entries(all)) {
          const c = stripLegacyLinks(m);
          if (JSON.stringify(c) !== JSON.stringify(m)) { app.store.writeAt(['movies', id], c); n++; }
        }
        app.store.setMeta('legacy_links_removed', '1');
      });
      console.log(`[start] old default video links removed from ${n} title(s)`);
    }
  } catch (e) { console.error('[start] legacy link cleanup failed:', e.message); }
}
const port = Number(env.PORT || 3000);
app.server.listen(port, env.HOST || '0.0.0.0', () => {
  console.log(`MoveX ${role.toUpperCase()} server listening on :${port}  (db: ${cfg.dbPath})`);
  console.log(`[start] log=${app.activity.level} admin_uid=${cfg.adminUid ? 'set' : 'MISSING'} trust_proxy=${cfg.trustProxy} origins=${cfg.allowedOrigins}` + (role === 'main' ? ` telegram=${cfg.tgToken || cfg.tgSession ? 'on' : 'off'} drive=${cfg.drive.refreshToken ? 'on' : 'off'}` : ` main=${cfg.mainUrl}`));
  if (!cfg.adminUid) console.warn('[start] ADMIN_UID is empty: nobody can open the Admin Panel on this server.');
});
if (role === 'main') app.backups.schedule(() => Number(cfg.backupEveryHours || 12));
else app.puller.start();

const stop = () => { console.log('shutting down...'); app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
