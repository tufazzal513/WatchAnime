// --- AUTH STATE & LOADING ---
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // ১. ইউজারের রেকর্ড আপডেট করা এবং বর্তমান স্ট্যাটাস চেক করা
        const currentStatus = await ensureUserRecord(user);

        // ২. যদি একাউন্ট 'deleted' থাকে, তাহলে তার Auth Account (ইমেইল/পাসওয়ার্ড) পুরোপুরি মুছে দেওয়া হবে।
        if(currentStatus === "deleted") {
            showBannedPopup("deleted");
            try {
                // Firebase Auth থেকে একাউন্ট পার্মানেন্টলি ডিলিট করা
                await user.delete();
                // ডেটাবেজ থেকে রেকর্ড মুছে ফেলা
                db.ref('users/' + user.uid).remove();
            } catch(error) {
                // ফায়ারবেস রুলস অনুযায়ী অনেকদিন আগে লগইন করা থাকলে ডিলিট ফেইল হতে পারে, সেক্ষেত্রে জাস্ট লগআউট করে দিবো
                await auth.signOut();
            }
            return; 
        }

        // যদি একাউন্ট 'frozen' থাকে
        if(currentStatus === "frozen") {
            showBannedPopup("frozen");
            await auth.signOut();
            return; 
        }

        // ৩. রিয়েল-টাইম স্ট্যাটাস লিসেনার (লগইন থাকা অবস্থায় এডমিন ফ্রিজ/ডিলিট করলে সাথে সাথে বের করে দেবে)
        if (userStatusRef) userStatusRef.off(); 
        userStatusRef = db.ref('users/' + user.uid + '/status');

        userStatusRef.on('value', async (snap) => {
            const status = snap.val();

            if (status === "deleted") {
                showBannedPopup("deleted");
                try {
                    await auth.currentUser.delete();
                    db.ref('users/' + user.uid).remove();
                } catch(e) {
                    await auth.signOut();
                }
            } else if (status === "frozen") {
                showBannedPopup("frozen");
                await auth.signOut();
            }
        });

        // সবকিছু ঠিক থাকলে অ্যাপে প্রবেশ করানো
        authScreen.classList.remove('visible');
        authScreen.style.display = 'none'; 
        // The app is laid out but kept invisible until the first data is ready (mxReady). Until then the browser keeps showing
        // the previous page on a refresh and its own loading bar runs, exactly like a normal website.
        appContainer.classList.add('mx-wait');
        appContainer.classList.remove('hidden');
        updateUserProfile(user);
        setupPresence(user);

        // The address bar decides where to start. Titles/filters/search need the movie data, so those wait for it.
        let route = MXR.parse(location.pathname, location.search);
        if (route && route.auth) {              // just logged in from /login?next=... -> go to "next" (or home)
            try { history.replaceState({ page: 'home-page', d: 0 }, '', route.next || '/'); } catch (e) {}
            route = MXR.parse(location.pathname, location.search);
        }
        window.__mxPendingRoute = null;
        if (!route) {
            showPage('home-page', false, '/');
            if (typeof showCustomModal === 'function') showCustomModal('alert', 'Page not found.');
        } else if (route.movieId || route.browse || (route.page === 'search-page' && route.q)) {
            window.__mxPendingRoute = route;
            mxShell(route);                 // open the right page right now (not Home) while the data loads
        } else {
            showPage(route.page, false);
        }

        // start loading the data at once. There is no intro splash any more; the page content simply appears when it is ready.
        window.__mxReadyDone = false; window.__mxMoviesOk = false; window.__mxBannersOk = false;
        (function run() { if (typeof loadInitialData === 'function') loadInitialData(); else setTimeout(run, 40); })();
        setTimeout(() => window.mxReady(), 6000);                   // never hold the screen forever (slow or offline)


    } else {
        if (userStatusRef) {
            userStatusRef.off();
            userStatusRef = null;
        }
        window.__startupRouteDone = false;      // the next login applies the URL again
        window.mxAuthRoute();
        authScreen.style.display = 'flex';
        setTimeout(() => authScreen.classList.add('visible'), 10);
        appContainer.classList.add('hidden');
        initialLoader.style.opacity = '0'; initialLoader.style.pointerEvents = 'none';
        setTimeout(() => initialLoader.style.display = 'none', 500);
    }
});

