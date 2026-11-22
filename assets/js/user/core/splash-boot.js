// ---- MoveX URL routing: real paths like /movie/<id>/<title>, /genre/action, /search?q=naruto ----
(function () {
    const FILTERS = ['genre', 'industry', 'language', 'type', 'year'];
    const PAGES = {
        'home-page': '/', 'search-page': '/search', 'categories-page': '/categories', 'category-movies-page': '/browse',
        'notifications-page': '/notifications', 'profile-page': '/profile', 'mylist-page': '/my-list', 'history-page': '/history', 'settings-page': '/settings'
    };
    const TITLES = {
        'search-page': 'Search', 'categories-page': 'Categories', 'category-movies-page': 'Browse',
        'notifications-page': 'Notifications', 'profile-page': 'Profile', 'mylist-page': 'My List', 'history-page': 'Watch History', 'settings-page': 'Settings'
    };
    const TABS = ['all', 'movies', 'series', 'anime'], SORTS = ['suggested', 'new', 'top', 'az'];
    const ID_RE = /^[A-Za-z0-9_\-]+$/;
    const enc = encodeURIComponent;
    const slug = (s) => String(s == null ? '' : s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const fslug = (v) => slug(v) || String(v);          // non-latin values keep their own text
    const qs = (o) => { const p = Object.keys(o).filter(k => o[k] !== '' && o[k] != null).map(k => enc(k) + '=' + enc(o[k])); return p.length ? '?' + p.join('&') : ''; };

    const AUTH_ROUTES = { login: '/login', signup: '/signup', forgot: '/forgot-password' };
    const AUTH_TITLES = { login: 'Log In', signup: 'Sign Up', forgot: 'Reset Password' };
    // only same-site app paths are allowed as the "go here after login" target (no open redirects)
    const safeNext = (n) => {
        if (!n || n[0] !== '/' || n[1] === '/' || n.indexOf('\\') > -1) return '';
        const i = n.indexOf('?'), r = MXR.parse(i < 0 ? n : n.slice(0, i), i < 0 ? '' : n.slice(i));
        return r && !r.auth && n !== '/' ? n : '';
    };

    const MXR = {
        FILTERS, slug, fslug, safeNext,
        authUrl: (mode, next) => (AUTH_ROUTES[mode] || '/login') + qs({ next: safeNext(next) }),
        authTitle: (mode) => AUTH_TITLES[mode] || 'Log In',
        pagePath: (pageId) => PAGES[pageId] || '/',
        pageTitle: (pageId) => TITLES[pageId] || '',
        movieUrl: (id, title, season, ep) => { const sl = slug(title); return '/movie/' + enc(id) + (sl ? '/' + sl : '') + (season > 0 && ep > 0 ? qs({ s: season, e: ep }) : ''); },
        searchUrl: (q) => '/search' + qs({ q: String(q || '').trim() }),
        browseUrl: (b) => {
            b = b || {};
            const act = FILTERS.filter(k => b[k]), tab = b.tab && b.tab !== 'all' ? b.tab : '', sort = b.sort && b.sort !== 'suggested' ? b.sort : '';
            if (act.length === 1 && !tab && !sort) return '/' + act[0] + '/' + enc(fslug(b[act[0]]));
            const o = {}; act.forEach(k => { o[k] = fslug(b[k]); }); o.tab = tab; o.sort = sort;
            return '/browse' + qs(o);
        },
        parse: (pathname, search) => {
            let segs; try { segs = String(pathname || '/').split('/').filter(Boolean).map(decodeURIComponent); } catch (e) { return null; }
            const q = new URLSearchParams(search || '');
            if (segs.length && /^index\.html?$/i.test(segs[0])) segs.shift();
            if (!segs.length) return { page: 'home-page' };
            const k = segs[0].toLowerCase();
            const extra = (b) => { const t = q.get('tab'), so = q.get('sort'); if (TABS.includes(t)) b.tab = t; if (SORTS.includes(so)) b.sort = so; return b; };
            for (const m in AUTH_ROUTES) if (AUTH_ROUTES[m] === '/' + k && segs.length === 1) return { page: 'auth', auth: m, next: safeNext(q.get('next')) };
            if (k === 'movie' && segs.length >= 2 && ID_RE.test(segs[1])) {
                const s = parseInt(q.get('s'), 10), e = parseInt(q.get('e'), 10);
                return { page: 'movie-details-page', movieId: segs[1], season: s > 0 ? s : 0, ep: e > 0 ? e : 0 };
            }
            if (FILTERS.includes(k) && segs.length === 2) { const b = {}; b[k] = segs[1]; return { page: 'category-movies-page', browse: extra(b) }; }
            if (k === 'browse' && segs.length === 1) { const b = {}; FILTERS.forEach(f => { if (q.get(f)) b[f] = q.get(f); }); return { page: 'category-movies-page', browse: extra(b) }; }
            if (k === 'search' && segs.length === 1) return { page: 'search-page', q: String(q.get('q') || '').trim() };
            for (const id in PAGES) if (PAGES[id] !== '/' && PAGES[id] === '/' + k && segs.length === 1) return { page: id };
            return null;
        },
        // push (or replace) a history entry. `d` counts how deep the in-app history is, so Back never leaves the site by mistake
        nav: (url, state, replace) => {
            const cur = history.state || {}, same = (location.pathname + location.search) === url, rep = !!replace || same;
            const st = Object.assign({}, state, { d: rep ? (cur.d || 0) : (cur.d || 0) + 1 });
            try { if (rep) history.replaceState(st, '', url); else history.pushState(st, '', url); } catch (e) {}
        },
        setTitle: (t) => { document.title = t ? t + ' - MoveX' : 'MoveX - Anime, Series & Movies'; },
        // old links (#/movie/<id>, #movie=<id>, #/search ...) -> real paths
        migrateLegacy: () => {
            const h = location.hash || ''; if (!h) return false;
            let url = null, m = /^#\/movie\/([A-Za-z0-9_\-]+)/.exec(h) || /[#&]movie=([A-Za-z0-9_\-]+)/.exec(h);
            if (m) url = '/movie/' + m[1];
            else { const p = h.replace(/^#/, '').replace(/\/+$/, ''); if (p === '/home') url = '/'; else for (const id in PAGES) if (PAGES[id] !== '/' && PAGES[id] === p) { url = PAGES[id]; break; } }
            if (!url) return false;
            try { history.replaceState(history.state, '', url); } catch (e) {} return true;
        }
    };
    window.MXR = MXR;

    // Free hosts (InfinityFree) add a "?i=1" challenge param. Hide it once the page has loaded.
    try {
        const u = new URL(location.href);
        if (u.searchParams.get('i') === '1' && Array.from(u.searchParams.keys()).length === 1) history.replaceState(history.state, '', u.pathname + u.hash);
    } catch (e) {}
    MXR.migrateLegacy();
})();
