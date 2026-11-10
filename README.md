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

## Deploy
Upload the contents of this folder to the GitHub Pages repository root. Do not upload this folder as a nested directory. Serve over HTTPS/HTTP; opening `index.html` as `file://` will not work because the app fetches its page partials.
