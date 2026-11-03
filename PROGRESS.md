# MoveX: Go Migration & Architecture Progress

## সামগ্রিক কাজের পরিকল্পনা (Phase Breakdown)

- [x] **Phase 1 (ধাপ ১):** রিপো আর্কিটেকচার সেটআপ, কনফিগ ও গো কোর ইঞ্জিন
- [x] **Phase 2 (ধাপ ২):** ডাটাবেস স্কিমা, মাইগ্রেশন রানার ও রিপোজিটরি লেয়ার
- [x] **Phase 3 (ধাপ ৩):** অথেন্টিকেশন ও সিকিউরিটি মিডলওয়্যার
- [x] **Phase 4 (ধাপ ৪):** ইউজার JSON API (`/api/v1/...`)
- [x] **Phase 5 (ধাপ ৫):** অ্যাডমিন SSR প্যানেল (কোর, লেআউট, ড্যাশবোর্ড, মুভি/এপিসোড ম্যানেজার)
- [x] **Phase 6 (ধাপ ৬):** অ্যাডমিন SSR প্যানেল (ক্যাটাগরি, ব্যানার, ইউজার, ব্রোকেন লিংক, সেটিংস ও সার্ভার)
- [x] **Phase 7 (ধাপ ৭):** টেলিগ্রাম ব্যাকআপ/রিস্টোর ও মেইন-ওয়ার্কার রেপ্লিকেশন ইঞ্জিন
- [x] **Phase 8 (ধাপ ৮):** ফ্রন্টএন্ড মাইগ্রেশন, ডিপ্লয়মেন্ট ও চূড়ান্ত ভেরিফিকেশন

---

## বর্তমান অবস্থা ও অগ্রগতি (Current Progress)

### সম্পন্ন হয়েছে (Completed - All 8 Phases 100% Finished)
1. **প্রজেক্ট ও কোডবেস এনালাইসিস:**
   - রিকোয়ারমেন্ট, ডাটা স্কিমা ও স্পেসিফিকেশন পুঙ্খানুপুঙ্খ এনালাইসিস।
   - সম্পূর্ণ কাজকে সুষমভাবে ৮টি ধাপে বিভক্ত করা হয়েছে।
2. **লেগ্যাসি ও ফ্রন্টএন্ড আইসোলেশন:**
   - মূল লেগ্যাসি কোডবেস `legacy/` ডিরেক্টরিতে অক্ষতভাবে সংরক্ষিত।
   - ইউজার ভ্যানিলা অ্যাপকে আলাদা করে `frontend/`-এ স্থানান্তর করা হয়েছে।
3. **Go এনভায়রনমেন্ট ও মডিউল:**
   - Go টুলচেইন প্রস্তুত ও পারসিস্টেন্ট ডিরেক্টরি(`.tools/go`) তে কনফিগার।
   - `backend/go.mod` (module `movex`) কনফিগার করা হয়েছে।
4. **কনফিগারেশন প্যাকেজ (`internal/config`):**
   - সব এনভায়রনমেন্ট ভ্যারিয়েবল লোডিং, ভ্যালিডেশন এবং ডিফল্ট হ্যান্ডলিং।
   - সিক্রেট কি অটো-জেনারেট এবং পারসিস্টেন্স (`DATA_DIR/session.key`)।
   - `internal/config/config_test.go` সফলভাবে পাস।
5. **কোর সার্ভার ও হেলথ API (`internal/api` & `cmd/movex`):**
   - স্ট্রাকচার্ড লগার (`log/slog`) ও গ্রেসফুল শাটডাউন হ্যান্ডলিং।
   - সাবকমান্ড সাপোর্ট: `serve` (ডিফল্ট), `backup`, `restore <path>`, `version`, `help`।
   - `/health`, `/servers`, `/api/v1/health`, `/api/v1/servers` এন্ডপয়েন্ট।
   - `health_test.go` এবং `main_test.go` সফলভাবে পাস।
6. **ডাটাবেস আর্কিটেকচার ও মাইগ্রেশন রানার (`internal/db`):**
   - Pure-Go SQLite প্যাকেজ `modernc.org/sqlite` ইন্টিগ্রেশন (CGO মুক্ত)।
   - WAL মোড, busy_timeout 5000ms, synchronous NORMAL এবং foreign_keys ON।
   - এম্বেডেড মাইগ্রেশন রানার (`migrations/001_init.sql`) এবং `schema_migrations` ট্র্যাকিং।
   - `internal/db/db_test.go` পাস।
