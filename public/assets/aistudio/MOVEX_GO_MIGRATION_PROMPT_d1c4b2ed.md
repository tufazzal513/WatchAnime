# MoveX: Frontend/Backend আলাদা করা + Backend Go-তে রিরাইট (সম্পূর্ণ হ্যান্ডঅফ প্রম্পট)

> ব্যবহার: নতুন চ্যাটে `ff165b21-WAnime-front-back_Aparthost_v2.3.zip` অ্যাটাচ করে এই পুরো লেখাটা পেস্ট করুন।
> আগের চ্যাটে সব আলোচনা শেষ হয়েছে এবং সিদ্ধান্ত চূড়ান্ত। **নতুন করে প্রশ্ন না করে সরাসরি কাজ শুরু করবে** (নিচের "কাজের ক্রম" অনুযায়ী)। শুধু তখনই থামবে যখন নিচে লেখা নেই এমন কোনো বড় সিদ্ধান্ত না নিলে এগোনো যায় না।

---

## ০. তোমার ভূমিকা ও কাজের নিয়ম

তুমি একজন সিনিয়র Go ব্যাকএন্ড ও ফুলস্ট্যাক ইঞ্জিনিয়ার। কাজ: নিচের স্পেক অনুযায়ী MoveX প্রজেক্টের ব্যাকএন্ড Node.js থেকে **Go**-তে সম্পূর্ণ নতুন করে লেখা, অ্যাডমিন প্যানেল ব্যাকএন্ডের ভেতরে (সার্ভার-সাইড রেন্ডারিং) আনা, এবং ফ্রন্টএন্ড আলাদা করে পরিষ্কার করা।

নিয়মসমূহ:
1. **টোকেন/সেশন শেষ হয়ে অন্য অ্যাকাউন্টে কাজ চালানো হতে পারে**, তাই রিপোর ভেতরে `PROGRESS.md` ফাইল রাখবে। প্রতিটি ধাপ শেষে এতে লিখবে: কী সম্পন্ন, কী বাকি, পরের ধাপ, সিদ্ধান্ত ও সমস্যা। নতুন সেশন শুরুতে এই ফাইল পড়ে সেখান থেকে চালিয়ে যাবে।
2. প্রতিটি বড় ধাপের শেষে টেস্ট চালাবে এবং পাস না হলে পরের ধাপে যাবে না।
3. পুরনো সিস্টেমের **কোনো ফিচার চুপচাপ বাদ দেবে না**। পুরনো কোড (বিশেষ করে `assets/js/admin/pages/*.js`, `admin/pages/*.html`, `server/src/*.js`) পড়ে প্রতিটি আচরণ পোর্ট করবে। বাদ যাওয়া ফিচার শুধু নিচের "বাদ" তালিকার।
4. UI-র ডিজাইন, রঙ, লেআউট অপরিবর্তিত থাকবে (`assets/css/admin/*`, `assets/css/user/*` পুনর্ব্যবহার)।
5. ব্যবহারকারীর সঙ্গে বাংলায় যোগাযোগ, কোড/কমেন্ট/কমিট ইংরেজিতে।
6. সিক্রেট (API key, token, session) কখনো লগ বা রিপোতে কমিট করবে না।
7. যেখানে অনিশ্চয়তা, সবচেয়ে সরল ও নিরাপদ বিকল্প বেছে `PROGRESS.md`-তে নোট রাখবে।

---

## ১. বর্তমান সিস্টেম (যা আছে)

প্রজেক্ট ফোল্ডার `movex/`:

```
movex/
├── index.html, pages/*.html, partials/*.html   ← ইউজার অ্যাপ (ভ্যানিলা HTML/JS, বিল্ড স্টেপ নেই)
├── admin/ (index.html, pages/*.html, partials/*.html)   ← অ্যাডমিন প্যানেল (ক্লায়েন্ট-সাইড, fetch করে include)
├── assets/css/{user,admin}/*.css
├── assets/js/{shared,user,admin}/...           ← সব স্ক্রিপ্ট এক গ্লোবাল স্কোপে, অর্ডার গুরুত্বপূর্ণ
├── server/ (Node 22 + node:sqlite, ~1300 লাইন, কোনো npm ডিপেন্ডেন্সি নেই)
│   └── src: app.js store.js auth.js rules.js backup.js telegram.js restore.js sync.js config.js index.js util.js
├── database.rules.json, FIREBASE-RULES.md, tools/cleanup-old-data.js, firebase.json
```

