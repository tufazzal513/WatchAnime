window.toggleSidebar = function() {
    document.getElementById('admin-sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
};

window.logout = function() {
    try { 
        localStorage.removeItem('movex_admin_cache');
        auth.signOut().then(() => window.location.reload()); 
    } catch(e) { console.error(e); }
};

// Page navigation: every admin page has a real URL under /admin
const ADMIN_PATHS = {
    'dashboard': '/admin/dashboard', 'movies': '/admin/movies/new', 'all-movies': '/admin/movies',
    'banners': '/admin/banners', 'users': '/admin/users', 'settings': '/admin/settings', 'broken-links': '/admin/broken-links'
};
const ADMIN_TITLES = {
    'dashboard': 'Dashboard', 'movies': 'Add Movie', 'all-movies': 'All Movies', 'banners': 'Banners',
    'users': 'Users', 'settings': 'Settings', 'broken-links': 'Broken Links'
};

// URL -> { page, id? }   (/admin/movies/<id>/edit and /admin/users/<uid> carry an id)
const adminParse = (pathname) => {
    const segs = String(pathname || '').split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    if (segs[0] !== 'admin') return null;
    const a = segs[1], b = segs[2], c = segs[3];
    if (!a || a === 'login' || a === 'dashboard') return segs.length <= 2 ? { page: 'dashboard' } : null;
    if (a === 'movies') {
        if (!b) return { page: 'all-movies' };
        if (b === 'new' && !c) return { page: 'movies' };
        if (c === 'edit' && segs.length === 4) return { page: 'movies', id: b };
        return null;
    }
    if (a === 'users') return segs.length === 2 ? { page: 'users' } : segs.length === 3 ? { page: 'users', id: b } : null;
    if ((a === 'banners' || a === 'settings' || a === 'broken-links') && segs.length === 2) return { page: a };
    return null;
};
const adminUrlFor = (r) => {
    if (r.page === 'movies' && r.id) return '/admin/movies/' + encodeURIComponent(r.id) + '/edit';
    if (r.page === 'users' && r.id) return '/admin/users/' + encodeURIComponent(r.id);
    return ADMIN_PATHS[r.page] || ADMIN_PATHS.dashboard;
};
// the URL a plain "open this page" click should use (keeps /edit or /<uid> while that form / panel is open)
const adminDefaultUrl = (pageId) => {
    if (pageId === 'movies') { const el = document.getElementById('movie-edit-id'); if (el && el.value) return adminUrlFor({ page: 'movies', id: el.value }); }
    if (pageId === 'users') { const p = document.getElementById('user-edit-panel'); if (p && !p.classList.contains('hidden') && p.dataset.uid) return adminUrlFor({ page: 'users', id: p.dataset.uid }); }
    return ADMIN_PATHS[pageId] || ADMIN_PATHS.dashboard;
};
const adminNav = (url, replace) => {
    try {
        if (replace || window.location.pathname === url) window.history.replaceState({ admin: 1 }, '', url);
        else window.history.pushState({ admin: 1 }, '', url);
    } catch (e) {}
};

const showAdminPage = (pageId, saveHistory = true, urlOverride) => {
    adminPages.forEach(p => p.classList.toggle('active', p.id === pageId));
    adminNavBtns.forEach(b => {
        if (b.dataset.page === pageId) {
            b.classList.add('text-blue-500');
            b.classList.remove('text-gray-400');
        } else {
            b.classList.remove('text-blue-500');
            b.classList.add('text-gray-400');
        }
    });
    window.scrollTo(0,0);

    localStorage.setItem('movex_last_page', pageId);
    document.title = (ADMIN_TITLES[pageId] || 'Admin') + ' - MoveX Admin';
    adminNav(urlOverride || adminDefaultUrl(pageId), !saveHistory);
};

// run the poll until the data (movies / users) has arrived, then act (used for deep links)
const adminWhen = (test, fn) => {
    let n = 0;
    const t = setInterval(() => { if (test()) { clearInterval(t); fn(); } else if (++n > 75) clearInterval(t); }, 200);
};

// show whatever the address bar points to
const adminApplyRoute = (r, saveHistory) => {
    r = r || { page: 'dashboard' };
    showAdminPage(r.page, saveHistory, adminUrlFor(r));
    const panel = document.getElementById('user-edit-panel');
    if (r.page === 'movies') {
        if (r.id) adminWhen(() => allMoviesCache[r.id], () => editMovie(r.id));
        else if (typeof resetMovieForm === 'function' && document.getElementById('movie-edit-id') && document.getElementById('movie-edit-id').value) resetMovieForm();
    }
    if (r.page === 'users') {
        if (r.id) adminWhen(() => allUsersCache[r.id], () => editUser(r.id));
        else if (panel) panel.classList.add('hidden');
    }
};

// Back/Forward buttons (browser or phone)
window.addEventListener('popstate', () => adminApplyRoute(adminParse(window.location.pathname), false));

adminNavBtns.forEach(b => b.addEventListener('click', () => showAdminPage(b.dataset.page)));
