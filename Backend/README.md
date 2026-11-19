# MoveX সার্ভার (Node + SQLite `database.db`)

Firebase এখন **শুধু লগইন/রেজিস্টার/পাসওয়ার্ড রিসেটের** জন্য। মুভি, ইউজার ডাটা, My List, progress, স্ট্যাটস সব এই সার্ভারের `data/database.db`-তে।
কোনো npm প্যাকেজ লাগে না (`npm install` দরকার নেই)। শুধু **Node 22.13+** চাই।

## Admin Panel hosting (same backend domain)

The Admin Panel is served directly by this backend. In this package, `public/admin/` and `public/assets/` are inside the `Backend/` folder. Upload the **contents** of `Backend/` to the Pterodactyl server root. Open:

- `https://YOUR_BACKEND_DOMAIN/admin`
- `https://YOUR_BACKEND_DOMAIN/admin/login` (same Admin SPA entry point)

The server serves the unchanged Admin HTML from `public/admin/` and its frontend assets from `public/assets/`. `MX_API_BASE` in `assets/js/shared/firebase-config.js` must remain an empty string so the Admin UI calls `/api/...` on the same origin. Keep `ADMIN_UID` configured in the hosting environment. Do not upload `.env`, Telegram session data, or `data/database.db` to GitHub.

## ১. Botkeep-এ ডিপ্লয়ের আগে চেক
```
node scripts/check-host.js
```
চারটা জিনিস দেখাবে: Node ভার্সন, SQLite চলে কিনা, Google-এ বাইরের কানেকশন (লগইন যাচাইয়ের জন্য **বাধ্যতামূলক**), মেমরি।
সার্ভার রিস্টার্ট দিয়ে আবার চালান: `check.db`-তে সংখ্যা ২ হলে ডিস্ক স্থায়ী। ১ থাকলে **ডিস্ক মুছে যায়**, তখন শুধু ব্যাকআপের ভরসায় থাকা বিপজ্জনক।

## ২. চালু করা
1. এই ZIP-এর `Backend/` ফোল্ডারের ভেতরের সব ফাইল Botkeep/Pterodactyl server root-এ আপলোড করুন (Node.js প্রজেক্ট, start কমান্ড: `npm start`)।
2. `.env.example` দেখে এনভায়রনমেন্ট ভ্যারিয়েবল দিন, বিশেষ করে `ALLOWED_ORIGINS` (আপনার সাইটের ঠিকানা), `TRUST_PROXY=1`।
3. Hosting Environment-এ `ADMIN_UID` দিন। Firebase Console → Authentication → Users থেকে Admin অ্যাকাউন্টের UID কপি করুন। এই UID-ই Admin Panel-এ প্রবেশ করতে পারবে। `ADMIN_UID` একই Main এবং Worker সার্ভারে দিন।
4. পুরনো Firebase ডাটা আনতে Firebase Console → Realtime Database → ⋮ → **Export JSON** করুন। তারপর Admin Panel → Settings → **Import Old JSON Data** থেকে JSON ফাইল আপলোড করুন। Import শুধু নতুন রেকর্ড/Season/Episode যোগ করে; আগের ডাটা বা Movie/Series metadata মুছে বা overwrite করে না। ভুল রেকর্ড বাদ পড়ে এবং Import Report দেখায়।
5. `Frontend/assets/js/shared/firebase-config.js`-এ `MX_API_BASE`-এ Backend URL বসানো আছে। Backend domain বদলালে Frontend-এর ওই মান আপডেট করে GitHub Pages-এ deploy করুন।
6. Firebase Authentication চালু রাখুন। Realtime Database আর মূল অ্যাপ ডাটাবেস হিসেবে প্রয়োজন নেই। আগে নিশ্চিত হোন নতুন সিস্টেম ঠিক চলছে।

## ৩. ব্যাকআপ (জরুরি)
- প্রতি `BACKUP_EVERY_HOURS` (ডিফল্ট ২৪) ঘণ্টায় অটো ব্যাকআপ, সর্বশেষ ৭টি লোকালি থাকে।
- Google Drive-এ পাঠাতে `.env`-এ `GDRIVE_*` দিন (১৫ GB, ৩০ দিন পর পুরনো মুছে যায়)।
- অ্যাডমিন হিসেবে লগইন করে ব্রাউজার কনসোলে `mxBackupDownload()` চালালে এখনই ডাউনলোড হবে।
- সপ্তাহে একবার ফাইল নিজের কম্পিউটারে নামিয়ে রাখুন। Botkeep ফ্রি প্ল্যানে ডাটা হারালে তারা দায়ী নন।