function updateUserProfile(user) {
    const headerUserName = document.getElementById('header-user-name');
    if(headerUserName) headerUserName.textContent = `Hi, ${user.displayName ? user.displayName.split(' ')[0] : 'User'}`;
    const appName = localStorage.getItem('movex_app_name') || "MoveX";
    document.getElementById('profile-name').textContent = user.displayName || `${appName} User`;
    document.getElementById('profile-email').textContent = user.email;
    document.getElementById('profile-initial').textContent = user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U';
    const joined = document.getElementById('pf-joined');
    if (joined) { const t = Date.parse(user.metadata && user.metadata.creationTime); joined.textContent = isNaN(t) ? '-' : new Date(t).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
    const appEl = document.getElementById('pf-app'); if (appEl) appEl.textContent = appName;
    if (typeof renderProfileStats === 'function') renderProfileStats();
}

const pages = document.querySelectorAll('.page');
const navBtns = document.querySelectorAll('.nav-btn');

// Function to handle when Global Top Header should be visible or hidden
function toggleGlobalHeader(show) {
    const globalHeader = document.getElementById('global-header');
    const mainContent = document.querySelector('.main-content');
    if (show) {
        if (globalHeader) globalHeader.style.display = 'flex';
        if (mainContent) mainContent.classList.remove('no-global-header');
    } else {
        if (globalHeader) globalHeader.style.display = 'none';
        if (mainContent) mainContent.classList.add('no-global-header');
    }
}

// Logged out: show /login, /signup or /forgot-password. Any other address becomes /login?next=<that address>
window.mxAuthRoute = () => {
    const r = MXR.parse(location.pathname, location.search);
    let mode = 'login', next = '';
    if (r && r.auth) { mode = r.auth; next = r.next || ''; }
    else if (r && r.page !== 'home-page') next = MXR.safeNext(location.pathname + location.search);
    window.__mxAuthNext = next;
    toggleAuthMode(mode, true);
    MXR.nav(MXR.authUrl(mode, next), { page: 'auth' }, true);
    MXR.setTitle(MXR.authTitle(mode));
};

// URL of a page that has no extra data of its own
window.mxPageUrl = (pageId) => MXR.pagePath(pageId);

// The URL is the source of truth: Back/Forward just re-run the route that is in the address bar
window.onpopstate = () => {
    // leave fullscreen/stop the inline player first when the phone Back button is used
    if (typeof stopPlayer === 'function') stopPlayer();
    if (!auth.currentUser) return window.mxAuthRoute();
    if (typeof mxApplyRoute === 'function') mxApplyRoute(MXR.parse(location.pathname, location.search), false);
};

const showPage = (pageId, pushToHistory = true, urlOverride) => {
    if (typeof closeSheet === 'function') closeSheet();
    if (typeof closeBrowseFilters === 'function' && document.getElementById('br-sheet')) closeBrowseFilters();
    pages.forEach(page => page.classList.toggle('active', page.id === pageId));
    navBtns.forEach(btn => {
        btn.classList.toggle('text-blue-500', btn.dataset.page === pageId);
        btn.classList.toggle('text-gray-400', btn.dataset.page !== pageId);
    });

    // Handle Global App Bar visibility based on active page
    const hideHeaderPages = ['movie-details-page', 'category-movies-page', 'search-page', 'history-page', 'notifications-page', 'settings-page'];
    toggleGlobalHeader(!hideHeaderPages.includes(pageId));

    MXR.nav(urlOverride || window.mxPageUrl(pageId), { page: pageId }, !pushToHistory);
    MXR.setTitle(pageId === 'category-movies-page' && window.mxBrowseTitle ? window.mxBrowseTitle() : MXR.pageTitle(pageId));

    if (pageId === 'profile-page' && typeof pfCacheRefresh === 'function') pfCacheRefresh();
    if (pageId === 'search-page' && typeof resetSearchPage === 'function') resetSearchPage();
    if (pageId === 'settings-page' && typeof renderSettingsPage === 'function') { renderSettingsPage(); window.scrollTo(0, 0); }
    if (pageId === 'history-page' && typeof renderHistoryPage === 'function') { renderHistoryPage(); window.scrollTo(0, 0); }
};

// in-app Back arrow: go back if the app pushed an entry, otherwise (landed on a deep link) go home
window.goBack = () => { if (history.state && history.state.d > 0) history.back(); else showPage('home-page', false); };
navBtns.forEach(btn => btn.addEventListener('click', () => showPage(btn.dataset.page)));


// Refresh on /movie/..., /genre/..., /browse..., /search?q=...: the data is not here yet, so open THAT page (empty, no skeleton)
// instead of the Home page for a moment. mxApplyRoute() fills it with the real content once the data arrives.
window.mxShell = (r) => {
    if (!r) return;
    const url = location.pathname + location.search, el = (id) => document.getElementById(id);
    if (r.movieId) {
        showPage('movie-details-page', false, url);
        el('movie-details-content').innerHTML = '';
    } else if (r.browse) {
        showPage('category-movies-page', false, url);
        el('category-movies-grid').innerHTML = '';
    } else if (r.page === 'search-page') {
        showPage('search-page', false, url);
        el('search-input').value = r.q || '';
        el('search-home').classList.add('hidden');
        el('search-view').classList.remove('hidden');
        el('sr-tabs').innerHTML = '';
        el('search-results').innerHTML = '';
    }
};

// Marks the initial data as ready (movie list + hero banners on Home); there is no splash to hide any more.
window.mxReady = () => {
    if (window.__mxReadyDone) return;
    window.__mxReadyDone = true;
    appContainer.classList.remove('mx-wait');      // show the finished page in one go
};
window.mxTryReady = () => {
    // show the page as soon as the movie list is ready; hero banners fade in by themselves when they arrive
    if (window.__mxMoviesOk) window.mxReady();
};