### পুরনো আর্কিটেকচার
- সার্ভারটি Firebase Realtime Database-এর নকল: `/api/db/<path>` দিয়ে পুরো JSON ট্রি পড়া/লেখা, SQLite-এ `docs(col,id,json,updated,seq)` টেবিল, `tomb` (ডিলিট ট্র্যাকিং), `colver`, `meta`, `workers`।
- `rules.js` পুরনো Firebase rules-এর পোর্ট। কোন পাথ কে পড়তে/লিখতে পারবে তা এখানে (`settings` পাবলিক পড়া; `movies, banners, categories, socialLinks, notifications, stats, searchStats` লগইন করা ইউজার পড়বে; অ্যাডমিন লিখবে; `users/<uid>` নিজে বা অ্যাডমিন; `online_users`, `broken_links` ইত্যাদি)।
- Firebase Auth দিয়ে লগইন/রেজিস্টার/পাসওয়ার্ড রিসেট। সার্ভার Google JWKS দিয়ে ID token (RS256) যাচাই করে।
- অ্যাডমিন চেনা হতো `settings/adminUIDs/<uid> == true` (ডাটাবেস থেকে, ক্লায়েন্ট থেকে পড়ে)।
- মেইন/ওয়ার্কার: ওয়ার্কার মেইন থেকে পরিবর্তন টেনে (seq ভিত্তিক) লোকাল কপি রাখে, পড়ার রিকোয়েস্ট নিজে দেয়, লেখা মেইনে ফরোয়ার্ড করে। মেইন `POST /api/notify` দিয়ে ওয়ার্কারকে জানায়। ফ্রন্টএন্ড `/api/servers` থেকে সচল ওয়ার্কারের তালিকা নিয়ে সবচেয়ে দ্রুতটা বেছে নেয়।
- ব্যাকআপ: টেলিগ্রাম চ্যানেলে `.db` ও `.json`, সর্বশেষটা পিন, পুরনো মুছে ফেলা, ডাটাবেস খালি থাকলে পিন করা ব্যাকআপ থেকে অটো-রিস্টোর।
- ক্লায়েন্ট ক্যাশ: IndexedDB, ETag/304, gzip, `?lite=1` হালকা মুভি লিস্ট, অসীম স্ক্রল (Browse ২৪টা করে, সার্চ ২০টা করে)।
- অ্যাডমিন সেটিংস প্যানেল (টেলিগ্রাম, ব্যাকআপ, Drive ইত্যাদি) ডাটাবেসে সেভ হতো।

### পুরনো ডাটার ধরন (ডামি ডাটা ছিল, মাইগ্রেশন লাগবে না)
`settings`, `movies` (সিজন/এপিসোড/স্ট্রিম ও ডাউনলোড লিংক সহ), `banners`, `categories`, `socialLinks`, `notifications`, `stats`, `searchStats`, `users/<uid>` (প্রোফাইল, `status`, `myList`, `progress`), `online_users`, `broken_links`, `analytics/errors`, `pwd_resets`।
প্রতিটির সঠিক ফিল্ড বের করতে পড়বে: `assets/js/admin/pages/movie-form.js`, `seasons-episodes.js`, `banners.js`, `classification.js`, `socials-notifications.js`, `users.js`, `broken-links.js`, `dashboard.js`, `link-detector.js`, `assets/js/shared/taxonomy.js`, `assets/js/shared/db-client.js`, ইউজার সাইডের `assets/js/user/**`, এবং `server/src/rules.js`, `database.rules.json`।

---

## ২. লক্ষ্য আর্কিটেকচার

```
movex/                       (একই গিট রিপো)
├── frontend/                ← শুধু ইউজার অ্যাপ, GitHub Pages-এ ডিপ্লয় (স্ট্যাটিক)
├── backend/                 ← Go: API + অ্যাডমিন (SSR) + SQLite + টেলিগ্রাম ব্যাকআপ + রেপ্লিকেশন
├── .github/workflows/pages.yml   ← frontend/ কে GitHub Pages-এ ডিপ্লয়
├── PROGRESS.md
└── README.md
```

### চূড়ান্ত সিদ্ধান্তসমূহ
| বিষয় | সিদ্ধান্ত |
|---|---|
| ভাষা | Go (সর্বশেষ স্টেবল, `go.mod`-এ নির্দিষ্ট) |
| অ্যাডমিন UI | সার্ভার-সাইড রেন্ডারিং: `html/template` + **htmx** (ফাইল রিপোতে, CDN নয়), সবকিছু `go:embed` দিয়ে বাইনারিতে |
| ইউজার Auth | Firebase Auth থাকবে (লগইন/রেজিস্টার/রিসেট)। Go-তে ID token যাচাই |
| অ্যাডমিন Auth | সার্ভার নিজে Firebase REST `accounts:signInWithPassword` ডাকে, `localId` (UID) `ADMIN_UIDS` env-এ থাকলে `HttpOnly` সেশন কুকি |
| ডাটাবেস | SQLite, **নতুন রিলেশনাল স্কিমা**, ড্রাইভার `modernc.org/sqlite` (pure Go, CGO নেই) |
| ব্যাকআপ | শুধু টেলিগ্রাম চ্যানেল, MTProto (`gotd/td`), ইউজার সেশন (অ্যাডমিন প্যানেল থেকে অটো-জেনারেট) |
| রেপ্লিকেশন | মেইন/ওয়ার্কার; শুধু পাবলিক ক্যাটালগ রেপ্লিকেট; ব্যক্তিগত ডাটা ও সব লেখা মেইনে |
| সেটিংস | সব env-এ; প্যানেল থেকে সেটিংস বদল নেই |
| ফ্রন্টএন্ড হোস্ট | GitHub Pages (আলাদা ডোমেইন) |
| ব্যাকএন্ড হোস্ট | Botkeep (Go binary/Dockerfile) এবং অন্য যেকোনো BPS/PaaS/VPS; শুধু `PORT` ও `DATA_DIR` দরকার |
| চার্ট | সার্ভারে রেন্ডার করা inline SVG (JS চার্ট লাইব্রেরি নয়) |
| রিপো | একই গিট রিপোতে `frontend/` ও `backend/` |

### বাদ দেওয়া ফিচার
- Google Drive ব্যাকআপ
- Firebase JSON ইমপোর্ট স্ক্রিপ্ট (`import-firebase-json.js`), `check-host.js`, `tools/cleanup-old-data.js`
- অ্যাডমিন প্যানেল থেকে সেটিংস বদল (Server Settings পেজ), `RESET_PANEL_SETTINGS`
- Firebase Realtime Database পুরোপুরি (ফ্রন্টএন্ডে `databaseURL`, `firebase-database` SDK সব সরবে)
- `database.rules.json`, `FIREBASE-RULES.md`, `firebase.json` (hosting)

