# WAnime v2.3 - Frontend + Backend

This package contains the two deployable parts in separate folders.

## Folder layout

- `Frontend/` - User App for GitHub Pages. Upload the **contents** of this folder to the GitHub Pages repository root.
- `Backend/` - MAIN server: Node.js + SQLite API and Admin Panel. Upload the **contents** of this folder to the Pterodactyl server root.
- `Worker/Backend/` - WORKER server (read replica). **No Admin Panel.** Upload its **contents** to each worker server root. See `Worker/Backend/README.md`.

## Frontend

- Entry: `Frontend/index.html`
- User pages: `Frontend/pages/`
- HTML partials: `Frontend/partials/`
- User CSS: `Frontend/assets/css/user/`
- User JavaScript: `Frontend/assets/js/user/`
- Shared browser code: `Frontend/assets/js/shared/`
- `MX_API_BASE` is set in `Frontend/assets/js/shared/firebase-config.js` to `https://d3g3pb.bot-keep.xyz`.

## Backend

- API source: `Backend/src/`
- Admin UI: `Backend/public/admin/`
- Admin CSS: `Backend/public/assets/css/admin/`
- Admin/shared JS: `Backend/public/assets/js/admin/` and `Backend/public/assets/js/shared/`
- Environment template: `Backend/.env.example`
- Tests: `Backend/test/`

The backend's `public/assets/js/shared/firebase-config.js` intentionally keeps `MX_API_BASE` empty so the Admin Panel uses same-origin `/api/...` requests.

## Deployment safety

1. For GitHub Pages, upload the contents of `Frontend/` to the repository root. Do not upload the `Frontend` folder itself as a nested folder.
2. For Pterodactyl, upload the contents of `Backend/` to the server root. Do not upload the `Backend` folder itself as a nested folder.
3. Preserve the existing server `.env`, `data/` database, backups, and Telegram session. They are runtime data and are intentionally not included in this source ZIP.
4. Set `ADMIN_UID` in the hosting environment. Keep the existing database path and host-provided `PORT`.
5. Admin URL: `https://d3g3pb.bot-keep.xyz/admin`.

## Important separation

The Backend package contains only Admin UI assets, shared Admin browser libraries, and API/server code. Duplicate User Panel CSS/JavaScript assets have been removed from Backend because the User App is deployed from `Frontend/`. The Frontend retains its complete User Panel code and its own shared libraries. No application data or database file is included in this ZIP.

## Multi-quality video (480p / 720p / 1080p / Auto)
- Admin: each movie and each episode has three direct-link inputs, **480p / 720p / 1080p** (the old single Video Link box is removed; old content that only has the legacy link keeps playing until a quality link is added) (`q480`, `q720`, `q1080`). An empty box = that quality is hidden in the player.
- Player: Auto + the available qualities in the quality (cog) menu. Switching quality continues from the exact second watched.
- User: Profile -> **Settings** (`/settings`) -> Default video quality (Auto / 480p / 720p / 1080p). Saved at `users/<uid>/settings/defaultQuality`. Changing quality inside the player never changes this saved default.
- Missing quality -> closest available (lower first, then higher). No server/Worker change is needed (the data is schema-less).
