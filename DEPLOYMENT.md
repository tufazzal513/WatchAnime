# 📱 MoveX সহজ ডিপ্লয়মেন্ট গাইড (মোবাইল ফ্রেন্ডলি)

এই প্রজেক্টটি এমনভাবে তৈরি করা হয়েছে যাতে আপনাকে ফোনে কোনো জটিল টার্মিনাল কমান্ড টাইপ করতে না হয়। নিচে ২-৩টি ক্লিকের মাধ্যমে ডিপ্লয় করার একদম সহজ ধাপ দেওয়া হলো:

---

## 🌐 অংশ ১: ফ্রন্টএন্ড (GitHub Pages-এ হোস্ট করা)

আমরা প্রজেক্টে স্বয়ংক্রিয় **GitHub Actions Workflow** যোগ করেছি (`.github/workflows/deploy-frontend.yml`)। 

### ডিপ্লয় করার ধাপ:
১. আপনার GitHub মোবাইল অ্যাপ বা ক্রোম ব্রাউজারে Repository **Settings**-এ যান।
২. বামপাশের মেনু থেকে **Pages** সিলেক্ট করুন।
৩. **Source** ড্রপডাউন থেকে **`GitHub Actions`** নির্বাচন করুন।
৪. ব্যস! এখন থেকে আপনার GitHub-এ কোড পুশ হওয়ামাত্রই ফ্রন্টএন্ডটি অটোমেটিক `https://your-username.github.io/repository-name/` লিংকে চালু হয়ে যাবে।

---

## ⚡ অংশ ২: ব্যাকএন্ড (botkeep.cloud -এ ডিলেয় করা)

আমরা প্রজেক্টে প্রোডাকশন-রেডি `Dockerfile` এবং `docker-compose.yml` তৈরি করে দিয়েছি।

### ডিপ্লয় করার ধাপ:
১. **botkeep.cloud** ড্যাশবোর্ডে লগইন করুন এবং **New Service / App**-এ ক্লিক করুন।
২. আপনার **GitHub Repository** লিংকটি সিলেক্ট করুন।
৩. Build Type হিসেবে **`Dockerfile`** নির্বাচন করুন।
৪. Environment Variables অপশনে নিচের মানগুলো বসিয়ে দিন (Paste করুন):

```env
ROLE=main
PORT=3000
DATA_DIR=/app/data
ADMIN_UIDS=আপনার_ফায়ারবেস_অ্যাডমিন_UID
FIREBASE_PROJECT_ID=movex-513
TG_BOT_TOKEN=আপনার_টেলিগ্রাম_বট_টোকেন (ঐচ্ছিক)
TG_CHAT_ID=আপনার_টেলিগ্রাম_চ্যানেল_আইডি (ঐচ্ছিক)
```

৫. **Deploy** বাটনে ক্লিক করুন! BotKeep Cloud স্বয়ংক্রিয়ভাবে Go ব্যাকএন্ডটি বিল্ড ও চালু করে দেবে এবং আপনাকে একটি লিঙ্ক প্রদান করবে (যেমন: `https://movex-backend.botkeep.cloud`)।

---

## 🔗 অংশ ৩: ফ্রন্টএন্ড ও ব্যাকএন্ড কানেক্ট করা

GitHub Pages-এর ফ্রন্টএন্ড যাতে BotKeep Cloud ব্যাকএন্ডের সাথে যোগাযোগ করতে পারে:

১. আপনার BotKeep Cloud ব্যাকএন্ড ডোমেইন ইউআরএলটি ক্রপি করুন (যেমন: `https://movex-backend.botkeep.cloud`)।
২. আপনার GitHub প্রজেক্টের `frontend/assets/js/shared/firebase-config.js` ফাইলের ১৪ নম্বর লাইনে `MX_API_BASE` এর জায়গায় পেস্ট করুন:

```js
const MX_API_BASE = "https://movex-backend.botkeep.cloud";
```

বা আপনার মোবাইল ব্রাউজারে GitHub Pages সাইটটি ওপেন করে কন্সোলে বা LocalStorage-এ একবার সেট করতে পারেন:
`localStorage.setItem('MX_API_BASE', 'https://movex-backend.botkeep.cloud')`