---

## ৩. ব্যাকএন্ড কাঠামো (প্রস্তাবিত, প্রয়োজনে ঠিক করবে)

```
backend/
├── go.mod, go.sum
├── Dockerfile                 (multi-stage, scratch/distroless, non-root, CGO_ENABLED=0)
├── .env.example
├── cmd/movex/main.go          (এন্ট্রি; সাবকমান্ড: serve (ডিফল্ট), version)
├── internal/
│   ├── config/                (env পার্সিং + যাচাই + ডিফল্ট)
│   ├── db/                    (SQLite open, WAL, মাইগ্রেশন runner, migrations/*.sql embed)
│   ├── repo/                  (প্রতি এনটিটির কুয়েরি)
│   ├── auth/                  (Firebase JWT যাচাই, অ্যাডমিন সেশন কুকি, CSRF, rate limit)
│   ├── api/                   (ইউজার JSON API হ্যান্ডলার, middleware: CORS, gzip, ETag, logging, recover, rate-limit)
│   ├── admin/                 (SSR হ্যান্ডলার, templates/*.html, static/ (css, htmx, js), embed)
│   ├── replica/               (মেইন-সাইড sync/notify; ওয়ার্কার-সাইড puller + write-proxy)
│   ├── backup/                (snapshot, টেলিগ্রাম আপলোড/পিন/রিটেনশন/রিস্টোর, telegram login ফ্লো)
│   └── presence/              (ইন-মেমরি অনলাইন ইউজার)
└── *_test.go
```

নির্ভরতা কম রাখবে: stdlib `net/http` (Go 1.22+ ServeMux প্যাটার্ন), `modernc.org/sqlite`, `github.com/gotd/td`। JWT যাচাই stdlib `crypto/rsa` দিয়ে (পুরনো `auth.js`-এর মতো); আরও লাইব্রেরি লাগলে কারণ `PROGRESS.md`-তে লিখবে।

---

## ৪. Environment Variables (সব সেটিংস এখানে)

| Var | বিবরণ |
|---|---|
| `ROLE` | `main` (ডিফল্ট) বা `worker` |
| `PORT` | ডিফল্ট `3000` (প্ল্যাটফর্ম দিলে সেটাই) |
| `DATA_DIR` | ডিফল্ট `./data` (`movex.db`, `telegram.session`, `session.key` এখানে) |
| `FIREBASE_PROJECT_ID` | টোকেন `aud/iss` যাচাই |
| `FIREBASE_API_KEY` | অ্যাডমিন লগইন ও পাসওয়ার্ড রিসেটের জন্য Firebase REST |
| `ADMIN_UIDS` | কমা-বিভক্ত Firebase UID (শুধু মেইনে) |
| `ALLOWED_ORIGINS` | কমা-বিভক্ত (যেমন `https://user.github.io`); ইউজার API-র CORS |
| `TRUST_PROXY` | `1` হলে `X-Forwarded-For` মানবে |
| `COOKIE_SECURE` | ডিফল্ট `1`; লোকাল ডেভে `0` |
| `SESSION_SECRET` | না দিলে `DATA_DIR`-এ র‍্যান্ডম তৈরি করে সেভ করবে |
| `BACKUP_EVERY_HOURS` | ডিফল্ট `12` |
| `TG_API_ID`, `TG_API_HASH`, `TG_CHAT_ID` | টেলিগ্রাম MTProto |
| `TG_KEEP` | ডিফল্ট `30` |
| `MAIN_URL`, `WORKER_KEY`, `PUBLIC_URL`, `SYNC_EVERY_SEC` | শুধু ওয়ার্কার (`SYNC_EVERY_SEC` ডিফল্ট ৬০) |
| `DEV_INSECURE_AUTH` | শুধু টেস্ট; `dev:<uid>` টোকেন গ্রহণ করে। প্রোডাকশনে সেট থাকলে স্টার্টআপে প্যানিক |

`.env.example` সব ভ্যারিয়েবল সহ দেবে। স্টার্টআপে প্রয়োজনীয় env যাচাই করে স্পষ্ট ত্রুটি দেখাবে।

---

## ৫. ডাটাবেস স্কিমা (শুরুর প্রস্তাব; পুরনো ফিল্ড পড়ে চূড়ান্ত করবে)

SQLite: `PRAGMA journal_mode=WAL; synchronous=NORMAL; busy_timeout=5000; foreign_keys=ON`। মাইগ্রেশন: ক্রমিক `NNN_name.sql` ফাইল embed করে `schema_migrations` টেবিল দিয়ে অ্যাপ্লাই। সব টেবিলে `created_at`, `updated_at`।

**পাবলিক ক্যাটালগ (ওয়ার্কারে রেপ্লিকেট হবে):**
- `movies` (id, title, type, poster, backdrop, year, rating, overview, language, country, genres/tags, views, featured, status … পুরনো `movie-form.js` থেকে সব ফিল্ড)
- `seasons` (id, movie_id FK, number, title …), `episodes` (id, season_id FK, number, title, duration …)
- `stream_links` / `download_links` (id, movie_id বা episode_id, kind, quality, url, label, sort)
- `categories`, `movie_categories` (বহু-থেকে-বহু), `banners` (sort, movie_id বা custom link, active)
- `social_links`, `notifications`, `settings` (key/value; পাবলিক সেটিংস)

