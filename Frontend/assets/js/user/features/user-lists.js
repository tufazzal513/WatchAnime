// --- MY LIST + CONTINUE WATCHING (stored in Firebase under the user's own account) ---
window.myListIds = {};       // { movieId: addedAt }
window.progressMap = {};     // { movieId: {ep, season, t, d, at} }
window.historyMap = {};      // { movieId: {ep, season, t, d, at, done} }  (every title the user played, finished or not)
let _listUid = null, _listRef = null, _progRef = null, _statsRef = null, _histRef = null;

auth.onAuthStateChanged(user => {
    if (_listRef) _listRef.off(); if (_progRef) _progRef.off(); if (_statsRef) _statsRef.off();
    historyMap = {}; myListIds = {}; progressMap = {}; _listUid = user ? user.uid : null;
    if (!user) return;
    _statsRef = db.ref('stats');
    _statsRef.on('value', st => { window.mxStats = st.val() || {}; if (typeof renderHomePage === 'function' && Object.keys(allMovies).length) renderHomePage(); }, () => {});
    _listRef = db.ref('users/' + user.uid + '/myList');
    _progRef = db.ref('users/' + user.uid + '/progress');
    _histRef = db.ref('users/' + user.uid + '/history');
    _histRef.once('value', s => { historyMap = s.val() || {}; renderProfileStats(); if (typeof renderHistoryPage === 'function') renderHistoryPage(); }, () => {});   // read once; saveProgress keeps it up to date locally
    _listRef.on('value', s => { myListIds = s.val() || {}; refreshListUI(); });
    _progRef.once('value', s => { progressMap = s.val() || {}; renderProfileStats(); if (typeof renderHomePage === 'function' && Object.keys(allMovies).length) renderHomePage(); });   // read once; saveProgress keeps progressMap up to date locally
});

window.inMyList = (id) => !!myListIds[id];
window.toggleMyList = (id, ev) => {
    if (ev) ev.stopPropagation();
    if (!_listUid || !id) return;
    const ref = db.ref('users/' + _listUid + '/myList/' + id), adding = !myListIds[id];
    if (adding || (mxStats[id] && mxStats[id].lists > 0)) db.ref('stats/' + id + '/lists').transaction(n => Math.max(0, (n || 0) + (adding ? 1 : -1))).catch(() => {});
    (myListIds[id] ? ref.remove() : ref.set(firebase.database.ServerValue.TIMESTAMP)).catch(() => {
        if (typeof showCustomModal === 'function') showCustomModal('alert', 'Could not update My List. Please try again.');
    });
};
window.refreshListUI = () => {
    document.querySelectorAll('[data-mylist]').forEach(b => {
        const on = inMyList(b.dataset.mylist);
        b.classList.toggle('on', on);
        const i = b.querySelector('i'); if (i) i.className = on ? 'fas fa-check' : 'fas fa-plus';
        const t = b.querySelector('.lbl'); if (t) t.textContent = on ? 'In My List' : 'Add to list';
    });
    renderMyListPage(); renderProfileStats();
    if (typeof renderHomePage === 'function' && Object.keys(allMovies).length) renderHomePage();
};
window.renderMyListPage = () => {
    const grid = document.getElementById('mylist-grid'), empty = document.getElementById('mylist-empty');
    if (!grid) return;
    const mode = (document.getElementById('ml-sort') || {}).value || 'added';
    let items = Object.entries(myListIds).map(([id, at]) => [id, allMovies[id], at]).filter(([_, m]) => m);
    if (mode === 'az') items.sort((a, b) => String(a[1].title).localeCompare(String(b[1].title)));
    else if (mode === 'top') items.sort((a, b) => MX.ratingNum(b[1]) - MX.ratingNum(a[1]));
    else items.sort((a, b) => (b[2] || 0) - (a[2] || 0));
    empty.classList.toggle('hidden', items.length > 0);
    document.getElementById('ml-count').textContent = items.length ? items.length + (items.length === 1 ? ' title' : ' titles') : '';
    const pct = (id) => { const p = progressMap[id]; return p && p.d ? Math.min(100, Math.round(p.t / p.d * 100)) : 0; };
    grid.innerHTML = items.map(([id, m]) => {
        const genres = MX.genresOf(m).slice(0, 3).map(g => `<span class="ml-g">${esc(g)}</span>`).join('');
        return `
        <div class="ml-row" onclick="showMovieDetails('${id}')">
            <div class="ml-poster" ${mxT(m)}>${mxImg(m)}${mxBadges(m)}${pct(id) ? `<div class="nf-prog"><i style="width:${pct(id)}%"></i></div>` : ''}</div>
            <div class="ml-info">
                <p class="ml-title">${esc(m.title)}</p>
                ${mxMeta(m, false)}
                <div class="ml-genres">${genres}</div>
            </div>
            <div class="ml-act">
                <span class="ml-play"><i class="fas fa-play"></i></span>
                <button class="ml-rm" onclick="toggleMyList('${id}', event)" aria-label="Remove from My List"><i class="fas fa-bookmark"></i></button>
            </div>
        </div>`;
    }).join('');
};