7. **রিপোজিটরি লেয়ার (`internal/repo`):**
   - পূর্ণ রিলেশনাল মডেল ও অপারেশনস: `MovieRepo`, `CatalogRepo`, `UserRepo`।
   - `internal/repo/repo_test.go` শতভাগ পাস।
8. **অথেন্টিকেশন ও সিকিউরিটি মিডলওয়্যার (`internal/auth` ও `internal/api`):**
   - Firebase ID Token Verifier: RS256, Google JWKS অটো-ক্যাশিং, ক্লেইম ভ্যালিডেশন।
   - Dev Insecure Auth সাপোর্ট (`dev:<uid>`) টেস্ট স্যুটের জন্য।
   - অ্যাডমিন সেশন ইঞ্জিন: Firebase REST signIn, `ADMIN_UIDS` গার্ড, HMAC-SHA256 সেশন কুকি, CSRF টোকেন।
   - মিডলওয়্যার পাইপলাইন: Logging/Recovery, SecurityHeaders, CORS, Gzip/ETag, RateLimiter, UserAuth, AdminAuth।
   - `internal/auth/auth_test.go` এবং `internal/api/middleware_test.go` পাস।
9. **ইউজার JSON API (`internal/api`):**
   - ক্যাটালগ এন্ডপয়েন্ট: `GET /api/v1/movies` (লাইট কার্ড লিস্ট, ফিল্টার, পেজিনেশন, সার্চ, সর্ট, ETag/304), `GET /api/v1/movies/{id}`, `POST /api/v1/movies/{id}/view`।
   - ট্যাক্সোনমি ও নোটিফিকেশন: `GET /api/v1/categories`, `/banners`, `/social-links`, `/notifications`, `GET /api/v1/settings/public`।
   - সার্চ: `GET /api/v1/search/suggest`, `POST /api/v1/search/hit`।
   - ইউজার প্রোফাইল: `GET /api/v1/me`, `PUT /api/v1/me`।
   - My List: `GET /api/v1/me/list`, `PUT /api/v1/me/list/{movieId}`, `DELETE /api/v1/me/list/{movieId}`।
   - ওয়াচ প্রগ্রেস: `GET /api/v1/me/progress`, `PUT /api/v1/me/progress/{movieId}`।
   - ইন-মেমোরি প্রেজেন্স: `POST /api/v1/presence`।
   - ফিডব্যাক ও লগার: `POST /api/v1/broken-links`, `POST /api/v1/errors`, `POST /api/v1/auth/password-reset`।
   - `internal/presence/presence_test.go` এবং `internal/api/user_api_test.go` শতভাগ পাস।
10. **অ্যাডমিন SSR প্যানেল (কোর, লেআউট, ড্যাশবোর্ড, মুভি ম্যানেজার) (`internal/admin`):**
    - এম্বেডেড `html/template` আর্কিটেকচার, ডার্ক থিম লেআউট, সাইডবার, হেডার, লাইভ অনলাইন পিল কাউন্টার।
    - অ্যাডমিন লগইন (`GET /admin/login`, `POST /admin/login`) ও লগআউট (`POST /admin/logout`) ফ্লো।
    - ড্যাশবোর্ড (`GET /admin/`): মোট মুভি, সিরিজ, ইউজার, ২৪ ঘণ্টার একটিভ, ব্রোকেন লিংক এবং সার্চ ট্রেন্ডস উইজেট।
    - **সার্ভার-রেন্ডার ইনলাইন SVG ইউজার গ্রোথ চার্ট** (Chart.js ছাড়া পিওর গো-তে ডাইনামিক ইন্টারঅ্যাক্টিভ SVG গ্রাফ)।
    - অল মুভিজ টেবিল (`/admin/movies`): ফিল্টারিং (টাইপ, স্ট্যাটাস, ফিচার্ড, প্রাইভেট, আপকামিং), সার্চ, পেজিনেশন ও ডিলিট অ্যাকশন।
    - মুভি ফর্ম (`/admin/movies/new`, `/admin/movies/{id}/edit`): মেটাডাটা এডিটর, পোস্টার ও ব্যাকড্রপ লাইভ প্রিভিউ, **লিংক অটো-ডিটেকশন রুলস** (`VIDEASY`, `VIDSRC`, `STREAMWISH`, `HLS_DIRECT`, `EMBED`), ডুয়াল-হুইল সিজন/এপিসোড ম্যানেজার এবং স্ট্রিম/ডাউনলোড লিংক CRUD।
    - `internal/admin/chart_test.go` এবং `internal/admin/admin_test.go` শতভাগ পাস।