**মেইন-অনলি (ব্যক্তিগত/অপারেশনাল; রেপ্লিকেট নয়):**
- `users` (uid PK, email, name, avatar, status [active/blocked/deleted], created_at, last_seen)
- `my_list` (uid, movie_id, added_at), `watch_progress` (uid, movie_id, episode_id, t, d, updated_at)
- `broken_links` (id, movie_id, link_id, reporter_uid, note, status, created_at)
- `error_logs` (write-once, সাইজ লিমিট ৪০০০ বাইট), `search_stats` (term, count), `site_stats`
- `pwd_reset_attempts` (rate limiting; আগের `pwd_resets`-এর বদলে), `audit_log`
- `workers` (id, name, key_hash, url, created, last_seen), `meta` (k,v), `changes` (রেপ্লিকেশন লগ, §৯)
- অনলাইন presence ইন-মেমরি থাকবে (ডিস্কে লিখবে না, পুরনো আচরণ)।

সার্চের জন্য SQLite FTS5 (`movies_fts`) ব্যবহার করতে পারো (modernc সমর্থন করে); না পারলে `LIKE`।

---

## ৬. ইউজার JSON API (ফ্রন্টএন্ডের নতুন ডাটা লেয়ার)

বেস পাথ `/api/v1/...`। সব JSON, UTF-8, gzip, ক্যাটালগে ETag/`If-None-Match` → `304`। লগইন করা ইউজার `Authorization: Bearer <Firebase ID token>`।

| এন্ডপয়েন্ট | কে | বিবরণ |
|---|---|---|
| `GET /health` | সবাই | `{ok, role, seq}` |
| `GET /servers` | সবাই (মেইন) | সচল ওয়ার্কারের তালিকা |
| `GET /settings/public` | সবাই | পাবলিক সেটিংস |
| `GET /movies?lite=1&offset&limit&category&type&q&sort` | auth | হালকা কার্ড-লিস্ট, পেজিনেশন (Browse ২৪, সার্চ ২০) |
| `GET /movies/{id}` | auth | পুরো তথ্য (সিজন, এপিসোড, লিংক) |
| `GET /categories`, `/banners`, `/social-links`, `/notifications` | auth | ক্যাটালগ |
| `GET /search/suggest?q=`, `POST /search/hit` | auth | সার্চ স্ট্যাটস |
| `GET /me`, `PUT /me` | auth | প্রোফাইল; ইউজার নিজের `status` বদলাতে পারবে না (প্রথম `active` সেট ছাড়া) |
| `GET /me/list`, `PUT/DELETE /me/list/{movieId}` | auth | My List |
| `GET /me/progress`, `PUT /me/progress/{movieId}` | auth | প্রগ্রেস (প্রতি ৩০ সেকেন্ডে ক্লায়েন্ট পাঠায়) |
| `POST /presence` | auth | প্রতি মিনিটে, ট্যাব দৃশ্যমান থাকলে |
| `POST /broken-links` | auth | রিপোর্ট |
| `POST /errors` | auth | ক্লায়েন্ট এরর লগ (rate-limited, সাইজ সীমা) |
| `POST /auth/password-reset` | সবাই | সার্ভার Firebase `sendOobCode` ডাকে; আইপি+ইমেইল rate limit; ইউজার-এনুমারেশন এড়াতে সবসময় একই সফল উত্তর |
| `POST /movies/{id}/view` | auth | ভিউ কাউন্ট (rate-limited) |

নিয়ম: ব্লকড/ডিলিটেড ইউজার প্রতিটি অথ রিকোয়েস্টে `403`। প্রতিটি এন্ডপয়েন্টে ইনপুট ভ্যালিডেশন ও সাইজ লিমিট। রেট লিমিট ইন-মেমরি টোকেন-বাকেট (আইপি/uid ভিত্তিক)।

পুরনো `store`/`rules`-এর **সব আচরণ** (write-once এরর লগ, progress ফরম্যাট `t`,`d` বাধ্যতামূলক, myList মান যাচাই) নতুন এন্ডপয়েন্টে সমতুল্য ভ্যালিডেশন হিসেবে রাখবে।

---

## ৭. অথেন্টিকেশন ও সিকিউরিটি বিস্তারিত

### ৭.১ ইউজার (ফ্রন্টএন্ড → API)
- ফ্রন্টএন্ডে শুধু Firebase **Auth** SDK (compat) থাকবে; `getIdToken()` দিয়ে টোকেন নিয়ে Bearer হিসেবে পাঠাবে।
- Go যাচাই: `alg=RS256`, `kid` আছে; Google JWKS (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) ক্যাশ (`Cache-Control max-age` মেনে); অজানা `kid` হলে সর্বোচ্চ মিনিটে ১ বার রিফেচ; `exp`, `iat` (≤ now+300s), `aud == FIREBASE_PROJECT_ID`, `iss == https://securetoken.google.com/<project>`, `sub` অ-খালি ও ≤১২৮ অক্ষর। যাচাই-ফল ছোট টিটিএল ক্যাশ (≤১০ মিনিট বা টোকেন `exp`)।