## ৪. কী বদলেছে (সংক্ষেপে)
| আগে | এখন |
|---|---|
| স্থায়ী কানেকশন, লাইভ লিসেনার | সাধারণ HTTPS রিকোয়েস্ট; ডাটা না বদলালে `304` (শূন্য ডাউনলোড) |
| সব ইউজার প্রতিবার পুরো `movies` ডাউনলোড | ETag + gzip, একই পাথে একটাই রিকোয়েস্ট |
| প্রেজেন্স: ৩০ সেকেন্ডে ২টা ডাটাবেস রাইট | প্রতি মিনিটে ১টা ছোট রিকোয়েস্ট, শুধু ট্যাব দেখা গেলে; ডিস্কে লেখা হয় না |
| progress প্রতি ৮ সেকেন্ডে | প্রতি ৩০ সেকেন্ডে |
| লাইভ আপডেট | ৬০ সেকেন্ডে পোল (ট্যাব দৃশ্যমান থাকলে), নিজের লেখার পর সাথে সাথে রিফ্রেশ |

## ৫. সীমাবদ্ধতা
- অন্য ইউজারের/অ্যাডমিনের পরিবর্তন দেখতে সর্বোচ্চ ~১ মিনিট লাগতে পারে (আগে সাথে সাথে)।
- সার্ভার ডাউন হলে সাইট ডাটা দেখাতে পারবে না (Firebase আগে আলাদা ছিল)। ক্যাটালগ স্ট্যাটিক ফাইলে রাখা পরের উন্নতি।
- `transaction()` ক্লায়েন্টে read-then-write; দুজন একসাথে একই কাউন্টার বাড়ালে একটি মিস হতে পারে। স্ট্যাটসের জন্য গ্রহণযোগ্য।
- Firebase Auth-এর ফ্রি লিমিট এখনো আছে (পাসওয়ার্ড রিসেট ইমেইল দিনে ১৫০টি)।

## ৬. টেস্ট
`npm test` (সার্ভার রুলস, Admin UID, JSON Merge Import, টোকেন যাচাই, ব্যাকআপ, রেট লিমিট ইত্যাদি)।

---

## ৭. মেইন সার্ভার + ওয়ার্কার সার্ভার (নতুন)
- **মেইন** (`ROLE=main`, ডিফল্ট): একমাত্র সার্ভার যেখানে আসল `database.db` থাকে। সব লেখা (write), অ্যাডমিন কাজ, ব্যাকআপ এখানে।
- **ওয়ার্কার** (`ROLE=worker`): মেইন থেকে মেইনের পাঠানো "বদল হয়েছে" সংকেত পেলেই শুধু *পরিবর্তনগুলো* টেনে (নিরাপত্তার জন্য ৬০ সেকেন্ডে একবার চেক) নিজের লোকাল কপি (SQLite) আপডেট রাখে। ইউজারের পড়ার রিকোয়েস্ট (মুভি লিস্ট ইত্যাদি) ওয়ার্কার নিজেই দ্রুত দেয়; লেখার রিকোয়েস্ট মেইনে পাঠিয়ে দেয়।
- নতুন ওয়ার্কার বানানো:
  1. অ্যাডমিন → Settings → **Servers & Backup** → নাম + ওয়ার্কারের URL দিয়ে *Add worker* → ওয়ার্কারের পাশের **Env** বাটনে চাপলে `WORKER_KEY` সহ পুরো এনভায়রনমেন্ট ব্লক দেখা ও কপি করা যায় (যেকোনো সময়, বারবার)। পুরনো ভার্সনে বানানো ওয়ার্কারের কী সংরক্ষিত নেই — সেটায় **New key** চাপুন।
  2. নতুন সার্ভারে **একই `Backend/` কোডের contents** আপলোড করে এই ভ্যারিয়েবলগুলো দিন: `ROLE=worker`, `MAIN_URL`, `WORKER_KEY`, `PUBLIC_URL`, `ADMIN_UID` (same UID as main), `FIREBASE_PROJECT_ID`, `ALLOWED_ORIGINS`, `TRUST_PROXY=1`, `PORT`, `DB_PATH`, `SYNC_EVERY_SEC`, `LOG_LEVEL` (Env বাটন সব একসাথে দেয়)। Start: `npm start`।
  3. ব্যস। ফ্রন্টএন্ডে কিছু বদলাতে হবে না: সাইট মেইনের `/api/servers` থেকে সচল ওয়ার্কারের তালিকা নেয়, সবচেয়ে দ্রুতটা বেছে নেয়। ওয়ার্কার বন্ধ থাকলে নিজে থেকেই মেইনে ফিরে যায়।
