// Legacy CLI fallback. The recommended import path is Admin Panel -> Settings -> Import Old JSON Data.
// This script now uses the same additive merge logic and never replaces existing collections.
import fs from 'node:fs';
import { openStore } from '../src/store.js';
import { mergeFirebaseTree } from '../src/importer.js';

const file = process.argv[2];
if (!file) { console.error('Select a JSON file in the Admin Panel, or provide a file path for this legacy CLI.'); process.exit(1); }
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('Invalid JSON:', e.message); process.exit(1); }
const store = openStore(process.env.DB_PATH || './data/database.db');
try {
  const report = mergeFirebaseTree(store, data);
  console.log(JSON.stringify(report, null, 2));
} finally { store.close(); }