### ৭.২ অ্যাডমিন (SSR)
1. `GET /admin/login` ইমেইল/পাসওয়ার্ড ফর্ম।
2. `POST /admin/login`: সার্ভার `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$FIREBASE_API_KEY` ডাকে → `localId`, `idToken`।
3. `localId ∈ ADMIN_UIDS` না হলে "Access Denied", কোনো সেশন নয়।
4. সেশন: স্বাক্ষরিত (HMAC-SHA256, `SESSION_SECRET`) কুকি `mx_admin`: `HttpOnly; Secure; SameSite=Strict (বা Lax); Path=/admin`, মেয়াদ ১২ ঘণ্টা। প্রতিবার UID-র `ADMIN_UIDS` সদস্যতা চেক (env বদলালে সাথে সাথে বাতিল)।
5. **CSRF:** প্রতিটি POST/PUT/DELETE-এ সেশন-বাঁধা CSRF টোকেন (ফর্মে hidden ও htmx হেডারে `X-CSRF-Token`) + `Origin/Sec-Fetch-Site` চেক।
6. লগইন rate limit: আইপি ও ইমেইল ভিত্তিক (যেমন ১০ মিনিটে ৮ বার), ইউজার-এনুমারেশন নয় (একই বার্তা)।
7. লগআউট: কুকি মুছে ফেলা। অ্যাডমিন রেসপন্সে `Cache-Control: no-store`, কঠোর CSP (`default-src 'self'`; inline script নয়; `frame-ancestors 'none'`), `X-Content-Type-Options`, `Referrer-Policy`।
8. অ্যাডমিন রুট শুধু `ROLE=main`-এ; ওয়ার্কারে ৪০৪।
9. অ্যাডমিন অ্যাকশনের অডিট লগ (কে, কী, কখন) `audit_log` টেবিলে।

### ৭.৩ সাধারণ
- CORS: কেবল `ALLOWED_ORIGINS` (ইউজার API); অ্যাডমিন রুটে CORS বন্ধ।
- কুয়েরি সর্বদা প্যারামিটারাইজড; `html/template`-এর অটো-এস্কেপ; ইউজার-ইনপুট রেন্ডারে কখনো `template.HTML` নয়।
- `http.Server` টাইমআউট (Read/Write/Idle), বডি সাইজ লিমিট, graceful shutdown (SIGTERM)।
- স্ট্রাকচার্ড লগ (`log/slog`), টোকেন/PII লগ নয়।
- মেইন/ওয়ার্কার ইন্টার-সার্ভার রিকোয়েস্ট `WORKER_KEY` (হ্যাশ করে সংরক্ষিত, constant-time compare)।

---

## ৮. অ্যাডমিন প্যানেল (SSR) পেজ তালিকা

পুরনো `admin/pages/*` ও `assets/js/admin/pages/*` পড়ে প্রতিটি ফিচার অক্ষত রাখবে। সাইডবার/হেডার/বটম-নেভ পার্শিয়াল থেকে লেআউট টেমপ্লেট (`base.html`) বানাবে। htmx দিয়ে ফর্ম সাবমিট/টেবিল রিফ্রেশ/মডাল/ইনলাইন এডিট।

| রুট | বিষয়বস্তু |
|---|---|
| `/admin/login`, `/admin/logout` | অথ |
| `/admin/` Dashboard | মোট মুভি/ইউজার/অনলাইন/ভিউ কার্ড; সার্চ স্ট্যাটস; **ইউজার গ্রোথ চার্ট (সার্ভার-রেন্ডার SVG)**; সাম্প্রতিক এরর/ব্রোকেন লিংক |
| `/admin/movies/new`, `/admin/movies/{id}/edit` | মুভি ফর্ম: সব মেটাডেটা, ক্যাটাগরি/ট্যাক্সোনমি (`taxonomy.js` পোর্ট), পোস্টার/ব্যাকড্রপ প্রিভিউ, সিজন/এপিসোড ম্যানেজার (যোগ/সম্পাদনা/ডিলিট/ক্রম), স্ট্রিম ও ডাউনলোড লিংক ম্যানেজার, লিংক-ডিটেক্টর (`link-detector.js` এর লজিক) |
| `/admin/movies` (All Movies) | সার্চ, ফিল্টার, সর্ট, পেজিনেশন, বাল্ক অ্যাকশন |
| `/admin/categories` (Classification) | ক্যাটাগরি CRUD, সর্ট |
| `/admin/banners` | ব্যানার CRUD + সর্ট |
| `/admin/users` | তালিকা, সার্চ, ফিল্টার, স্ট্যাটাস বদল (block/unblock/delete), ইউজারের My List/প্রগ্রেস দেখা, অনলাইন ইন্ডিকেটর |
| `/admin/broken-links` | রিপোর্ট তালিকা, সমাধান/মুছে ফেলা, মুভি এডিটে লিংক |
| `/admin/settings` | সোশ্যাল লিংক, নোটিফিকেশন (পাঠানো/মুছা), পাবলিক সাইট সেটিংস (`settings` টেবিল) |
| `/admin/server` | ওয়ার্কার যোগ (নাম+URL → একবার `WORKER_KEY` দেখানো)/মুছা/স্ট্যাটাস; ব্যাকআপ স্ট্যাটাস; **Backup now**; **Restore** (কনফার্মেশন সহ); **Telegram Login**; **Test Telegram**; env-এর পড়ার-মাত্র সারসংক্ষেপ (সিক্রেট কখনো নয়) |

অ্যাডমিনের সব ডাটা পরিবর্তনে রেপ্লিকেশন `changes` লগ আপডেট ও ওয়ার্কারদের notify হবে।

---

## ৯. রেপ্লিকেশন ডিজাইন (মেইন ↔ ওয়ার্কার)

**লক্ষ্য:** ইউজারের পড়ার রিকোয়েস্ট (ক্যাটালগ) ওয়ার্কার দ্রুত দেবে; লেখা ও ব্যক্তিগত ডাটা মেইনে।