- মেইন ডাউন থাকলে ওয়ার্কার পুরনো কপি থেকে পড়া চালিয়ে যায় (লেখা কাজ করবে না)।
- মেইনের ডাটা রিস্টোর/বদল হলে ওয়ার্কার নিজে থেকে পুরো রিসিঙ্ক করে।

## ৮. টেলিগ্রাম ব্যাকআপ ও অটো-রিস্টোর (নতুন)
- প্রতি `BACKUP_EVERY_HOURS` (ডিফল্ট ১২) ঘণ্টায় অটো, অথবা অ্যাডমিন প্যানেলের **Backup now** বাটনে: `movex-<সময়>.db` ও `movex-<সময়>.json` চ্যানেলে যায়। সর্বশেষটা **পিন** করা থাকে (এটাই "latest" চিহ্ন), পুরনোগুলো `TG_KEEP` (ডিফল্ট ৩০)-এর বেশি হলে মুছে যায়।
- **বড় ফাইলের জন্য MTProto (API ID + API Hash) — সুপারিশ করা:**
  1. https://my.telegram.org → API development tools থেকে `api_id` ও `api_hash` নিন।
  2. সার্ভার ফোল্ডারে একবার `npm install` চালান (শুধু `telegram` প্যাকেজ নেয়)।
  3. দুইটার একটা পথ বেছে নিন:
     - **ইউজার সেশন (সহজ, প্রাইভেট চ্যানেলেও চলে):** `TG_API_ID=... TG_API_HASH=... npm run tg-login` চালিয়ে ফোন/কোড দিন → যে `TG_SESSION=...` ছাপা হবে সেটা `.env`-এ রাখুন (এটা গোপন রাখুন, এটা ওই অ্যাকাউন্টের লগইন)। অ্যাকাউন্টটিকে চ্যানেলের Admin (Post + Pin) করুন।
     - **বট টোকেন:** `TG_BOT_TOKEN` + `TG_API_ID` + `TG_API_HASH` দিন; `TG_CHAT_ID` হবে চ্যানেলের `@username` (পাবলিক চ্যানেল)। বটকে চ্যানেলে Admin করুন।
  4. এতে ২০MB ডাউনলোড সীমা থাকে না (প্রায় ২GB পর্যন্ত)।
- `TG_API_ID/HASH` না দিলে সাধারণ Bot API চলে (কোনো প্যাকেজ লাগে না), কিন্তু সীমা: আপলোড ৫০MB, **ডাউনলোড ২০MB**।
- সার্ভার নষ্ট হলে: নতুন হোস্টে কোড আপলোড করুন, একই `TG_*` ভ্যারিয়েবল দিন, `npm install`, `npm start`। ডাটাবেস **খালি** থাকলে সার্ভার নিজে পিন করা সর্বশেষ ব্যাকআপ থেকে `.db` (না পেলে `.json`) ইমপোর্ট করে চালু হয়। ডাটা থাকলে কখনো ওভাররাইট করে না।

