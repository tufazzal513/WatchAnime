# WatchAnime (`watchanime.cyou`)

Production-ready Netflix-style Movie, Anime, Web Series & TV Series Streaming Platform.

## 🚀 Key Features

- **Netflix-Style Dark UI:** High-fidelity hero banner, horizontal scrolling rows, movie badges (HD, SUB, DUB, Rating).
- **Dual Language Support:** Full Bengali (বাংলা) and English UI with persistent local preferences.
- **Firebase Authentication:** Google 1-Click Sign-In, Email & Password Registration/Login, Forgot Password reset flow.
- **Cloud Firestore Storage:** Real-time user watchlist (`users/{uid}/watchlist`) and continue-watching history (`users/{uid}/history`).
- **Secure Embedded Video Player:**
  - Multiple streaming servers selector (Server 1 HD, Server 2 Backup).
  - Sub / Dub labels.
  - Episode-to-episode auto-play & navigation (Next / Prev).
  - Broken link reporting modal directly linked to Firestore.
- **Search & Discovery:** Debounced instant title search with Category, Genre, and Rating filters.
- **Mobile-First Design:** Fully responsive layout with bottom navigation bar for Android/iOS mobile devices.
- **PWA Ready:** Web app manifest (`manifest.json`) and Service Worker (`sw.js`) for installable mobile app experience.
- **Complete Admin Panel (`/admin`):**
  - Real-time metrics from database.
  - Content Manager: Full CRUD for Movies, Anime & Series.
  - Episode & Video Server Manager: Add/edit episode embed URLs.
  - User Requests & Broken Reports Moderation.
  - Banner Advertising & Site Configuration.
  - JSON Backup Export & Import.
  - 1-Click Catalog Seeder.
- **SEO & Legal Compliance:** JSON-LD Schema structured data, `sitemap.xml`, `robots.txt`, DMCA Copyright Takedown Policy, Terms of Service, Privacy Policy.

---

## 🌐 GitHub Pages-এ সম্পূর্ণ ফ্রি হোস্টিং নির্দেশিকা (100% Free Hosting)

এই প্রজেক্টটি **GitHub Pages**-এ সরাসরি হোস্ট করার জন্য সম্পূর্ণ প্রস্তুত করা হয়েছে:
- `vite.config.ts`-এ `base: './'` সেট করা হয়েছে, যাতে কোনো সাবপাথ বা কাস্টম ডোমেইনে কোনো এসেট মিস না হয়।
- `.github/workflows/deploy.yml` GitHub Actions ফাইলটি যুক্ত করা হয়েছে, যাতে আপনি GitHub-এ কোড পুশ করলেই স্বয়ংক্রিয়ভাবে বিল্ড হয়ে সাইট লাইভ হয়ে যায়।
- `public/404.html` SPA রাউটিং হ্যান্ডলার যুক্ত আছে যাতে পেজ রিফ্রেশ করলেও 404 এরর না আসে।
- `public/CNAME`-এ `watchanime.cyou` কনফিগার করা আছে।