// --- watch progress (resume) ---
let _lastSave = 0;
window.saveProgress = (movieId, season, ep, t, d, force) => {
    if (!_listUid || !movieId || !(d > 0) || !(t >= 0)) return;
    const now = Date.now();
    if (!force && now - _lastSave < 30000) return;   // was 8 s
    _lastSave = now;
    const ref = db.ref('users/' + _listUid + '/progress/' + movieId);
    const refreshHome = () => { if (force && typeof renderHomePage === 'function' && Object.keys(allMovies).length) renderHomePage(); };
    const done = t / d > 0.95;
    // watch history: one entry per title (latest episode / position), kept even when the title is finished
    const h = { season: season || null, ep: ep == null ? null : ep, t: done ? Math.floor(d) : Math.floor(t), d: Math.floor(d), done };
    historyMap[movieId] = Object.assign({}, h, { at: Date.now() });
    db.ref('users/' + _listUid + '/history/' + movieId).set(Object.assign({}, h, { at: firebase.database.ServerValue.TIMESTAMP })).catch(() => {});
    const old = Object.entries(historyMap).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(100);   // keep the latest 100
    old.forEach(([id]) => { delete historyMap[id]; db.ref('users/' + _listUid + '/history/' + id).remove().catch(() => {}); });
    if (typeof renderHistoryPage === 'function') renderHistoryPage();
    if (done) { delete progressMap[movieId]; ref.remove(); refreshHome(); return; }       // finished: drop it from Continue Watching
    progressMap[movieId] = { season: season || null, ep: ep == null ? null : ep, t: Math.floor(t), d: Math.floor(d), at: Date.now() };
    ref.set({ season: season || null, ep: ep == null ? null : ep, t: Math.floor(t), d: Math.floor(d), at: firebase.database.ServerValue.TIMESTAMP });
    refreshHome();
};

// count one "play" per user per title per 6 hours, only after 30 seconds of real watching (feeds the Hot lists)
window.mxCountPlay = (id) => {
    if (!id || !_listUid) return;
    const k = 'mx_played_' + id, last = +localStorage.getItem(k) || 0;
    if (Date.now() - last < 6 * 3600e3) return;
    localStorage.setItem(k, String(Date.now()));
    db.ref('stats/' + id + '/plays').transaction(n => (n || 0) + 1).catch(() => {});
};

// --- profile page: numbers + small actions ---
window.renderProfileStats = () => {
    const a = document.getElementById('pf-count-list'), b = document.getElementById('pf-count-prog');
    if (!a || !b) return;
    const known = Object.keys(allMovies || {}).length > 0;
    const count = (m) => Object.keys(m || {}).filter(id => !known || allMovies[id]).length;   // titles that are private / removed are not counted
    a.textContent = known ? count(myListIds) : '-'; b.textContent = known ? count(progressMap) : '-';   // '-' while the list is still loading (no fake 0)
};
// --- profile: saved data on this device (how big it is + clear it) ---
// Cleared: the data cache (movie lists), Cache Storage, quality-test flags, server list.
// Kept: your login, watch history, My List, theme, player settings and your search history.
const pfBytes = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 2 : 1) + ' MB';
window.mxCacheSize = async () => {
    let total = 0;
    try { if (window.mxDbCache) total += await window.mxDbCache.size(); } catch (e) {}
    try {
        if (window.caches) for (const name of await caches.keys()) {
            const c = await caches.open(name);
            for (const rq of await c.keys()) { const rs = await c.match(rq); if (rs) total += (await rs.clone().blob()).size; }
        }
    } catch (e) {}
    try { ['mx_servers'].forEach(k => { const v = localStorage.getItem(k); if (v) total += v.length * 2; }); } catch (e) {}
    return total;
};
window.pfCacheRefresh = async () => {
    const el = document.getElementById('pf-cache-size'); if (!el) return;
    try { el.textContent = pfBytes(await mxCacheSize()); } catch (e) { el.textContent = '-'; }
};
window.pfClearCache = () => {
    const btn = document.getElementById('pf-clear-cache'), sub = document.getElementById('pf-cache-sub');
    const idle = 'Free up space. Your account and settings stay safe';
    const run = async () => {
        if (btn) btn.classList.add('busy');
        if (sub) sub.textContent = 'Clearing...';
        const before = await mxCacheSize();
        try { if (window.mxDbCache) await window.mxDbCache.clear(); } catch (e) {}
        try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
        try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (e) {}
        try {
            localStorage.removeItem('mx_servers');
            Object.keys(sessionStorage).filter(k => k.indexOf('sq_') === 0).forEach(k => sessionStorage.removeItem(k));
        } catch (e) {}
        if (btn) btn.classList.remove('busy');
        if (sub) { sub.textContent = 'Cache cleared. Freed ' + pfBytes(before); setTimeout(() => { sub.textContent = idle; }, 3500); }
        pfCacheRefresh();
    };
    if (typeof showCustomModal === 'function') showCustomModal('confirm', 'Clear cached data on this device? Your account, watch history, My List and settings are not affected.', run);
    else run();
};