- **রেপ্লিকেটেড টেবিল:** `movies, seasons, episodes, stream/download_links, categories, movie_categories, banners, social_links, notifications, settings(public)`।
- **মেইনে `changes` টেবিল:** `seq INTEGER PRIMARY KEY AUTOINCREMENT, tbl, row_id, op ('upsert'|'delete'), ts`। প্রতিটি লেখার একই ট্রানজাকশনে লগ যোগ (ট্রিগার বা repo স্তরে; যেটা কম ভুলপ্রবণ)।
- **`GET /internal/sync?since=<seq>&limit=N`** (মেইন, `X-Worker-Key` হেডার): `since`-এর পরের পরিবর্তন পুরো রো (upsert) বা id (delete) সহ + `epoch` (মেইনের `meta.epoch`, রিস্টোর/রিসেটে বদলায়) + `max_seq`। ওয়ার্কারের `epoch` না মিললে বা `since` ছাঁটাই-করা `changes`-এর চেয়ে পুরনো হলে **ফুল রিসিঙ্ক**।
- **`POST /internal/notify`** (ওয়ার্কারে, `X-Notify` হেডার): মেইন লেখার পর ডিবাউন্স করে (~৩০০ms) সব ওয়ার্কারকে ডাকে (৩ সেকেন্ড টাইমআউট, ব্যর্থতা অগ্রাহ্য)। ওয়ার্কার সংকেত পেলে সাথে সাথে pull করে; নিরাপত্তায় প্রতি `SYNC_EVERY_SEC` সেকেন্ডে পোল।
- **ওয়ার্কারের লোকাল DB:** রেপ্লিকেটেড টেবিল + `meta`। পুরো আপডেট এক ট্রানজাকশনে।
- **রাউটিং ওয়ার্কারে:** ক্যাটালগ GET নিজে দেয় (মেইন ডাউন থাকলেও পুরনো কপি থেকে); বাকি সব (`/me/*`, লেখা, presence, broken-links, errors, search hit, view) **মেইনে প্রক্সি** (হেডার/টোকেন সহ, `X-Forwarded-For` ঠিক রেখে)। মেইন ডাউন হলে লেখায় `503`।
- **ডিসকভারি:** মেইন `/api/v1/servers` দেয় সচল ওয়ার্কারের `{name,url}` (`last_seen` সাম্প্রতিক); ফ্রন্টএন্ড `/health` লেটেন্সিতে সবচেয়ে দ্রুতটা বেছে নেয়, ব্যর্থ হলে মেইনে ফেরে।
- `changes` ছাঁটাই: সর্বশেষ ~১ লাখ বা ৩০ দিন রাখবে।
- `ROLE=worker` হলে ব্যাকআপ/অ্যাডমিন/টেলিগ্রাম বন্ধ।

---

## ১০. টেলিগ্রাম ব্যাকআপ ও রিস্টোর (MTProto, ইউজার সেশন)

**কনফিগ:** env `TG_API_ID`, `TG_API_HASH`, `TG_CHAT_ID` (চ্যানেলের `-100…` আইডি বা `@username`)। সেশন `DATA_DIR/telegram.session` ফাইলে (পারমিশন `0600`)। সেশন কখনো DB বা ব্যাকআপে যাবে না।

**লগইন ফ্লো (অ্যাডমিন `/admin/server`):** ফোন নম্বর → (কোড টেলিগ্রামে আসে) কোড ইনপুট → দরকারে 2FA পাসওয়ার্ড → সফল হলে সেশন ফাইলে সেভ, স্ট্যাটাস "Connected as <name>"। মাঝের অবস্থা (phone_code_hash) ইন-মেমরি। ব্যর্থতায় স্পষ্ট বার্তা। "Logout/Reset session" বাটন। অ্যাকাউন্টটিকে চ্যানেলের অ্যাডমিন (Post + Pin) করতে হবে, UI-তে নির্দেশনা দেখাবে।

**ব্যাকআপ:**
1. শিডিউল প্রতি `BACKUP_EVERY_HOURS` ঘণ্টা + **Backup now**।
2. SQLite `VACUUM INTO` দিয়ে সামঞ্জস্যপূর্ণ স্ন্যাপশট (লাইভ DB লক না করে) → gzip → `movex-<UTC-timestamp>.db.gz`।
3. চ্যানেলে ডকুমেন্ট হিসেবে আপলোড (ক্যাপশনে: সময়, স্কিমা ভার্সন, সাইজ, রো-কাউন্ট, SHA-256)। MTProto-তে বড় ফাইল (~২GB পর্যন্ত)।
4. আপলোড সফল হলে সেটিই **পিন** (আগের পিন সরিয়ে, "latest" চিহ্ন)।
5. রিটেনশন: `TG_KEEP`-এর বেশি পুরনো ব্যাকআপ মেসেজ মুছে ফেলা।
6. ব্যর্থতায় সীমিত exponential retry, শেষ ত্রুটি অ্যাডমিন পেজে; একই সময়ে একটির বেশি ব্যাকআপ চলবে না (mutex)।

