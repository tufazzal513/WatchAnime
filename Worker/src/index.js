import fs from 'node:fs';
import { createApp } from './app.js';

try { if (fs.existsSync('.env')) process.loadEnvFile('.env'); } catch { /* env vars can also come from the hosting panel */ }

const env = process.env;
const cfg = {
  role: 'worker',
  dbPath: env.DB_PATH || './data/database.db',
  projectId: env.FIREBASE_PROJECT_ID || 'movex-513',
  adminUid: String(env.ADMIN_UID || '').trim(),
  allowedOrigins: env.ALLOWED_ORIGINS || '*',
  trustProxy: env.TRUST_PROXY === '1',
  devInsecureAuth: env.DEV_INSECURE_AUTH === '1',
  mainUrl: env.MAIN_URL, workerKey: env.WORKER_KEY, publicUrl: env.PUBLIC_URL, syncEverySec: Number(env.SYNC_EVERY_SEC || 60),
};
if (cfg.devInsecureAuth) console.warn('!!! DEV_INSECURE_AUTH=1 : anyone can log in as anybody. Use only for local tests. !!!');
if (!cfg.mainUrl || !cfg.workerKey) { console.error('Worker needs MAIN_URL and WORKER_KEY (create the key in Admin -> Settings -> Servers on the MAIN server).'); process.exit(1); }

const app = createApp(cfg);
const port = Number(env.PORT || 3000);
app.server.listen(port, env.HOST || '0.0.0.0', () => console.log(`MoveX WORKER server listening on :${port}  (db: ${cfg.dbPath})`));
app.puller.start();

const stop = () => { console.log('shutting down...'); app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