// --- WATCH HISTORY page (grouped by day, delete one, clear all) ---
const hsAgo = (at) => {
    const m = Math.floor((Date.now() - at) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    return h < 24 ? h + (h === 1 ? ' hour ago' : ' hours ago') : '';
};
const hsDay = (at) => {
    const d = new Date(at), t = new Date(), y = new Date(Date.now() - 864e5);
    const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    return same(d, t) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};
window.renderHistoryPage = () => {
    const box = document.getElementById('hs-list'), empty = document.getElementById('hs-empty');
    if (!box) return;
    const known = Object.keys(allMovies || {}).length > 0;
    const items = Object.entries(historyMap || {}).filter(([id, e]) => e && (!known || allMovies[id])).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    empty.classList.toggle('hidden', items.length > 0 || !known);   // not "empty" while the movie list is still loading
    document.getElementById('hs-clear').style.display = items.length ? '' : 'none';
    let lastDay = '';
    box.innerHTML = items.map(([id, e]) => {
        const m = allMovies[id]; if (!m) return '';
        const day = hsDay(e.at || Date.now()), head = day !== lastDay ? `<h3 class="hs-day">${esc(day)}</h3>` : ''; lastDay = day;
        const pct = e.done ? 100 : (e.d ? Math.min(100, Math.round(e.t / e.d * 100)) : 0);
        const ep = m.contentType === 'series' && e.ep != null ? `${esc(e.season || 'Season 1')} · Episode ${(+e.ep || 0) + 1}` : '';
        const state = e.done ? 'Finished' : 'Watched ' + pct + '%';
        return head + `
        <div class="ml-row hs-row" onclick="showMovieDetails('${id}')">
            <div class="ml-poster" ${mxT(m)}>${mxImg(m)}${mxBadges(m)}<div class="nf-prog"><i style="width:${pct}%"></i></div></div>
            <div class="ml-info">
                <p class="ml-title">${esc(m.title)}</p>
                ${ep ? `<p class="hs-ep">${ep}</p>` : ''}
                <p class="hs-sub">${state}${hsAgo(e.at || 0) ? ' · ' + hsAgo(e.at || 0) : ''}</p>
            </div>
            <div class="ml-act">
                <span class="ml-play"><i class="fas fa-play"></i></span>
                <button class="hs-rm" onclick="removeFromHistory('${id}', event)" aria-label="Remove from history"><i class="fas fa-times"></i></button>
            </div>
        </div>`;
    }).join('');
    const sub = document.getElementById('pf-hist-sub'); if (sub) sub.textContent = items.length ? items.length + (items.length === 1 ? ' title' : ' titles') + ' watched' : 'Titles you watched recently';
};
window.removeFromHistory = (id, ev) => {
    if (ev) ev.stopPropagation();
    if (!_listUid) return;
    delete historyMap[id]; delete progressMap[id];
    db.ref('users/' + _listUid + '/history/' + id).remove().catch(() => {});
    db.ref('users/' + _listUid + '/progress/' + id).remove().catch(() => {});
    renderHistoryPage(); renderProfileStats();
    if (typeof renderHomePage === 'function' && Object.keys(allMovies).length) renderHomePage();
};
window.clearWatchHistory = () => {
    if (!_listUid) return;
    showCustomModal('confirm', 'Clear your whole watch history? Continue Watching will be cleared too.', () => {
        historyMap = {}; progressMap = {};
        db.ref('users/' + _listUid + '/history').remove().catch(() => {});
        db.ref('users/' + _listUid + '/progress').remove().catch(() => {});
        renderHistoryPage(); renderProfileStats();
        if (typeof renderHomePage === 'function' && Object.keys(allMovies).length) renderHomePage();
    });
};
