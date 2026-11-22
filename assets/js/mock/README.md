# Mock data (testing only)

Adds ~160 fake movies / series / anime + 8 hero banners so you can see the site with a full catalogue.
Posters/covers are generated artwork (no internet needed). Videos are free public sample videos.
Nothing is saved to your server. Real data (if any) is shown together with the fake data.

- Turn off: set `MOCK_ENABLED = false` in `mock-data.js`, or in the browser console: `localStorage.mx_mock = '0'` and reload.
- Turn on again: `localStorage.removeItem('mx_mock')`.
- Remove completely: delete this folder `assets/js/mock/`. (The `"../mock/mock-data.js"` line in `assets/js/user/bootstrap.js` can stay or be deleted; the site works either way.)
- Fake ids all start with `mock_`. Change the amount with `COUNT` in `mock-data.js`.
