# WAnime v2.3 User Frontend

This folder is the User App intended for GitHub Pages.

## Structure
- `index.html` - User App entry point
- `pages/` - User-facing HTML pages
- `partials/` - Reusable User App HTML fragments
- `assets/css/user/` - User App styles
- `assets/js/user/` - User App JavaScript
- `assets/js/shared/` - Firebase configuration, API client, and taxonomy shared by browser code
- `tools/cleanup-old-data.js` - Existing maintenance utility

## API connection
`assets/js/shared/firebase-config.js` sets `MX_API_BASE` to `https://d3g3pb.bot-keep.xyz`. Change it only if the backend domain changes.

## URLs
The app uses real paths (no `#`). Every page has its own address:

| Page | URL |
|---|---|
| Home | `/` |
| Search / results | `/search`, `/search?q=attack on titan` |
| Categories | `/categories` |
| Browse by one filter | `/genre/action`, `/industry/bollywood`, `/language/hindi`, `/type/series`, `/year/2024` |
| Browse with several filters | `/browse?genre=action&language=hindi&tab=series&sort=top` |
| Title (movie or series) | `/movie/<id>/<title-slug>` |
| Series season / episode | `/movie/<id>/<title-slug>?s=2&e=5` |
| Log in / Sign up / Forgot password | `/login`, `/signup`, `/forgot-password` |
| Notifications | `/notifications` |
| Profile | `/profile` |
| My List | `/my-list` |
| Watch history | `/history` |

Logged-out visitors are sent to `/login?next=<the page they asked for>` and return there after logging in; a logged-in user opening `/login` goes home (or to `next`).

The title slug is only for looks; the `<id>` decides which title opens. Old `#movie=<id>` / `#/search` links are converted to the new paths automatically.

## Hosting (deep links must survive a refresh)
Because the paths are real, the host must serve `index.html` for unknown paths:
- **GitHub Pages + custom domain** - `404.html` (included) does this. Keep `404.html`, `index.html` and `.nojekyll` in the repository root. Upload the *contents* of this folder, not the folder itself. The site must live at the domain root (custom domain), not in a `/repo-name/` sub-folder.
- **Apache / InfinityFree / cPanel** - `.htaccess` (included).
- **Netlify / Cloudflare Pages** - `_redirects` (included).
- **Firebase Hosting** - `firebase.json` already has the rewrite.

Note: GitHub Pages answers deep links with a 404 status before 404.html redirects. Visitors never notice, but search engines may not index individual title pages. Netlify / Cloudflare Pages / Firebase (status 200) avoid that.

## Deploy
Upload the contents of this folder to the GitHub Pages repository root. Do not upload this folder as a nested directory. Serve over HTTPS/HTTP; opening `index.html` as `file://` will not work because the app fetches its page partials.