## ৯. ব্রাউজার ক্যাশ ও পেজিনেশন (নতুন)
- **ক্যাশ:** ডাটা ব্রাউজারের IndexedDB-তে থাকে। রিফ্রেশে আগের ডাটা সাথে সাথে দেখায়, পেছনে শুধু ছোট `304` চেক যায়। লগআউটে ক্যাশ মুছে যায়।
- **হালকা মুভি লিস্ট:** `GET /api/db/movies?lite=1` শুধু কার্ডের তথ্য (নাম, পোস্টার, বছর...) দেয়, এপিসোড লিস্ট ও স্ট্রিম লিংক বাদে। ইউজার ও অ্যাডমিন টেবিল এটাই নেয়, ডাউনলোড অনেক ছোট।
- **মুভি খুললে** তখন শুধু ওই একটার পুরো তথ্য (এপিসোড + লিংক) আনা হয়। অ্যাডমিনে Edit চাপলেও তাই।
- **অসীম স্ক্রল:** Browse গ্রিড (২৪টা করে) ও সার্চ রেজাল্ট (২০টা করে) স্ক্রল করলে আরও লোড হয়, একসাথে সব DOM-এ আঁকে না।

## ১০. সার্ভার সেটিংস (শুধু Environment Variable থেকে)
সার্ভারের সেটিংস (`ALLOWED_ORIGINS`, `TRUST_PROXY`, ব্যাকআপ সময়/সংখ্যা, `TG_*` টেলিগ্রাম, `GDRIVE_*`) এখন **শুধু হোস্টের Environment Variable (বা `.env`)** থেকে বদলানো যায়। অ্যাডমিন প্যানেলে এগুলোর আলাদা সেকশন নেই। মান বদলালে সার্ভার রিস্টার্ট দিন। সব ভ্যারিয়েবলের তালিকা `.env.example`-এ আছে।


## Admin URLs
The admin panel is a single-page app served under `/admin/` and every screen has its own address (the server returns the panel for any `/admin/...` path, so refresh and bookmarks work):

| Screen | URL |
|---|---|
| Dashboard | `/admin/dashboard` |
| All movies | `/admin/movies` |
| Add movie | `/admin/movies/new` |
| Edit a movie | `/admin/movies/<id>/edit` |
| Banners | `/admin/banners` |
| Users | `/admin/users` |
| One user's details | `/admin/users/<uid>` |
| Settings | `/admin/settings` |
| Broken links | `/admin/broken-links` |


## ১০. কনসোল অ্যাক্টিভিটি লগ (নতুন)
মেইন ও ওয়ার্কার — দুই সার্ভারের কনসোলেই এখন A-to-Z লগ আসে। প্রতিটা লাইনে সময় ও ভূমিকা থাকে।
- `USER` — ইউজার/অ্যাডমিন প্রথম অ্যাক্টিভ হলে (এরপর ৩০ মিনিট চুপ থাকলে আবার)। `uid` ও `ip` সহ।
- `WRITE` — কেউ ডাটা লিখলে/মুছলে (শুধু পাথ, ভ্যালু কখনো না)। `(admin)` চিহ্ন থাকে অ্যাডমিন হলে।
- `ADMIN` — ব্যাকআপ, ডাউনলোড, JSON import, ওয়ার্কার যোগ/মোছা/Env দেখা/নতুন কী।
- `DENY` — ব্লক হওয়া রিকোয়েস্ট (401/403/429/400...)।
- `WORKER` — ওয়ার্কার অনলাইন/অফলাইন হলে (মেইনে)। `SYNC`, `PROXY` — ওয়ার্কারে সিঙ্ক ও মেইনে পাঠানো লেখা।
- `STAT` — প্রতি ৬০ সেকেন্ডে একটা সারাংশ: `reads`, `r304`, `writes`, `presence`, `static`, `denied`, `errors`, `syncPulls`... (ভারী ট্রাফিক শুধু গোনা হয়, আলাদা লাইন হয় না)।
- **ফ্লাড গার্ড:** ১০ সেকেন্ডে সর্বোচ্চ ৬০ লাইন; বেশি হলে "N lines hidden" লিখে বাকিটা শুধু STAT-এ গোনে।
- ওয়ার্কারে `uid` টোকেন থেকে পড়া হয় (যাচাই করে মেইন), তাই ওয়ার্কারের লগে uid শুধু তথ্যের জন্য।
- মেইন বন্ধ থাকলে ওয়ার্কারে `ERROR ... 502 main_unreachable` ও `sync failed` আসে (একই এরর বারবার ছাপা হয় না)।
- `LOG_LEVEL=quiet | normal | verbose` (ডিফল্ট `normal`)।