### ১. GitHub-এ কোড পুশ করুন
1. [github.com](https://github.com)-এ একটি নতুন Repository তৈরি করুন (যেমন: `watchanime`).
2. আপনার প্রোজেক্টের সমস্ত ফাইল ওই রিপোজিটরিতে পুশ বা আপলোড করুন।

### ২. GitHub Pages অ্যাক্টিভেশন
1. আপনার GitHub Repository-এর **Settings** ট্যাবে যান।
2. বাম পাশের মেনু থেকে **Pages** নির্বাচন করুন।
3. **Build and deployment** সেকশনের **Source** ড্রপডাউনে **GitHub Actions** নির্বাচন করুন।
4. ব্যস! `.github/workflows/deploy.yml` স্বয়ংক্রিয়ভাবে আপনার সাইটটি বিল্ড করে GitHub Pages-এ লাইভ করে দেবে।
5. আপনার সাইটটি `https://<username>.github.io/<repo-name>/` ঠিকানায় দেখতে পাবেন।

### ৩. Custom Domain `watchanime.cyou` সংযোগ
1. Repository Settings > **Pages** > **Custom domain** বক্সে `watchanime.cyou` লিখুন এবং Save করুন।
2. আপনার Domain Registrar বা Cloudflare DNS-এ নিচের রেকর্ডগুলো যোগ করুন:
   - **Type:** `CNAME` | **Name:** `@` বা `www` | **Target:** `<username>.github.io`
   - অথবা GitHub-এর ৪টি A রেকর্ড:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
3. GitHub Pages স্বয়ংক্রিয়ভাবে ফ্রি HTTPS / SSL চালু করে দেবে।

---

## 🗄️ Database Connection: Firebase Web SDK ও `google-services.json`

### ওয়েব অ্যাপে ডাটাবেজ কানেকশন (Firebase Web SDK)
ওয়েব ব্রাউজার সরাসরি জাভাস্ক্রিপ্ট SDK ব্যবহার করে। এই প্রজেক্টে:
- `firebase-applet-config.json` ফাইলটিতে আপনার ফায়ারবেস প্রজেক্টের লাইভ ক্রেডেনশিয়াল দেওয়া আছে:
  ```json
  {
    "projectId": "gen-lang-client-0816013135",
    "appId": "1:69201872601:web:e68e5f8ae6d7b01e2be0c8",
    "apiKey": "AIzaSyCYcZ89k2bfUmIZzTeu_PQNQTiBbcFeXVc",
    "authDomain": "gen-lang-client-0816013135.firebaseapp.com",
    "firestoreDatabaseId": "ai-studio-watchanime-5488f77b-a045-4e5f-91bd-147405d4a4df",
    "storageBucket": "gen-lang-client-0816013135.firebasestorage.app"
  }
  ```
- `src/config/firebase.ts` ফাইলে এটি স্বয়ংক্রিয়ভাবে লোড হয় এবং Cloud Firestore ও Firebase Authentication-এর সাথে সংযুক্ত থাকে।

### `google-services.json` (Android ও Mobile Apps-এর জন্য)
- রুট ডিরেক্টরিতে আপনার ফায়ারবেস প্রজেক্টের জন্য একটি প্রস্তুতকৃত `/google-services.json` ফাইল যোগ করা হয়েছে।
- আপনি যদি ভবিষ্যতে এই ওয়েব কোডটিকে **Capacitor**, **Cordova**, বা **Flutter/Android Studio** দিয়ে অ্যান্ড্রয়েড মোবাইল APK অ্যাপে রূপান্তর করেন, তবে এই `google-services.json` ফাইলটি সরাসরি আপনার অ্যান্ড্রয়েড অ্যাপের `android/app/` ফোল্ডারে পেস্ট করে দিলেই অ্যান্ড্রয়েড অ্যাপেও একই ফায়ারবেস ডাটাবেজ সংযুক্ত হয়ে যাবে!

### ফায়ারবেস অথেন্টিকেশনে ডোমেইন অনুমোদন (Authorized Domains)
1. [console.firebase.google.com](https://console.firebase.google.com)-এ যান।
2. আপনার প্রজেক্টটি খুলুন > **Authentication** > **Settings** > **Authorized domains** ট্যাবে যান।
3. **Add domain** ক্লিক করে নিচের ডোমেইনগুলো যুক্ত করুন:
   - `watchanime.cyou`
   - `<username>.github.io` (আপনার GitHub Pages এর অ্যাড্রেস)
4. এতে Google Sign-in এবং Authentication কোনো বাধা ছাড়াই নির্বিঘ্নে কাজ করবে।

---

## 👑 অ্যাডমিন এক্সেস (Superadmin Access)
- প্রজেক্টটিতে অ্যাডমিন হিসেবে আপনার ইমেইল `mdtufazzal513@gmail.com` কনফিগার করা রয়েছে।
- সাইটে এই ইমেইল দিয়ে Google Sign-in বা Email দিয়ে লগইন করলেই আপনি হেডার মেনুতে **Admin Panel** দেখতে পাবেন।
- প্রোফাইল পেজে গিয়ে **Initialize Admin Privileges** বাটনে ক্লিক করে ফায়ারস্টোরে আপনার অ্যাডমিন রেকর্ড স্থায়ীভাবে সক্রিয় করে নিতে পারেন।