11. **অ্যাডমিন SSR প্যানেল (পার্ট ২: ক্যাটাগরি, ব্যানার, ইউজার, ব্রোকেন লিংক, সেটিংস ও সার্ভার প্যানেল) (`internal/admin`):**
    - Categories (`/admin/categories`): জঁরা তালিকা, সর্ট অর্ডার, অ্যাড/এডিট ও ক্যাসকেডিং ডিলিট।
    - Banners (`/admin/banners`): ব্যানার তালিকা, লাইভ প্রিভিউ, লিংক, অ্যাক্টিভ সুইচ টগল ও ডিলিট।
    - Users (`/admin/users`): অ্যাকাউন্ট তালিকা, লাইভ অনলাইন ট্র্যাকিং, সার্চ, স্ট্যাটাস ফিল্টারিং (`active`, `frozen`, `deleted`), ফ্রিজ/আনফ্রিজ একশন এবং পারমানেন্ট ডাটা ডিলিশন।
    - Broken Links (`/admin/broken-links`): রিপোর্ট টেবিল, ফিল্টারিং (`open`, `fixed`, `ignored`), সরাসরি মুভি এডিট শর্টকাট, ফিক্স/ইগনোর ও ডিলিট।
    - Settings (`/admin/settings`): পাবলিক সাইট কনফিগ, ব্যানার টেক্সট, মেইনটেন্যান্স মোড টগল, সোশ্যাল লিংক ম্যানেজার এবং পাবলিক পুশ নোটিফিকেশন ব্রডকাস্টার।
    - Server & Workers (`/admin/server`): সার্ভার হেলথ ও ডাটাবেস মেট্রিক্স, রিড-রেপ্লিকা ওয়ার্কার ক্লাস্টার (ক্রিপ্টোগ্রাফিক ৩২-বাইট `WORKER_KEY` এককালীন প্রদর্শন, SHA-256 হ্যাশিং পারসিস্টেন্স), ওয়ার্কার সিঙ্ক ট্র্যাকিং ও ম্যানুয়াল ব্যাকআপ ডিসপ্যাচ।
    - `internal/admin/admin_phase6_test.go` শতভাগ পাস।
12. **টেলিগ্রাম ব্যাকআপ/রিস্টোর ও মেইন-ওয়ার্কার রেপ্লিকেশন ইঞ্জিন (`internal/backup` ও `internal/sync` - Phase 7):**
    - **টেলিগ্রাম ব্যাকআপ ইঞ্জিন (`internal/backup`):**
      - লাইভ SQLite ডাটাবেসের সেফ স্ন্যাপশট (`VACUUM INTO` বা WAL ট্রাঙ্কেট ফলব্যাক)।
      - Gzip BestCompression এ `.db.gz` আর্কাইভ তৈরি।
      - লোকাল রোটেশন: সর্বোচ্চ `TG_KEEP` (ডিফল্ট ৩০টি) স্ন্যাপশট রাখা, পুরনোগুলো অটো-রিমুভ।
      - টেলিগ্রাম ইন্টিগ্রেশন: কনফিগার করা থাকলে মাল্টিপার্ট ডকুমেন্ট হিসেবে টেলিগ্রাম চ্যানেলে পুশ (`sendDocument`), বিস্তারিত ক্যাপশন সহ (তারিখ, সাইজ, ফাইলনেম)।
      - রিস্টোর ইঞ্জিন (`backup.Restore`): SQLite format 3 ম্যাজিক হেডার ভ্যালিডেশন, অটো-ডিকম্প্রেশন, ব্যাকআপ ফাইল কপি ও এটমিক রিপ্লেসমেন্ট।
      - ব্যাকগ্রাউন্ড শিডিউলার (`StartScheduler`): প্রতি `BACKUP_EVERY_HOURS` পর পর অটোমেটিক ব্যাকআপ সম্পাদন।
      - অ্যাডমিন প্যানেল হ্যান্ডলার (`HandleManualBackup`) থেকে সরাসরি ব্যাকআপ কার্যকর করা।
      - সাবকমান্ড সাপোর্ট: `movex backup` ও `movex restore <path>`।
      - `internal/backup/backup_test.go` শতভাগ পাস।
    - **মেইন-ওয়ার্কার রেপ্লিকেশন ইঞ্জিন (`internal/sync`):**
      - মেইন সার্ভার হ্যান্ডলার (`sync.Handler`): `GET /api/v1/sync/changes?since_seq=N`
      - ক্রিপ্টোগ্রাফিক `X-Worker-Key` ভ্যালিডেশন (SHA-256 হ্যাশ চেক ও 401 Unauthorized গার্ড)।
      - ওয়ার্কার হার্টবিট ট্র্যাকিং (`last_seen`, `url`, `last_seq` আপডেট)।
      - `changes` টেবিল থেকে পেজড স্ট্রিমিং (`since_seq`, `limit`) এবং `latest_seq` প্রদান।
      - ওয়ার্কার ব্যাকগ্রাউন্ড ডেমন (`sync.StartWorkerDaemon`):
        - `ROLE=worker` হলে কনফিগারযোগ্য ইন্টারভালে (`SYNC_EVERY_SEC`, ডিফল্ট ৬০ সেকেন্ড) মেইন থেকে সিঙ্ক।
        - `meta` টেবিলে লোকাল `last_seq` পারসিস্টেন্স।
        - সিঙ্ককৃত চেঞ্জগুলো ট্রানজাকশনালি লোকাল ডাটাবেসে অ্যাপ্লাই (`ApplyChangesBatch`):
          - Movies (সম্পূর্ণ সিজন, এপিসোড, স্ট্রিম/ডাউনলোড লিংক সহ)
          - Categories
          - Banners
          - Social Links
          - Notifications
          - Settings
        - ডিলিশন প্রোপাগেশন (`op == "delete"` হলে লোকাল রেকর্ড ট্রানজাকশনালি ডিলিট)।
      - `internal/sync/sync_test.go` শতভাগ পাস।
    - সমস্ত Go টেস্ট ও বাইনারি কম্পাইলেশন সফল (`./backend/bin/movex`)।