**রিস্টোর:**
- **অটো:** স্টার্টআপে মেইনের DB **খালি/নতুন** (কোনো মুভি/ইউজার রো নেই, `meta.initialized` নেই) এবং টেলিগ্রাম সেশন+env আছে → পিন করা সর্বশেষ ব্যাকআপ ডাউনলোড → gunzip → **যাচাই** (SQLite খুলে `PRAGMA integrity_check`, স্কিমা ভার্সন ≤ বর্তমান, প্রয়োজনীয় টেবিল) → অ্যাটমিক রিপ্লেস (টেম্প ফাইল → rename; পুরনোটা `.bak`) → মাইগ্রেশন চালিয়ে বর্তমান স্কিমায় আপগ্রেড → `meta.epoch` নতুন (ওয়ার্কাররা ফুল রিসিঙ্ক করবে)।
- **অটো মোডে ডাটা থাকা DB কখনো ওভাররাইট করবে না।**
- **ম্যানুয়াল:** অ্যাডমিন **Restore** বাটন, কনফার্মেশন (টাইপ করে "RESTORE"), রিস্টোরের আগে বর্তমান DB-র স্থানীয় `.bak` স্ন্যাপশট।
- নতুন সার্ভারে প্রবাহ: env দাও → চালু (DB খালি) → `/admin`-এ লগইন (UID env থেকে, DB লাগে না) → Telegram Login একবার → অটো-রিস্টোর (বা Restore বাটন)।
- সীমাবদ্ধতা (README-তে লিখবে): `DATA_DIR` স্থায়ী না হলে `telegram.session` হারায়; তখন আবার লগইন লাগবে।

লাইব্রেরি: `github.com/gotd/td` (ফাইল-ভিত্তিক সেশন স্টোরেজ, uploader/downloader/message হেল্পার)। FloodWait হ্যান্ডলিং রাখবে। টেস্টের জন্য টেলিগ্রাম ক্লায়েন্ট ইন্টারফেসের পেছনে রাখবে যাতে মক করা যায়।

---

## ১১. ফ্রন্টএন্ড (ইউজার অ্যাপ) পরিবর্তন

`frontend/`-এ সরাবে: `index.html`, `pages/`, `partials/`, `assets/css/user`, `assets/js/user`, `assets/js/shared` (প্রয়োজনীয় অংশ)। `admin/`, `assets/*/admin`, অ্যাডমিন-সম্পর্কিত শেয়ার্ড কোড সরিয়ে ফেলবে।

- `assets/js/shared/config.js` (নতুন): `window.MX = { API_BASE: "...", FIREBASE: { apiKey, authDomain, projectId, appId } }` (**RTDB-র `databaseURL`, `storageBucket`, `messagingSenderId` সরবে**)।
- Firebase Database SDK স্ক্রিপ্ট ট্যাগ সরাবে; শুধু `firebase-app-compat` + `firebase-auth-compat`।
- `db-client.js` পুরোপুরি নতুন API ক্লায়েন্টে পাল্টাবে (fetch wrapper: Bearer টোকেন অটো, টোকেন রিফ্রেশ, `401`-এ একবার রিট্রাই, ETag/IndexedDB ক্যাশ, ওয়ার্কার/মেইন রাউটিং ও ফেইলওভার, লগআউটে ক্যাশ মুছা)। পুরনো `db.ref().once/on/set/update/transaction` কল সব ইউজার সাইডের `core/`, `features/`, `pages/` ফাইল থেকে নতুন ফাংশনে বদলাবে (গ্রেপ করে সব ব্যবহার খুঁজবে)।
- আচরণ অক্ষত: হালকা লিস্ট, অসীম স্ক্রল, ক্যাশ-ফার্স্ট রেন্ডার, ৬০ সেকেন্ড পোল (ট্যাব দৃশ্যমান), নিজের লেখার পর রিফ্রেশ, প্রগ্রেস ৩০ সেকেন্ড, presence ১ মিনিট।
- `partials/auth.html`, `core/auth.js`, `features/auth-forms.js`: Firebase Auth ফ্লো একই; পাসওয়ার্ড রিসেট এখন `POST /api/v1/auth/password-reset`।
- GitHub Pages: রিপো-পাথ সাবডিরেক্টরি (`/repo-name/`) হলে সব পাথ আপেক্ষিক রাখো; `.nojekyll`; `.github/workflows/pages.yml` দিয়ে `frontend/` ডিপ্লয়।
- README-তে ফ্রন্টএন্ডের `API_BASE` বসানোর নির্দেশ।

---

## ১২. ডিপ্লয়মেন্ট

**বাইনারি:** `CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o movex ./cmd/movex`। সব টেমপ্লেট/স্ট্যাটিক/মাইগ্রেশন `embed`। এক ফাইলেই চলবে।

**Dockerfile:** multi-stage (`golang:<ver>-alpine` বিল্ড → `gcr.io/distroless/static` বা `scratch` + CA সার্টিফিকেট + tzdata), non-root, `PORT` env মানে, `VOLUME /data`, `HEALTHCHECK` (`/api/v1/health`)।

**প্ল্যাটফর্ম:** Botkeep (বাইনারি বা Dockerfile), অন্য BPS/PaaS/VPS-এ একইভাবে; `PORT` দিলে সেটাই শোনে, `0.0.0.0`-এ বাইন্ড; `DATA_DIR` স্থায়ী ডিস্কে। README-তে: Botkeep, Docker, systemd সার্ভিস ফাইল (নমুনা), রিভার্স প্রক্সি (`TRUST_PROXY`) উদাহরণ।

---

## ১৩. টেস্ট (Go, `go test ./...`)

