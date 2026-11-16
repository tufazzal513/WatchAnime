// --- USER SPECIFIC DATA (Runs only after successful login) ---
const loadInitialData = () => {
    db.ref('movies').on('value', s => { 
        const rawMovies = s.val() || {};
        // শুধুমাত্র সেগুলোই ফিল্টার করছি যা প্রাইভেট নয়
        allMovies = {};
        Object.keys(rawMovies).forEach(id => {
            if (!rawMovies[id].isPrivate) {
                allMovies[id] = rawMovies[id];
            }
        });

        renderHomePage();
        renderCategoriesPage();
        if (window.__bannersRaw) renderBanners(window.__bannersRaw);   // hero banners of private titles disappear / reappear with the list

        if (!window.__startupRouteDone) {
            window.__startupRouteDone = true;
            if (window.__mxPendingRoute) { const r = window.__mxPendingRoute; window.__mxPendingRoute = null; mxApplyRoute(r, false); }
        }
        if (typeof renderMyListPage === 'function') renderMyListPage();
        if (typeof renderProfileStats === 'function') renderProfileStats();
        if (typeof renderHistoryPage === 'function') renderHistoryPage();
    });

    db.ref('banners').on('value', s => renderBanners(s.val()));

    db.ref('socialLinks').on('value', s => renderSocials(s.val()));
    db.ref('notifications').on('value', s => renderNotifications(s.val()));
};


// ---- URL routing: show whatever the address bar points to ----
window.mxApplyRoute = (r, push) => {
    if (!auth.currentUser) return;
    if (r && r.auth) {                           // already logged in: /login, /signup ... lead to "next" or home
        try { history.replaceState({ page: 'home-page', d: (history.state && history.state.d) || 0 }, '', MXR.toUrl(r.next || '/')); } catch (e) {}
        r = MXR.parse(location.pathname, location.search);
    }
    if (!window.__startupRouteDone) { window.__mxPendingRoute = r; return; }
    const home = (msg) => { showPage('home-page', false, '/'); if (msg && typeof showCustomModal === 'function') showCustomModal('alert', msg); };
    if (!r) return home('Page not found.');
    if (r.movieId) {
        if (allMovies[r.movieId]) showMovieDetails(r.movieId, push, { season: r.season, ep: r.ep });
        else home('This title is not available anymore.');
        return;
    }
    if (r.browse) { openBrowse(mxResolveFilters(r.browse), push); return; }
    if (r.page === 'search-page') {
        showPage('search-page', push, MXR.searchUrl(r.q));
        if (r.q) commitSearch(r.q, true);
        return;
    }
    showPage(r.page, push);
};

// an old #movie=<id> link pasted into an already open tab
window.addEventListener('hashchange', () => { if (MXR.migrateLegacy()) mxApplyRoute(MXR.parse(location.pathname, location.search), true); });