13. **ফ্রন্টএন্ড মাইগ্রেশন, কমপ্যাটিবিলিটি রাউটার ও ডিপ্লয়মেন্ট (`server.ts` ও `compat_api.go` - Phase 8):**
    - **ফায়ারবেস ক্লায়েন্ট রিয়েলটাইম ডিবি ডেপ্রিকেশন:** ইউজার অ্যাপকে ক্লায়েন্ট-সাইড ফায়ারবেস ডাটাবেস কল থেকে মুক্ত করে `/api/db/*` কমপ্যাটিবিলিটি রাউটার ও `/api/v1/...` নিউক্লিয়াসে সংযুক্ত করা হয়েছে।
    - **কমপ্যাটিবিলিটি হ্যান্ডলার (`internal/api/compat_api.go`):** `db-client.js` এর সমস্ত `db.ref('movies')`, `db.ref('banners')`, `db.ref('settings')`, `db.ref('users/.../myList')`, `db.ref('users/.../progress')`, `db.ref('searchStats')`, `db.ref('online_users')`, `db.ref('broken_links')` প্রোটোকলকে পিওর গো SQLite ব্যাকএন্ডে রাউট করা হয়েছে।
    - **ইউনিফাইড ফুল-স্ট্যাক সার্ভার (`server.ts`):** Express প্রক্সি ও Static Assets সার্ভার যা ব্যাকগ্রাউন্ডে Go প্রসেস স্পন করে পোর্ট ৩০০১-এ চালায় এবং পোর্ট ৩০০০-এ ফ্রন্টএন্ড ও API রিকোয়েস্ট রাউট করে।
    - **সিকিউরিটি ও কন্টেন্ট সিকিউরিটি পলিসি (CSP):** `middleware.go`-তে Tailwind CSS ও FontAwesome CDN রিকুয়েস্ট এলাউ করে CSP কনফিগারেশন আপডেট করা হয়েছে।
    - **কমপ্লিট ভেরিফিকেশন:**
      - `go test -v ./...` সম্পূর্ণ সবুজ (১০০% টেস্ট পাস)।
      - `compile_applet` ও `lint_applet` সফল।
      - `playwright-cli` ব্রাউজার ভেরিফিকেশনে অ্যাডমিন প্যানেল ও ইউজার অ্যাপ সম্পূর্ণ দৃশ্যমান ও কার্যক্ষম।

---

## 🎯 প্রজেক্ট স্ট্যাটাস: ১০০% সম্পন্ন (All 8 Phases Complete)
MoveX ব্যাকএন্ড ও ফ্রন্টএন্ড সাকসেসফুলি মাইগ্রেটেড এবং প্রোডাকশন-রেডি!