পুরনো `server/test/server.test.js` ও `cluster.test.js` পড়ে সমতুল্য কেস পোর্ট করবে এবং নতুনগুলো যোগ করবে:
- JWT যাচাই (বৈধ/মেয়াদোত্তীর্ণ/ভুল aud/iss/kid/alg/স্বাক্ষর; fake JWKS সার্ভার)।
- প্রতিটি API এন্ডপয়েন্টের অথরাইজেশন ম্যাট্রিক্স (অথ নেই/ইউজার/অন্য ইউজার/ব্লকড/অ্যাডমিন)।
- ভ্যালিডেশন ও সীমা (progress, my_list, errors write-once/সাইজ)।
- অ্যাডমিন লগইন (fake Firebase REST), `ADMIN_UIDS`-বহির্ভূত UID প্রত্যাখ্যান, সেশন মেয়াদ, CSRF প্রত্যাখ্যান, rate limit।
- মুভি CRUD + সিজন/এপিসোড/লিংক ক্যাসকেড, `changes` লগ।
- রেপ্লিকেশন: মেইন+ওয়ার্কার `httptest` দিয়ে (incremental, delete, epoch পরিবর্তনে ফুল রিসিঙ্ক, লেখা প্রক্সি, মেইন ডাউনে পড়া চলে)।
- ব্যাকআপ/রিস্টোর: মক টেলিগ্রাম ক্লায়েন্টে (স্ন্যাপশট, রিটেনশন, পিন, অটো-রিস্টোর শুধু খালি DB-তে, অবৈধ ফাইল প্রত্যাখ্যান)।
- মাইগ্রেশন runner (আইডেম্পোটেন্ট)।
- `-race` দিয়ে চালাও, `go vet`, সম্ভব হলে `staticcheck`।
- ফ্রন্টএন্ড/অ্যাডমিন: লোকাল সার্ভার চালিয়ে Playwright দিয়ে অন্তত লগইন, মুভি যোগ, ইউজার API স্মোক টেস্ট ও স্ক্রিনশট যাচাই।

---

## ১৪. কাজের ক্রম (প্রতি ধাপ শেষে টেস্ট + `PROGRESS.md` আপডেট)

1. **রিপো কাঠামো:** `frontend/`, `backend/` ভাগ, `go.mod`, কনফিগ, লগিং, graceful HTTP সার্ভার, `/health`, মাইগ্রেশন runner। পুরনো `server/` কপি `legacy/`-এ (রেফারেন্সের জন্য; শেষে মুছে ফেলার প্রস্তাব দেবে)।
2. **স্কিমা + রিপোজিটরি স্তর:** পুরনো ডাটা শেপ পড়ে চূড়ান্ত স্কিমা, `001_init.sql`, repo ফাংশন + টেস্ট।
3. **Auth ইঞ্জিন:** Firebase JWT যাচাই, middleware (auth, admin, CORS, gzip, ETag, rate limit, recover, logging)।
4. **ইউজার API (§৬)** সম্পূর্ণ + টেস্ট।
5. **অ্যাডমিন SSR (§৮):** লগইন/সেশন/CSRF → লেআউট → ড্যাশবোর্ড → মুভি (সিজন/এপিসোড/লিংক) → All Movies → Categories → Banners → Users → Broken Links → Settings। পুরনো প্রতিটি পেজের সাথে ফিচার-সমতার চেকলিস্ট `PROGRESS.md`-তে।
6. **টেলিগ্রাম ব্যাকআপ/রিস্টোর (§১০)** + অ্যাডমিন `/admin/server` UI।
7. **রেপ্লিকেশন (§৯)** + ওয়ার্কার ম্যানেজমেন্ট UI।
8. **ফ্রন্টএন্ড মাইগ্রেশন (§১১):** নতুন API ক্লায়েন্ট, RTDB সরানো, GitHub Pages ওয়ার্কফ্লো।
9. **হার্ডেনিং ও ডেলিভারি:** Dockerfile, `.env.example`, README (বাংলা, ধাপে ধাপে ডিপ্লয় নির্দেশনা), `legacy/`, `database.rules.json`, `FIREBASE-RULES.md` মুছে ফেলা (ব্যবহারকারীর সম্মতিতে), পূর্ণ টেস্ট ও Playwright স্মোক, চূড়ান্ত সিকিউরিটি রিভিউ (§৭ চেকলিস্ট)।

---

## ১৫. সম্পন্নের সংজ্ঞা

- `backend/` একটি কমান্ডে বিল্ড ও চালু হয়; `go test -race ./...` পাস।
- অ্যাডমিন প্যানেল পুরনোটার সব ফিচার দেয়, UI একই চেহারার, শুধু `/admin` (ব্যাকএন্ড ডোমেইন) থেকে সার্ভ হয়।
- `frontend/` শুধু স্ট্যাটিক ফাইল; কোনো অ্যাডমিন কোড বা Firebase RTDB কনফিগ নেই; GitHub Pages-এ চলে।
- খালি ডাটাবেস + env + টেলিগ্রাম লগইন → ব্যাকআপ থেকে সম্পূর্ণ রিস্টোর কাজ করে (টেস্টে প্রমাণিত)।
- ওয়ার্কার চালু করে ক্যাটালগ সিঙ্ক ও লেখা ফরোয়ার্ডিং কাজ করে (টেস্টে প্রমাণিত)।
- README: লোকাল চালানো, env তালিকা, Botkeep/Docker/VPS ডিপ্লয়, ওয়ার্কার যোগ, টেলিগ্রাম সেটআপ, রিস্টোর, GitHub Pages সেটআপ, সীমাবদ্ধতা।
- চূড়ান্ত বার্তায় ব্যবহারকারীকে বাংলায় সংক্ষিপ্ত সারাংশ: কী তৈরি হলো, কীভাবে চালাবে, কোন সিদ্ধান্ত তুমি নিজে নিয়েছিলে (`PROGRESS.md` থেকে), বাকি কী আছে।
