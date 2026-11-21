// ===== MovieBox-style details page with the video playing inline at the top =====
let currentSeasonKey = null;   // read by broken-link-reporter.js
let currentEpIndex = -1;
const PL = { mode: null, hls: null, yt: null, vimeo: null, ytTimer: null, wake: null, fake: false, url: '', playing: false, uiTimer: null, nextTimer: null, resumeAt: 0, upgraded: false, started: false, bright: 1, qs: null, level: null, sel: 'auto', auto: false, srcObj: null, epName: null, switching: false, sessSel: null, autoTimer: 0, stallT: 0, stallAt: 0, stalls: [], noUp: {}, failed: {}, lastSwitch: 0, graceUntil: 0, autoH: 0, autoHMovie: null, ghost: null, lastPos: 0, userPaused: false, loadingNow: false, rt: 0, rtTries: 0 };
const $id = (i) => document.getElementById(i);
const fmtT = (s) => { s = Math.max(0, s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = Math.floor(s % 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
// The old single/default video link system is removed: only the 480p / 720p / 1080p links are ever played.

// ---------- multi-quality (480p / 720p / 1080p + Auto) ----------
// A title/episode may carry q480, q720, q1080 (direct links). A box left empty by the admin simply does not exist for the player.
// The old default/single link (server1, server2, link) is gone completely and is never played, even if some old data still carries it.
const QKEYS = ['480', '720', '1080'];
const qNums = (o) => o ? QKEYS.filter(k => typeof o['q' + k] === 'string' && o['q' + k].trim()).map(k => ({ key: k, h: +k, url: o['q' + k].trim() })) : [];
const qSources = (o) => qNums(o);
// closest available height: the same one, else the closest LOWER one (saves data), else the closest higher one
const nearestQ = (hs, want) => {
    if (hs.includes(want)) return want;
    const lo = hs.filter(h => h < want).sort((a, b) => b - a); if (lo.length) return lo[0];
    return hs.filter(h => h > want).sort((a, b) => a - b)[0];
};
const netConn = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
const netStartQ = () => {
    const c = netConn(); if (!c) return 720; if (c.saveData) return 480;
    if (typeof c.downlink === 'number' && c.downlink > 0) return c.downlink >= 6 ? 1080 : c.downlink >= 2.5 ? 720 : 480;
    return c.effectiveType === '4g' ? 720 : 480;
};
const bufAhead = (v) => { try { for (let i = 0; i < v.buffered.length; i++) if (v.currentTime >= v.buffered.start(i) - 0.2 && v.currentTime <= v.buffered.end(i)) return v.buffered.end(i) - v.currentTime; } catch (e) {} return 0; };
// which link to start with: this title's manual pick (session only) > the user's saved default (Settings) > auto
const plChoose = (o) => {
    const L = qSources(o), nums = L.filter(x => x.h);
    if (!nums.length) { PL.qs = null; PL.level = null; PL.auto = false; return { url: '', key: null }; }
    PL.qs = L;
    const hs = nums.map(x => x.h);
    let sel = (PL.sessSel && PL.sessSel.movie === currentMovieId) ? PL.sessSel.key : (typeof mxDefQ === 'function' ? mxDefQ() : 'auto');
    if (sel === 'default') sel = 'auto';
    PL.sel = sel; PL.auto = sel === 'auto';
    let key;
    if (sel === 'default') key = 'default';
    else {
        const want = sel === 'auto' ? ((PL.autoHMovie === currentMovieId && PL.autoH) ? PL.autoH : netStartQ()) : +sel;
        key = String(nearestQ(hs, want));
    }
    const it = L.find(x => x.key === key) || nums[0];
    return { url: it.url, key: it.key };
};
function getYouTubeID(url) { const m = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/); return (m && m[2].length == 11) ? m[2] : url; }
function linkType(u) {
    const l = u.toLowerCase();
    if (l.includes('videasy.net') || l.includes('/embed') || l.includes('drive.google.com')) return 'iframe';
    if (l.includes('vimeo.com')) return 'vimeo';
    if (l.includes('youtube.com') || l.includes('youtu.be')) return 'youtube';
    if (/\.m3u8(\?|#|$)/.test(l)) return 'hls';
    return 'direct';
}
// A title that is still upcoming cannot be played (same rule the lists use: mxReleased). Checked live, so it unlocks by itself at the release time.
const isLocked = (m) => !!m && !mxReleased(m);
// ---------- player messages: ONE slot, so two messages can never overlap ----------
// priority: hold (2x speed, while the finger is down) > note (short message) > busy (long task, e.g. quality loading in the background)
//  - the same note is never shown twice in a row (also not if it is repeated within 2.5 s)
//  - a note on screen stays at least 0.9 s; if more arrive meanwhile only the newest one waits its turn
//  - a busy message stays under the notes and comes back when they are gone
const PLM = { hold: '', busy: '', note: '', q: [], t: 0, since: 0, lastText: '', lastAt: 0 };
const plMsgPaint = () => {
    const el = $id('pl-toast'); if (!el) return;
    const text = PLM.hold || PLM.note || PLM.busy;
    if (!text) { el.classList.remove('on', 'busy'); return; }
    if (el.textContent !== text) el.textContent = text;
    el.classList.add('on'); el.classList.toggle('busy', !PLM.hold && !PLM.note);
};
const plMsgNext = () => {
    clearTimeout(PLM.t); PLM.t = 0; const n = PLM.q.shift(); PLM.note = '';
    if (n) return plMsgShow(n.text, n.ms);
    plMsgPaint();
};
const plMsgShow = (text, ms) => { PLM.note = text; PLM.lastText = text; PLM.lastAt = PLM.since = Date.now(); clearTimeout(PLM.t); PLM.t = setTimeout(plMsgNext, ms); plMsgPaint(); };
const plToast = (msg, ms) => {
    if (!msg) return; ms = ms || 2000;
    if (PLM.note === msg || (PLM.q.length && PLM.q[PLM.q.length - 1].text === msg)) return;       // already showing / already waiting
    if (msg === PLM.lastText && Date.now() - PLM.lastAt < 2500) return;                            // just shown
    if (!PLM.note) return plMsgShow(msg, ms);
    PLM.q = [{ text: msg, ms }];                                                                   // only the newest waiting message is kept
    clearTimeout(PLM.t); PLM.t = setTimeout(plMsgNext, Math.max(0, 900 - (Date.now() - PLM.since)));
};
const plBusy = (msg) => { msg = msg || ''; if (PLM.busy === msg) return; PLM.busy = msg; plMsgPaint(); };
const plFast = (on) => { PLM.hold = on ? '▶▶ 2x speed' : ''; plMsgPaint(); };
const plMsgReset = () => { clearTimeout(PLM.t); PLM.t = 0; PLM.hold = PLM.busy = PLM.note = ''; PLM.q = []; PLM.lastText = ''; PLM.lastAt = 0; plMsgPaint(); };
const plSetRate = (r) => { try { if (PL.mode === 'yt' && PL.yt) PL.yt.setPlaybackRate(r); else if (PL.mode === 'vimeo' && PL.vimeo) PL.vimeo.setPlaybackRate(r); else if (vid()) vid().playbackRate = r; } catch (e) {} };
const plFastEnd = () => { if (!PL._lp) return; PL._lp = false; plFast(false); plSetRate(plSpeed()); plResync(); };

// ---------- sheets (More Info / Share / All episodes) ----------
window.closeSheet = () => { const s = $id('mv-sheet'); if (s) s.remove(); mxScrollLock(false); };
const openSheet = (title, html) => {
    closeSheet();
    const d = document.createElement('div'); d.id = 'mv-sheet'; d.className = 'mv-sheet';
    d.innerHTML = `<div class="mv-sheet-bg" onclick="closeSheet()"></div><div class="mv-sheet-box"><div class="mv-sheet-h"><b>${esc(title)}</b><button onclick="closeSheet()" aria-label="Close"><i class="fas fa-times"></i></button></div><div class="mv-sheet-b">${html}</div></div>`;
    document.body.appendChild(d); mxScrollLock(true);
};

// ---------- details page ----------
window.showMovieDetails = (movieId, push = true, opts) => {
    if (!movieId || !allMovies[movieId]) return;
    // the list is "lite": load this title's episodes + links first (tiny request, cached), then show the page
    const cur = allMovies[movieId];
    if (!cur._full || Date.now() - (cur._fullAt || 0) > 30000) {
        db.ref('movies/' + movieId).once('value').then(snap => {
            const full = snap.val();
            if (!full) { if (typeof showCustomModal === 'function') showCustomModal('alert', 'This title is not available anymore.'); return; }
            allMovies[movieId] = Object.assign({}, full, { _full: true, _fullAt: Date.now() });
            window.showMovieDetails(movieId, push);
        }).catch(() => { if (typeof showCustomModal === 'function') showCustomModal('alert', 'Could not load this title. Check your connection and try again.'); });
        return;
    }
    stopPlayer(true); closeSheet();
    const movie = allMovies[movieId];
    currentMovieId = movieId;
    toggleGlobalHeader(false);

    const upcoming = isLocked(movie), relMs = getReleaseMs(movie);
    const releaseString = upcoming && relMs ? new Date(relMs).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const isSeries = movie.contentType === 'series' && movie.seasons && Object.keys(movie.seasons).length;
    const seasonKeys = isSeries ? Object.keys(movie.seasons) : [];
    PL.resumeAt = 0; PL.started = false;
    currentSeasonKey = isSeries ? seasonKeys[0] : null; currentEpIndex = isSeries ? 0 : -1;
    const pr = progressMap[movieId];
    if (pr && !upcoming) {
        if (isSeries && pr.season && movie.seasons[pr.season] && movie.seasons[pr.season][pr.ep]) { currentSeasonKey = pr.season; currentEpIndex = pr.ep; }
        if (pr.t > 5) PL.resumeAt = pr.t;
    }
    // a link like /movie/<id>/<name>?s=2&e=5 opens that season / episode
    if (opts && isSeries && opts.season > 0) {
        const sk = seasonKeys[opts.season - 1], ei = (opts.ep > 0 ? opts.ep : 1) - 1;
        if (sk && movie.seasons[sk] && movie.seasons[sk][ei]) {
            currentSeasonKey = sk; currentEpIndex = ei; PL.resumeAt = 0;
            const p2 = progressMap[movieId]; if (p2 && p2.season === sk && p2.ep === ei && p2.t > 5) PL.resumeAt = p2.t;
        }
    }
    const cover = movie.coverUrl || movie.posterUrl || '';
    const similar = Object.entries(allMovies).filter(([id, m]) => id !== movieId && mxReleased(m))
        .map(([id, m]) => { const mg = MX.genresOf(movie), ml = MX.langsOf(movie); return [id, m, MX.genresOf(m).filter(g => mg.includes(g)).length * 3 + (m.industry && m.industry === movie.industry ? 2 : 0) + MX.langsOf(m).filter(l => ml.includes(l)).length + (MX.typeOf(m) === MX.typeOf(movie) ? 1 : 0)]; })
        .sort((a, b) => b[2] - a[2]).slice(0, 30);
    const mvLangs = MX.langsOf(movie), mvGenres = MX.genresOf(movie);
    const meta = `<span class="mv-ico"><i class="fas ${isSeries ? 'fa-tv' : 'fa-film'}"></i></span>${movie.rating ? `<span><i class="fas fa-star" style="color:#facc15"></i> ${esc(movie.rating)}</span>` : ''}${movie.year ? `<span>${esc(movie.year)}</span>` : ''}<span>${esc(MX.typeOf(movie))}</span>${movie.industry ? `<span>${esc(movie.industry)}</span>` : ''}${mvLangs.length ? `<span>${esc(mvLangs.join(', '))}${movie.dubbed ? ' (Dubbed)' : ''}</span>` : ''}${mvGenres.length ? `<span>${esc(mvGenres.join(', '))}</span>` : ''}<span>${isSeries ? seasonKeys.length + (seasonKeys.length > 1 ? ' seasons' : ' season') : 'Movie'}</span>`;

    $id('movie-details-content').innerHTML = `
    <div class="mv-wrap">
      <div class="pl-sticky"><div class="pl" id="pl" data-ui="1">
        <div class="pl-bg"><img class="pl-blur" src="${esc(movie.posterUrl)}" alt=""><img class="pl-cover" src="${esc(cover)}" alt=""></div>
        <video id="pl-video" playsinline webkit-playsinline preload="metadata"></video>
        <div id="pl-embed"></div>
        <div class="pl-touch" id="pl-touch"></div>
        <div class="pl-shade"></div>
        <button class="pl-back" onclick="goBack()" aria-label="Back"><i class="fas fa-arrow-left"></i></button>
        <div class="pl-title" id="pl-title">${esc(movie.title)}</div>
        ${upcoming ? `<div class="pl-soon"><i class="fas fa-clock"></i> ${releaseString ? 'Drops: ' + esc(releaseString) : 'Coming Soon'}</div>` : `<button class="pl-big" id="pl-big" onclick="startPlayback()" aria-label="Play"><i class="fas fa-play"></i></button>`}
        <div class="pl-center" id="pl-center">
          <button onclick="plSkip(-10)" aria-label="Back 10s"><i class="fas fa-undo-alt"></i><em>10</em></button>
          <button class="pl-pp" onclick="plToggle()" aria-label="Play/Pause"><i id="pl-pp-i" class="fas fa-play"></i></button>
          <button onclick="plSkip(10)" aria-label="Forward 10s"><i class="fas fa-redo-alt"></i><em>10</em></button>
        </div>
        <div class="pl-spin" id="pl-spin"></div>
        <div class="pl-err" id="pl-err"><i class="fas fa-exclamation-triangle"></i><p id="pl-err-t">Video unavailable</p><button onclick="plRetry()">Retry</button></div>
        <div class="pl-nextcard" id="pl-nextcard"><span id="pl-nextt"></span><button onclick="plCancelNext()">Cancel</button></div>
        <div class="pl-ripple" id="pl-ripple"></div>
        <div class="pl-bar" id="pl-bar">
          <div class="pl-seekrow"><span id="pl-cur">0:00</span><div class="pl-seekwrap"><div class="pl-buf" id="pl-buf"></div><div class="pl-fill" id="pl-fill"></div><input type="range" id="pl-seek" min="0" max="100" step="0.1" value="0"></div><span id="pl-dur">0:00</span></div>
          <div class="pl-btnrow">
            <button onclick="plPrevEp()" id="pl-prev" class="ep-only" aria-label="Previous episode"><i class="fas fa-step-backward"></i></button>
            <button onclick="plNextEp()" id="pl-next" class="ep-only" aria-label="Next episode"><i class="fas fa-step-forward"></i></button>
            <button onclick="plMute()" aria-label="Mute"><i id="pl-vol-i" class="fas fa-volume-up"></i></button>
            <span class="grow"></span>
            <button onclick="plEpsBtn()" class="ep-only pl-fs-only" aria-label="Episodes"><i class="fas fa-list"></i></button>
            <button onclick="plMenu('speed')" id="pl-speed-b" aria-label="Speed"><i class="fas fa-tachometer-alt"></i></button>
            <button onclick="plMenu('quality')" id="pl-q-b" class="hidden" aria-label="Quality"><i class="fas fa-cog"></i></button>
            <button onclick="plPip()" id="pl-pip-b" class="hidden" aria-label="Picture in picture"><i class="far fa-clone"></i></button>
            <button onclick="plFs()" aria-label="Fullscreen"><i id="pl-fs-i" class="fas fa-expand"></i></button>
          </div>
        </div>
        <div class="pl-eps" id="pl-eps"><div class="pl-eps-bg" onclick="plEpsClose()"></div><div class="pl-eps-box"><div class="pl-eps-h"><b>Episodes</b><button onclick="plEpsClose()" aria-label="Close"><i class="fas fa-times"></i></button></div><div id="pl-eps-sel"></div><div class="pl-eps-list" id="pl-eps-list"></div></div></div>
        <div class="pl-pop" id="pl-pop"></div>
        <div class="pl-toast" id="pl-toast"></div>
      </div></div>

      <div class="mv-info">
        <div class="mv-trow"><h1 class="mv-title">${esc(movie.title)}</h1><button class="mv-infob" onclick="openMoreInfo()">Info <i class="fas fa-chevron-right"></i></button></div>
        <div class="mv-meta">${meta}</div>
        <div class="mv-pills no-scrollbar">
          <button class="mv-pill" data-mylist="${movieId}" onclick="toggleMyList('${movieId}')"><i class="fas fa-plus"></i> <span class="lbl">Add to list</span></button>
          <button class="mv-pill" onclick="openShare()"><i class="fas fa-share-alt"></i> Share</button>
        </div>
        ${isSeries ? `<div class="mv-res"><h3>Resources</h3>
          <div class="mv-sel">${seasonKeys.length ? `<select id="mv-season" onchange="selectSeason(this.value)">${seasonKeys.map(k => `<option value="${esc(k)}" ${k === currentSeasonKey ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : ''}</div>
          <div class="mv-eps" id="mv-eps"></div></div>` : ''}
      </div>

      <div class="mv-side"><div class="mv-tabs"><span>For you</span></div>
        <div class="mx-grid">${similar.map(([id, m]) => mxGridCard(id, m)).join('') || '<p class="nf-empty">Nothing to show yet.</p>'}</div>
      </div>
    </div>`;

    pages.forEach(p => p.classList.toggle('active', p.id === 'movie-details-page'));
    navBtns.forEach(b => { b.classList.remove('text-blue-500'); b.classList.add('text-gray-400'); });
    window.scrollTo(0, 0);
    localStorage.setItem('last_page_id', 'movie-details-page');
    localStorage.setItem('last_movie_id', movieId);
    const epq = (opts && opts.season > 0 && isSeries) ? [seasonKeys.indexOf(currentSeasonKey) + 1, currentEpIndex + 1] : [0, 0];
    MXR.nav(MXR.movieUrl(movieId, movie.title, epq[0], epq[1]), { page: 'movie-details-page', movieId }, !push);
    MXR.setTitle(movie.title);

    plBind();
    $id('pl').classList.toggle('is-series', !!isSeries);
    if (isSeries) renderEpRow();
    refreshListUI();
};

// ---------- episodes ----------
window.selectSeason = (k) => { currentSeasonKey = k; renderEpRow(); };
const renderEpRow = () => {
    const movie = allMovies[currentMovieId]; const box = $id('mv-eps'); if (!box) return;
    const eps = movie.seasons[currentSeasonKey] || [];
    if (isLocked(movie)) { box.innerHTML = '<span class="nf-empty" style="padding:8px">Episodes will be available after release.</span>'; return; }
    if (!eps.length) {
        box.innerHTML = '<span class="nf-empty" style="padding:8px">No episodes released yet.</span>';
        return;
    }

    // Keep "All" fixed in the row. Only the episode buttons are horizontally scrollable.
    // Recreating the inner scroller also resets its position when the season changes.
    box.innerHTML = `<button class="mv-ep all" type="button" onclick="openAllEps()">All</button>
        <div class="mv-eps-scroll no-scrollbar" aria-label="Episodes">
            ${eps.map((e, i) => `<button class="mv-ep ${i === currentEpIndex && PL.mode ? 'on' : ''}" type="button" title="${esc(e.name)}" onclick="playEpisode(${i})">${String(i + 1).padStart(2, '0')}</button>`).join('')}
        </div>`;
};
window.openAllEps = () => {
    const movie = allMovies[currentMovieId]; if (isLocked(movie)) return plToast('Coming soon'); const keys = Object.keys(movie.seasons || {});
    const grid = () => (movie.seasons[currentSeasonKey] || []).map((e, i) => `<button class="mv-ep ${i === currentEpIndex ? 'on' : ''}" onclick="closeSheet();playEpisode(${i})">${String(i + 1).padStart(2, '0')}</button>`).join('');
    openSheet('Episodes', `${keys.length > 1 ? `<select class="mv-sheet-sel" onchange="selectSeason(this.value);document.getElementById('mv-sheet-grid').innerHTML=window.__epGrid()">${keys.map(k => `<option ${k === currentSeasonKey ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : ''}<div class="mv-sheet-grid" id="mv-sheet-grid">${grid()}</div>`);
    window.__epGrid = grid;
};
// Episode list that opens INSIDE the player, so fullscreen stays on.
let plEpSeason = null;
const plEpsRender = () => {
    const m = allMovies[currentMovieId], box = $id('pl-eps-list'), sel = $id('pl-eps-sel'); if (!m || !box || !m.seasons) return;
    const keys = Object.keys(m.seasons); if (plEpSeason == null || !m.seasons[plEpSeason]) plEpSeason = currentSeasonKey;
    sel.innerHTML = keys.length > 1 ? `<select onchange="plEpsSeason(this.value)">${keys.map(k => `<option value="${esc(k)}" ${k === plEpSeason ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : '';
    box.innerHTML = (m.seasons[plEpSeason] || []).map((e, i) => `<button type="button" class="${plEpSeason === currentSeasonKey && i === currentEpIndex ? 'on' : ''}" onclick="plEpsPlay(${i})"><span>${String(i + 1).padStart(2, '0')}</span><em>${esc(e.name || 'Episode ' + (i + 1))}</em></button>`).join('');
    const on = box.querySelector('.on'); if (on) box.scrollTop = Math.max(0, on.offsetTop - box.clientHeight / 2 + on.offsetHeight / 2);
};
window.plEpsSeason = (k) => { plEpSeason = k; plEpsRender(); };
window.plEpsPlay = (i) => { if (plEpSeason && plEpSeason !== currentSeasonKey) currentSeasonKey = plEpSeason; plEpsClose(); playEpisode(i); };
window.plEpsBtn = () => { const p = $id('pl-eps'); if (!p) return; plEpSeason = currentSeasonKey; const pop = $id('pl-pop'); if (pop) pop.classList.remove('on'); p.classList.add('on'); plEpsRender(); plShowUI(true); };
window.plEpsClose = () => { const p = $id('pl-eps'); if (p) p.classList.remove('on'); if (PL.playing) plShowUI(); };
window.playEpisode = (i) => {
    const movie = allMovies[currentMovieId]; if (isLocked(movie)) return plToast('Coming soon'); const eps = movie.seasons && movie.seasons[currentSeasonKey]; if (!eps || !eps[i]) return;
    currentEpIndex = i; PL.resumeAt = 0;
    MXR.nav(MXR.movieUrl(currentMovieId, movie.title, Object.keys(movie.seasons).indexOf(currentSeasonKey) + 1, i + 1), { page: 'movie-details-page', movieId: currentMovieId }, true);
    const pr = progressMap[currentMovieId]; if (pr && pr.season === currentSeasonKey && pr.ep === i && pr.t > 5) PL.resumeAt = pr.t;
    const sel = $id('mv-season'); if (sel) sel.value = currentSeasonKey;
    renderEpRow(); window.scrollTo({ top: 0, behavior: 'smooth' });
    plLoad(eps[i], eps[i].name);
};
const epList = () => { const m = allMovies[currentMovieId]; return (m && m.seasons && m.seasons[currentSeasonKey]) || []; };
window.plNextEp = () => { if (currentEpIndex + 1 < epList().length) playEpisode(currentEpIndex + 1); };
window.plPrevEp = () => { if (currentEpIndex > 0) playEpisode(currentEpIndex - 1); };

// ---------- More Info / Share ----------
window.openMoreInfo = () => {
    const m = allMovies[currentMovieId]; if (!m) return;
    const row = (k, v) => v ? `<div class="mv-kv"><span>${k}</span><b>${esc(v)}</b></div>` : '';
    openSheet('Info', `<h2 class="mv-sheet-t">${esc(m.title)}</h2>${row('Type', MX.typeOf(m))}${row('Industry / Country', m.industry)}${row('Language', MX.langsOf(m).join(', ') + (m.dubbed && MX.langsOf(m).length ? ' (Dubbed)' : ''))}${row('Genres', MX.genresOf(m).join(', '))}${row('Rating', m.rating)}${row('Year', m.year)}${m.contentType === 'series' && m.seasons ? row('Seasons', Object.keys(m.seasons).length) : ''}${row('Cast', m.cast)}<p class="mv-desc">${esc(m.description || 'No description available for this title.')}</p>`);
};
const shareUrl = () => location.origin + MXR.movieUrl(currentMovieId, (allMovies[currentMovieId] || {}).title);
window.openShare = () => {
    const m = allMovies[currentMovieId]; if (!m) return; const u = encodeURIComponent(shareUrl()), t = encodeURIComponent(m.title + ' - watch now');
    openSheet('Share', `<div class="mv-share">
        <button onclick="copyShare()"><i class="fas fa-link"></i><span>Copy Link</span></button>
        <a href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i><span>WhatsApp</span></a>
        <a href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener"><i class="fab fa-telegram-plane"></i><span>Telegram</span></a>
        ${navigator.share ? `<button onclick="nativeShare()"><i class="fas fa-share-square"></i><span>More apps</span></button>` : ''}
        <button onclick="reportTitle()"><i class="fas fa-flag"></i><span>Report</span></button></div>`);
};
window.copyShare = () => {
    const u = shareUrl(); const done = () => { closeSheet(); plToast('Link copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(done, () => fallbackCopy(u, done)); else fallbackCopy(u, done);
};
const fallbackCopy = (u, done) => { const t = document.createElement('textarea'); t.value = u; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} t.remove(); done(); };
window.nativeShare = () => { const m = allMovies[currentMovieId]; navigator.share({ title: m.title, text: m.title + ' - watch now', url: shareUrl() }).catch(() => {}); closeSheet(); };
window.reportTitle = () => {
    const m = allMovies[currentMovieId]; const eps = epList();
    const src = m.contentType === 'series' ? eps[currentEpIndex] : m, q = qSources(src)[0];
    const link = PL.started && PL.url ? PL.url : (q ? q.url : '');
    reportBrokenLink('user-report', link || ''); closeSheet(); plToast('Thanks, reported');
};
// ---------- player engine ----------
const vid = () => $id('pl-video');
const plCur = () => PL.mode === 'yt' && PL.yt && PL.yt.getCurrentTime ? PL.yt.getCurrentTime() : PL.mode === 'vimeo' ? (PL._vt || 0) : (vid() ? vid().currentTime : 0);
const plDurV = () => PL.mode === 'yt' && PL.yt && PL.yt.getDuration ? PL.yt.getDuration() : PL.mode === 'vimeo' ? (PL._vd || 0) : (vid() ? vid().duration : 0);
const plIcon = () => { const i = $id('pl-pp-i'); if (i) i.className = (PL.playing || (PL.loadingNow && PL.started && !PL.userPaused)) ? 'fas fa-pause' : 'fas fa-play'; };
const setPlaying = (p) => { PL.playing = p; plIcon(); const pl = $id('pl'); if (pl) pl.classList.toggle('playing', p); if (p) { plShowUI(); wakeOn(); } else { wakeOff(); plShowUI(true); } };
const spin = (on) => { PL.loadingNow = !!on; const s = $id('pl-spin'); if (s) s.style.display = on ? 'block' : 'none'; const pl = $id('pl'); if (pl) pl.classList.toggle('loading', !!on); plIcon(); };
const wakeOn = async () => { try { if (navigator.wakeLock && !PL.wake) { PL.wake = await navigator.wakeLock.request('screen'); PL.wake.addEventListener('release', () => PL.wake = null); } } catch (e) {} };
const wakeOff = () => { try { if (PL.wake) PL.wake.release(); } catch (e) {} PL.wake = null; };

window.startPlayback = () => {
    const m = allMovies[currentMovieId]; if (!m) return; if (isLocked(m)) return plToast('Coming soon');
    if (m.contentType === 'series' && m.seasons) { const e = epList()[currentEpIndex]; if (!e) return plToast('No episodes yet'); plLoad(e, e.name); renderEpRow(); }
    else plLoad(m, null);
};
const plLoad = (arg, epName, opts) => {
    opts = opts || {};
    if (isLocked(allMovies[currentMovieId])) { plToast('Coming soon'); return; }
    const srcObj = (arg && typeof arg === 'object') ? arg : {};
    let url;
    if (opts.url) url = opts.url;   // quality switch: the link is already chosen
    else { const pk = plChoose(srcObj); url = pk.url; PL.level = pk.key; PL.failed = {}; PL.noUp = {}; PL.stalls = []; PL.userPaused = false; PL.lastPos = PL.resumeAt || 0; }
    if (!url) { plShowErr('Video link is not available right now.'); return; }
    PL.srcObj = srcObj; PL.epName = epName; PL.rt = PL.resumeAt > 1 ? PL.resumeAt : 0; PL.rtTries = 0;
    plTeardown(); $id('pl-err').classList.remove('on'); plCancelNext();
    PL.switching = !!opts.switching; PL.lastSwitch = Date.now(); PL.graceUntil = Date.now() + 8000; PL.stallAt = 0;
    const qb = $id('pl-q-b'); if (qb) qb.classList.toggle('hidden', !(PL.qs && PL.qs.length >= 1));
    const pl = $id('pl'); pl.classList.add('started'); PL.started = true; PL.upgraded = false; plShowUI(true);
    $id('pl-title').textContent = epName ? allMovies[currentMovieId].title + ' · ' + epName : allMovies[currentMovieId].title;
    const mode = linkType(url); PL.url = url;
    pl.classList.toggle('is-embed', mode === 'iframe');
    if (url.includes('dropbox.com')) url = url.replace('dl=0', 'raw=1');
    spin(true);
    if (mode === 'iframe') { PL.mode = 'iframe'; $id('pl-embed').innerHTML = `<iframe src="${esc(url)}" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`; spin(false); setPlaying(true); return; }
    if (mode === 'youtube') {
        PL.mode = 'yt'; $id('pl-embed').innerHTML = '<div id="yt-player"></div>';
        PL.yt = new YT.Player('yt-player', { height: '100%', width: '100%', videoId: getYouTubeID(url), playerVars: { controls: 0, rel: 0, modestbranding: 1, disablekb: 1, playsinline: 1, autoplay: 1, origin: location.origin }, events: {
            onReady: (e) => { spin(false); if (PL.resumeAt) e.target.seekTo(PL.resumeAt, true); e.target.setPlaybackRate(plSpeed()); e.target.playVideo(); PL.ytTimer = setInterval(plTick, 500); },
            onStateChange: (e) => { spin(e.data === 3); setPlaying(e.data === 1); if (e.data === 0) plEnded(); },
            onError: () => plFail('youtube', url) } });
        return;
    }
    if (mode === 'vimeo') {
        PL.mode = 'vimeo'; const vId = url.includes('vimeo.com/') ? url.split('/').pop() : url;
        $id('pl-embed').innerHTML = `<iframe src="https://player.vimeo.com/video/${vId}?badge=0&autopause=0&controls=0&playsinline=1" width="100%" height="100%" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
        PL.vimeo = new Vimeo.Player($id('pl-embed').querySelector('iframe'));
        PL.vimeo.on('timeupdate', (d) => { PL._vt = d.seconds; PL._vd = d.duration; spin(false); plTick(); });
        PL.vimeo.on('play', () => setPlaying(true)); PL.vimeo.on('pause', () => setPlaying(false)); PL.vimeo.on('ended', plEnded);
        PL.vimeo.on('bufferstart', () => spin(true)); PL.vimeo.on('bufferend', () => spin(false));
        PL.vimeo.on('error', () => plFail('vimeo', url));
        PL.vimeo.ready().then(() => { if (PL.resumeAt) PL.vimeo.setCurrentTime(PL.resumeAt); PL.vimeo.setPlaybackRate(plSpeed()); PL.vimeo.play().catch(() => {}); });
        return;
    }
    // direct file or HLS
    PL.mode = mode; const v = vid(); v.style.display = 'block';
    if (location.protocol === 'https:' && url.startsWith('http://')) { url = 'https://' + url.slice(7); PL.upgraded = true; }
    bindVideo(v);
    if (mode === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
        if (window.Hls && Hls.isSupported()) {
            PL.hls = new Hls({ maxBufferLength: 40, startPosition: PL.resumeAt > 0 ? PL.resumeAt : -1 }); PL.hls.loadSource(url); PL.hls.attachMedia(v);
            PL.hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!PL.qs && PL.hls.levels.length > 1) $id('pl-q-b').classList.remove('hidden'); if (!opts.keepPaused && !PL.userPaused) v.play().catch(() => setPlaying(false)); });
            PL.hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) plFail('hls', url); });
        } else return plFail('hls', url);
    } else { v.src = url; v.load(); if (!opts.keepPaused && !PL.userPaused) v.play().catch(() => setPlaying(false)); }
    if ('pictureInPictureEnabled' in document || v.webkitSetPresentationMode) $id('pl-pip-b').classList.remove('hidden');
    v.playbackRate = plSpeed(); v.volume = parseFloat(localStorage.getItem('pl_vol') || '1');
    plAutoStart(); if (!opts.keepPaused) plWatchStart();
};
// Some browsers ignore the first seek made right after the metadata loads: check once more when the video can play, so it never restarts from 0:00.
const plFixResume = (v) => {
    if (!PL.rt) return;
    if (v.currentTime > PL.rt - 3) { PL.rt = 0; return; }
    if (PL.rtTries++ < 2 && v.seekable && v.seekable.length) { try { v.currentTime = PL.rt; } catch (e) {} } else PL.rt = 0;
};
// Picture and sound can drift apart (mostly after the 2x hold). A seek to the same second makes the browser line them up again.
const plResync = () => { const v = vid(); if (!v || PL.mode === 'yt' || PL.mode === 'vimeo' || PL.mode === 'iframe' || v.paused || v.seeking || bufAhead(v) < 2) return; try { v.currentTime = v.currentTime; } catch (e) {} };
// Watches the shown frame against the playback clock; if they stay apart for a while it re-aligns them by itself.
const plDriftWatch = (v) => {
    if (!v || typeof v.requestVideoFrameCallback !== 'function' || v._dw) return; v._dw = true;
    let bad = 0, lastFix = 0;
    const cb = (now, md) => {
        if (vid() !== v) return;   // this element was replaced
        try {
            if (!v.paused && !v.seeking && v.readyState >= 3 && PL.playing && md && typeof md.mediaTime === 'number') {
                bad = Math.abs(v.currentTime - md.mediaTime) > 0.45 ? bad + 1 : 0;
                if (bad >= 8 && Date.now() - lastFix > 6000) { bad = 0; lastFix = Date.now(); plResync(); }
            } else bad = 0;
        } catch (e) {}
        v.requestVideoFrameCallback(cb);
    };
    v.requestVideoFrameCallback(cb);
};
const bindVideo = (v) => {
    plDriftWatch(v);
    v.onloadedmetadata = () => { if (PL.resumeAt && PL.resumeAt < v.duration - (PL.switching ? 1 : 5)) v.currentTime = PL.resumeAt; else PL.rt = 0; PL.resumeAt = 0; PL.switching = false; };
    v.onwaiting = () => { spin(true); plStallStart(v); }; v.oncanplay = () => { spin(false); plFixResume(v); }; v.onseeked = () => plFixResume(v); v.onplaying = () => { spin(false); setPlaying(true); plStallEnd(); }; v.onseeking = () => { PL.graceUntil = Date.now() + 4000; };
    v.onpause = () => { setPlaying(false); plSave(true); }; v.onended = plEnded;
    v.ontimeupdate = plTick; v.onprogress = plBuf;
    v.onerror = () => { if (!v.getAttribute('src') || (v.error && v.error.code === 1)) return; plFail(PL.mode, PL.url); };
};
const plFail = (type, url) => {
    spin(false); setPlaying(false);
    if (PL.qs && PL.level) {   // this quality's link is broken: report it, then try the closest working one
        PL.failed[PL.level] = 1;
        try { reportBrokenLink(type, url); } catch (e) {}
        const cur = +PL.level || 0;
        const cand = PL.qs.filter(x => x.h && !PL.failed[x.key]).sort((a, b) => ((a.h < cur) ? 0 : 1) - ((b.h < cur) ? 0 : 1) || Math.abs(a.h - cur) - Math.abs(b.h - cur) || a.h - b.h)[0];
        if (cand) { plToast('Could not play ' + cur + 'p, switching to ' + cand.h + 'p'); PL.autoH = cand.h; PL.autoHMovie = currentMovieId; plSwitch(cand.key, { force: true, fallback: true }); return; }
    }
    plShowErr(PL.upgraded ? 'This link is not secure (http) and could not be opened. Please tell the admin to use https.' : 'This video could not be loaded.');
    try { reportBrokenLink(type, url); } catch (e) {}
};
const plShowErr = (t) => { const e = $id('pl-err'); if (!e) return; $id('pl-err-t').textContent = t; e.classList.add('on'); };
window.plRetry = () => { $id('pl-err').classList.remove('on'); const m = allMovies[currentMovieId]; if (m.contentType === 'series') { const e = epList()[currentEpIndex]; plLoad(e, e.name); } else plLoad(m, null); };
const plTick = () => {
    const c = plCur(), d = plDurV(); if (!(d > 0)) return; PL.dur = d; if (c > 0.5 && !PL.switching) PL.lastPos = c;
    if (!$id('pl-seek').dataset.drag) { $id('pl-seek').max = d; $id('pl-seek').value = c; $id('pl-fill').style.width = (c / d * 100) + '%'; $id('pl-cur').textContent = fmtT(c); }
    $id('pl-dur').textContent = fmtT(d);
    plSave(false);
};
const plBuf = () => { const v = vid(); if (v && v.buffered.length && v.duration) $id('pl-buf').style.width = (v.buffered.end(v.buffered.length - 1) / v.duration * 100) + '%'; };
const plSave = (force) => { const m = allMovies[currentMovieId]; if (!m || !PL.started || PL.switching) return; if (plCur() >= 30 && typeof mxCountPlay === 'function') mxCountPlay(currentMovieId); saveProgress(currentMovieId, currentSeasonKey, currentEpIndex < 0 ? null : currentEpIndex, plCur(), plDurV(), force); };
const plEnded = () => {
    setPlaying(false); saveProgress(currentMovieId, currentSeasonKey, currentEpIndex, 1, 1, true);
    if (currentEpIndex > -1 && currentEpIndex + 1 < epList().length) {
        let n = 5; const t = $id('pl-nextt'); $id('pl-nextcard').classList.add('on'); t.textContent = 'Next episode in ' + n;
        PL.nextTimer = setInterval(() => { n--; if (n <= 0) { plCancelNext(); plNextEp(); } else t.textContent = 'Next episode in ' + n; }, 1000);
    }
};
window.plCancelNext = () => { clearInterval(PL.nextTimer); const c = $id('pl-nextcard'); if (c) c.classList.remove('on'); };
const plTeardown = () => {
    plGhostCancel(); PL._lp = false; plFast(false); clearInterval(PL.autoTimer); clearTimeout(PL.stallT); clearTimeout(PL.wdT); PL.autoTimer = 0; PL.stallT = 0;
    clearInterval(PL.ytTimer); try { if (PL.yt && PL.yt.destroy) PL.yt.destroy(); } catch (e) {} PL.yt = null;
    try { if (PL.vimeo && PL.vimeo.destroy) PL.vimeo.destroy(); } catch (e) {} PL.vimeo = null;
    if (PL.hls) { PL.hls.destroy(); PL.hls = null; }
    const v = vid(); if (v) { v.onerror = null; v.pause(); v.removeAttribute('src'); v.load(); v.style.display = 'none'; }
    const e = $id('pl-embed'); if (e) e.innerHTML = '';
    PL.mode = null; PL._vt = 0; PL._vd = 0; setPlaying(false);
};
window.stopPlayer = (force) => {
    const v = vid();
    if (!force && v && document.pictureInPictureElement === v) return;   // keep playing in the PiP window
    if (PL.started) plSave(true);
    plCancelNext(); plTeardown(); PL.started = false; plExitFs(true);
    try { if (document.pictureInPictureElement) document.exitPictureInPicture(); } catch (e) {}
};

// ---------- controls ----------
const PL_SWIPE_VB = false;   // swipe volume/brightness only changed the video's own level (not the phone's real one): off. The phone's own buttons / the browser's gestures control the real volume and brightness.
const plSpeed = () => parseFloat(localStorage.getItem('pl_speed') || '1');
window.plToggle = () => {
    if (!PL.started) return startPlayback();
    if (PL.mode === 'yt' && PL.yt) return PL.yt.getPlayerState() === 1 ? PL.yt.pauseVideo() : PL.yt.playVideo();
    if (PL.mode === 'vimeo' && PL.vimeo) return PL.playing ? PL.vimeo.pause() : PL.vimeo.play();
    const v = vid(); if (!v) return;
    // "playing" also means: started and still loading/buffering. Pause must work at that moment too.
    const going = PL.playing || (PL.loadingNow && !PL.userPaused);
    if (going) { PL.userPaused = true; v.pause(); spin(false); setPlaying(false); }
    else { PL.userPaused = false; v.play().catch(() => {}); if (v.readyState < 3) spin(true); plIcon(); }
};
window.plSkip = (d) => {
    const t = Math.max(0, Math.min((plDurV() || 1e9), plCur() + d));
    if (PL.mode === 'yt' && PL.yt) PL.yt.seekTo(t, true); else if (PL.mode === 'vimeo' && PL.vimeo) PL.vimeo.setCurrentTime(t); else if (vid()) vid().currentTime = t;
    plRipple(d > 0 ? 'right' : 'left', (d > 0 ? '+' : '') + d + 's'); plShowUI();
};
const plRipple = (side, txt) => { const r = $id('pl-ripple'); r.className = 'pl-ripple ' + side + ' on'; r.textContent = txt; clearTimeout(plRipple._t); plRipple._t = setTimeout(() => r.classList.remove('on'), 500); };
window.plMute = () => { const v = vid(); if (PL.mode === 'yt' && PL.yt) { PL.yt.isMuted() ? PL.yt.unMute() : PL.yt.mute(); } else if (v) { v.muted = !v.muted; $id('pl-vol-i').className = v.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up'; } };
window.plMenu = (kind) => {
    const pop = $id('pl-pop'); if (pop.dataset.k === kind && pop.classList.contains('on')) { pop.classList.remove('on'); return; }
    let items = [];
    if (kind === 'speed') items = [0.5, 0.75, 1, 1.25, 1.5, 2].map(s => `<button class="${s === plSpeed() ? 'on' : ''}" onclick="plSetSpeed(${s})">${s === 1 ? 'Normal' : s + 'x'}</button>`);
    else if (PL.qs) {
        const nums = PL.qs.filter(x => x.h).sort((a, b) => b.h - a.h), def = PL.qs.find(x => !x.h);
        if (nums.length === 1 && !def) items = [`<button class="on" onclick="document.getElementById('pl-pop').classList.remove('on')">${nums[0].h}p</button>`];   // only one link: just show which quality is playing
        else items = [`<button class="${PL.auto ? 'on' : ''}" onclick="plPickQ('auto')">Auto${PL.auto && PL.level && PL.level !== 'default' ? ' <small>(' + PL.level + 'p)</small>' : ''}</button>`]
            .concat(nums.map(x => `<button class="${!PL.auto && PL.level === x.key ? 'on' : ''}" onclick="plPickQ('${x.key}')">${x.h}p</button>`));
        if (def) items.push(`<button class="${!PL.auto && PL.level === 'default' ? 'on' : ''}" onclick="plPickQ('default')">Default</button>`);
    }
    else if (PL.hls) items = [`<button class="${PL.hls.currentLevel === -1 ? 'on' : ''}" onclick="plSetQ(-1)">Auto</button>`].concat(PL.hls.levels.map((l, i) => ({ h: l.height, i })).sort((a, b) => b.h - a.h).map(o => `<button class="${PL.hls.currentLevel === o.i ? 'on' : ''}" onclick="plSetQ(${o.i})">${o.h}p</button>`));
    pop.dataset.k = kind; pop.innerHTML = items.join(''); pop.classList.add('on'); plShowUI();
};
window.plSetSpeed = (s) => { localStorage.setItem('pl_speed', s); if (PL.mode === 'yt' && PL.yt) PL.yt.setPlaybackRate(s); else if (PL.mode === 'vimeo' && PL.vimeo) PL.vimeo.setPlaybackRate(s); else if (vid()) vid().playbackRate = s; $id('pl-pop').classList.remove('on'); };
window.plSetQ = (i) => { if (PL.hls) PL.hls.currentLevel = i; $id('pl-pop').classList.remove('on'); };
// ---------- seamless quality switch ----------
// The new quality loads in a hidden second <video> while the current one keeps playing. When it has buffered at the exact second the
// viewer is at, the two are swapped: no frozen picture while loading and no restart from the beginning.
const plGhostCancel = () => {
    const G = PL.ghost; if (!G) return; PL.ghost = null; plBusy('');
    clearTimeout(G.timer); clearInterval(G.iv);
    try { if (G.hls) G.hls.destroy(); } catch (e) {}
    try { G.g.pause(); G.g.removeAttribute('src'); G.g.load(); G.g.remove(); } catch (e) {}
};
// The wanted quality could not load. Keep the picture the viewer already has; if there is a quality in between, try that one.
const plGhostFailed = (G) => {
    PL.failed[G.key] = 1; PL.noUp[G.h] = Date.now() + 180000;
    const cur = +PL.level || 0, want = G.h;
    const mid = (PL.qs || []).filter(x => x.h && !PL.failed[x.key] && (want > cur ? (x.h > cur && x.h < want) : (x.h < cur && x.h > want))).sort((a, b) => want > cur ? b.h - a.h : a.h - b.h)[0];
    if (mid) { plSwitch(mid.key, Object.assign({}, G.o, { busy: want + 'p could not load · trying ' + mid.h + 'p…' })); return; }
    if (G.o.onFail) G.o.onFail();
    plToast(want + 'p could not load, staying on ' + (cur ? cur + 'p' : 'current quality'));
};
const plGhostSwitch = (it, o) => {
    const old = vid(), pl = $id('pl');
    if (!old || !pl || !PL.started || !(PL.mode === 'direct' || PL.mode === 'hls') || document.pictureInPictureElement === old) return false;
    let url = it.url; const mode = linkType(url);
    if (mode !== 'direct' && mode !== 'hls') return false;
    if (url.includes('dropbox.com')) url = url.replace('dl=0', 'raw=1');
    let upgraded = false; if (location.protocol === 'https:' && url.startsWith('http://')) { url = 'https://' + url.slice(7); upgraded = true; }
    plGhostCancel();
    const cur = plCur(), target = cur > 1 ? cur : (PL.lastPos || 0);
    const g = document.createElement('video');
    g.setAttribute('playsinline', ''); g.setAttribute('webkit-playsinline', ''); g.playsInline = true; g.preload = 'auto'; g.muted = true;
    g.style.cssText = 'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
    const G = { g, hls: null, key: it.key, h: it.h, url, mode, o, stage: 0, tries: 0, upgraded, timer: 0, iv: 0 };
    PL.ghost = G;
    const live = () => PL.ghost === G;
    const fail = () => { if (!live()) return; plGhostCancel(); plGhostFailed(G); };
    const swap = () => {
        if (!live()) return; PL.ghost = null; clearTimeout(G.timer); clearInterval(G.iv);
        const o2 = vid(); if (!o2) { try { g.remove(); } catch (e) {} return; }
        g.removeAttribute('style'); g.style.cssText = o2.style.cssText; g.id = 'pl-video'; o2.id = '';
        g.muted = o2.muted; try { g.volume = o2.volume; } catch (e) {} g.playbackRate = PL._lp ? 2 : plSpeed();
        o2.parentNode.insertBefore(g, o2);
        ['onerror', 'onpause', 'onwaiting', 'onplaying', 'oncanplay', 'onended', 'ontimeupdate', 'onprogress', 'onseeking', 'onseeked', 'onloadedmetadata'].forEach(k => { o2[k] = null; });
        try { o2.pause(); o2.removeAttribute('src'); o2.load(); } catch (e) {}
        o2.remove();
        try { if (PL.hls) PL.hls.destroy(); } catch (e) {} PL.hls = G.hls;
        PL.level = G.key; PL.url = G.url; PL.mode = G.mode; PL.upgraded = G.upgraded; PL.switching = false; PL.rt = 0;
        PL.lastSwitch = Date.now(); PL.graceUntil = Date.now() + 6000; PL.stallAt = 0; clearTimeout(PL.stallT); PL.stallT = 0;
        bindVideo(g); plBuf();
        if (!PL.userPaused) g.play().catch(() => {}); else setPlaying(false);
        spin(false); plBusy(''); plToast((PL.auto ? 'Auto: now ' : 'Quality changed to ') + G.h + 'p');
        plAutoStart();
    };
    const step = () => {
        if (!live()) return;
        if (G.stage === 1) {
            const left = (g.duration || 0) - g.currentTime;
            if (g.readyState >= 3 && g.currentTime >= target - 1 && (bufAhead(g) >= 5 || left < 6)) {
                G.stage = 2; try { g.pause(); } catch (e) {}
            }
        }
        if (G.stage === 2) {
            if (g.seeking || g.readyState < 3) return;
            const now = old.currentTime;
            if (Math.abs(g.currentTime - now) <= 0.6 || G.tries >= 6) return swap();
            G.tries++; try { g.currentTime = now + (old.paused ? 0 : 0.5); } catch (e) {}
        }
    };
    const start = () => {
        if (!live() || G.stage !== 0) return; G.stage = 1;
        if (!G.hls && target > 1) { try { g.currentTime = target; } catch (e) {} }
        g.play().catch(() => {});
    };
    g.addEventListener('loadedmetadata', start);
    ['canplay', 'progress', 'seeked', 'playing', 'timeupdate'].forEach(ev => g.addEventListener(ev, step));
    g.addEventListener('error', fail);
    G.iv = setInterval(step, 400);
    G.timer = setTimeout(fail, 25000);   // never waits forever
    pl.appendChild(g);
    if (mode === 'hls' && !g.canPlayType('application/vnd.apple.mpegurl')) {
        if (window.Hls && Hls.isSupported()) {
            G.hls = new Hls({ maxBufferLength: 40, startPosition: target > 1 ? target : -1 });
            G.hls.loadSource(url); G.hls.attachMedia(g);
            G.hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) fail(); });
        } else { plGhostCancel(); return false; }
    } else { g.src = url; g.load(); }
    plBusy(o.busy || ('Changing to ' + it.h + 'p in background…'));
    return true;
};
// Switch to another quality link and carry on from the exact second the viewer reached (play/pause state is kept too).
const plSwitch = (key, o) => {
    o = o || {};
    if (!PL.qs || !PL.srcObj) return;
    const it = PL.qs.find(x => x.key === key); if (!it || (key === PL.level && !o.force)) return;
    if (o.fallback) { PL.sessSel = { movie: currentMovieId, key: 'auto' }; PL.sel = 'auto'; PL.auto = true; }   // chosen quality could not load: carry on in Auto for this title only (saved default stays)
    if (!o.force && plGhostSwitch(it, o)) return true;            // current video keeps playing while the new quality loads
    const cur = plCur(), t = PL.mode === 'iframe' ? 0 : (cur > 1 ? cur : (PL.lastPos || 0));   // never fall back to 0:00 when the new link was not loaded yet
    if (!o.force) plSave(true);                                   // remember the position first
    PL.resumeAt = t > 1 ? t : 0; PL.level = key;
    plLoad(PL.srcObj, PL.epName, { switching: true, url: it.url, keepPaused: !o.force && PL.userPaused });
    return false;
};
// the viewer picked a quality in the player: valid for this title until they leave it; the saved default is never changed here
window.plPickQ = (key) => {
    $id('pl-pop').classList.remove('on');
    if (!PL.qs) return;
    const prev = { sel: PL.sel, auto: PL.auto, ss: PL.sessSel };
    const opts = { onFail: () => { PL.sel = prev.sel; PL.auto = prev.auto; PL.sessSel = prev.ss; } };
    PL.sessSel = { movie: currentMovieId, key }; PL.sel = key; PL.auto = key === 'auto';
    if (key === 'auto') {
        PL.noUp = {};
        const hs = PL.qs.filter(x => x.h).map(x => x.h);
        const started = (!PL.level || PL.level === 'default') ? plSwitch(String(nearestQ(hs, netStartQ())), opts) : (plAutoStart(), false);
        if (!started) plToast('Auto quality');
    } else { plSwitch(key, opts); plAutoStart(); }
};
// ----- Auto: start from the network speed, step down when it keeps buffering, step up slowly when it is smooth -----
const plAutoLevels = () => (PL.qs || []).filter(x => x.h).map(x => x.h).sort((a, b) => a - b);
const plStallStart = (v) => {
    if (!PL.qs || PL.switching || v.seeking || Date.now() < PL.graceUntil) return;
    if (!PL.stallAt) PL.stallAt = Date.now();
    clearTimeout(PL.stallT); PL.stallT = setTimeout(() => plAutoDown(), 3500);   // one long stall
};
const plStallEnd = () => {
    clearTimeout(PL.stallT); PL.stallT = 0;
    if (!PL.stallAt) return; PL.stallAt = 0;
    const now = Date.now(); PL.stalls = PL.stalls.filter(t => now - t < 60000); PL.stalls.push(now);
    if (PL.stalls.length >= 2) { PL.stalls = []; plAutoDown(); }                   // repeated short stalls
};
const plAutoDown = () => {
    if (!PL.qs || PL.switching || PL.ghost || Date.now() < PL.graceUntil) return;
    const cur = +PL.level, lower = plAutoLevels().filter(h => h < cur); if (!lower.length) return;
    if (!PL.auto) { PL.sessSel = { movie: currentMovieId, key: 'auto' }; PL.sel = 'auto'; PL.auto = true; }   // fixed quality keeps freezing: continue in Auto for this title (saved default untouched)
    const nh = lower[lower.length - 1]; PL.noUp[cur] = Date.now() + 180000; PL.autoH = nh; PL.autoHMovie = currentMovieId;
    plSwitch(String(nh), { busy: 'Slow connection · changing to ' + nh + 'p in background…' });
};
const plAutoTick = () => {
    const v = vid(); if (!PL.auto || !PL.qs || !v || PL.switching || PL.ghost || !PL.playing || v.seeking || v.paused) return;
    const now = Date.now(); if (now < PL.graceUntil || now - PL.lastSwitch < 60000 || bufAhead(v) < 20) return;
    const cur = +PL.level, up = plAutoLevels().filter(h => h > cur)[0]; if (!up || PL.failed[String(up)] || (PL.noUp[up] || 0) > now) return;
    const c = netConn(); if (c && typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < (up >= 1080 ? 5 : 2.5)) return;
    PL.autoH = up; PL.autoHMovie = currentMovieId; plSwitch(String(up), { busy: 'Better connection · changing to ' + up + 'p in background…' });
};
// Watchdog: the chosen quality never started (stuck on the spinner) or keeps freezing -> do not stay stuck, drop to a lower quality and carry on in Auto.
const plWatchStart = () => {
    clearTimeout(PL.wdT);
    if (!PL.qs || PL.qs.length < 2 || !(PL.mode === 'direct' || PL.mode === 'hls')) return;
    const lvl = PL.level, mv = currentMovieId;
    PL.wdT = setTimeout(() => {
        const v = vid(); if (!v || PL.level !== lvl || mv !== currentMovieId || !PL.started) return;
        if (v.readyState >= 3 || (v.currentTime > 0 && !v.paused)) return;   // it is playing fine
        plFail(PL.mode, PL.url);                                                // -> tries the next lower quality automatically
    }, 12000);
};
const plAutoStart = () => { clearInterval(PL.autoTimer); PL.autoTimer = 0; if (PL.auto && PL.qs && (PL.mode === 'direct' || PL.mode === 'hls')) PL.autoTimer = setInterval(plAutoTick, 5000); };
window.plPip = async () => { const v = vid(); try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (v.requestPictureInPicture) await v.requestPictureInPicture(); else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode(v.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'); } catch (e) { plToast('Picture-in-picture is not available'); } };
// fullscreen (real fullscreen when possible, CSS fullscreen on iPhone so the controls stay visible)
const plIsFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement || PL.fake);
window.plFs = () => {
    const el = $id('pl'); if (!el) return;
    if (plIsFs()) return plExitFs();
    const rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { try { const r = rq.call(el); if (r && r.then) r.then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }).catch(() => {}); } catch (e) {} }
    else { PL.fake = true; el.classList.add('fake-fs'); document.body.classList.add('pl-lock'); }
    el.classList.add('is-fs'); $id('pl-fs-i').className = 'fas fa-compress';
};
const plExitFs = (silent) => {
    const el = $id('pl'); PL.fake = false;
    try { if (document.fullscreenElement) document.exitFullscreen(); else if (document.webkitFullscreenElement) document.webkitExitFullscreen(); } catch (e) {}
    try { screen.orientation.unlock(); } catch (e) {}
    document.body.classList.remove('pl-lock'); if (el) { el.classList.remove('fake-fs', 'is-fs'); const i = $id('pl-fs-i'); if (i) i.className = 'fas fa-expand'; }
};
['fullscreenchange', 'webkitfullscreenchange'].forEach(e => document.addEventListener(e, () => { const el = $id('pl'); if (el && !document.fullscreenElement && !document.webkitFullscreenElement && !PL.fake) { el.classList.remove('is-fs'); const i = $id('pl-fs-i'); if (i) i.className = 'fas fa-expand'; try { screen.orientation.unlock(); } catch (x) {} } }));
function plShowUI(keep) {
    const pl = $id('pl'); if (!pl) return; pl.classList.add('ui'); clearTimeout(PL.uiTimer);
    if (!keep && PL.playing) PL.uiTimer = setTimeout(() => { const p = $id('pl-pop'); if (p && p.classList.contains('on')) return; const e = $id('pl-eps'); if (e && e.classList.contains('on')) return; pl.classList.remove('ui'); }, 3200);
}
// gestures + input
function plBind() {
    plMsgReset();
    const pl = $id('pl'), touch = $id('pl-touch'), seek = $id('pl-seek'); if (!pl) return;
    seek.addEventListener('input', () => { seek.dataset.drag = '1'; $id('pl-cur').textContent = fmtT(seek.value); $id('pl-fill').style.width = (seek.value / (seek.max || 1) * 100) + '%'; });
    seek.addEventListener('change', () => { const t = parseFloat(seek.value); if (PL.mode === 'yt' && PL.yt) PL.yt.seekTo(t, true); else if (PL.mode === 'vimeo' && PL.vimeo) PL.vimeo.setCurrentTime(t); else vid().currentTime = t; delete seek.dataset.drag; });
    pl.addEventListener('mousemove', () => plShowUI());
    // tap anywhere outside the speed / quality list closes it (and that tap does nothing else)
    pl.addEventListener('pointerdown', (e) => {
        const pop = $id('pl-pop'); if (!pop || !pop.classList.contains('on')) return;
        if (e.target.closest && (e.target.closest('#pl-pop') || e.target.closest('#pl-speed-b') || e.target.closest('#pl-q-b'))) return;
        pop.classList.remove('on'); PL._swallow = Date.now();
    }, true);
    // mouse: click toggles play
    touch.addEventListener('click', (e) => { if (Date.now() - (PL._swallow || 0) < 800) return; if (e.pointerType === 'touch' || PL._touched) { PL._touched = false; return; } if (!PL.started) return; plToggle(); });
    // touch: tap = show/hide, double tap = skip, long press = 2x, vertical swipe = brightness/volume
    let t0 = 0, lastTap = 0, lastSide = '', sx = 0, sy = 0, moved = false, lp = null, base = 0, mode = '';
    touch.addEventListener('touchstart', (e) => { PL._touched = true; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; mode = ''; t0 = Date.now(); const r = touch.getBoundingClientRect(); base = (sx - r.left) / r.width;
        clearTimeout(lp); lp = setTimeout(() => { if (!moved && PL.started && PL.mode !== 'iframe') { PL._lp = true; plSetRate(2); plFast(true); } }, 550); }, { passive: true });
    touch.addEventListener('touchcancel', () => { clearTimeout(lp); plFastEnd(); }, { passive: true });
    touch.addEventListener('touchmove', (e) => { const t = e.touches[0], dy = sy - t.clientY, dx = t.clientX - sx; if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { moved = true; clearTimeout(lp); const v = vid(); if (!v || !PL.started) return;
        if (!PL_SWIPE_VB) { /* off */ }
        else if (base < 0.4) { PL.bright = Math.max(0.3, Math.min(1.6, PL.bright + (dy - (PL._ly || 0)) / 250)); v.style.filter = 'brightness(' + PL.bright + ')'; plToast('Brightness ' + Math.round(PL.bright * 100) + '%'); }
        else if (base > 0.6) { v.muted = false; v.volume = Math.max(0, Math.min(1, v.volume + (dy - (PL._ly || 0)) / 250)); localStorage.setItem('pl_vol', v.volume); $id('pl-vol-i').className = v.volume == 0 ? 'fas fa-volume-mute' : 'fas fa-volume-up'; plToast('Volume ' + Math.round(v.volume * 100) + '%'); }
        PL._ly = dy; } }, { passive: true });
    touch.addEventListener('touchend', (e) => { clearTimeout(lp); PL._ly = 0; if (Date.now() - (PL._swallow || 0) < 800) { plFastEnd(); e.preventDefault(); return; } if (PL._lp) { plFastEnd(); return; } if (moved) return; if (Date.now() - t0 > 450) return;
        const side = base < 0.35 ? 'left' : base > 0.65 ? 'right' : 'mid', now = Date.now();
        if (PL.started && now - lastTap < 320 && side === lastSide && side !== 'mid') { plSkip(side === 'right' ? 10 : -10); lastTap = 0; return; }
        lastTap = now; lastSide = side;
        setTimeout(() => { if (lastTap === now) { if (!PL.started) return; if (pl.classList.contains('ui') && PL.playing) pl.classList.remove('ui'); else plShowUI(); } }, 330); e.preventDefault(); });
}
document.addEventListener('keydown', (e) => {
    if (!PL.started || !$id('movie-details-page') || !$id('movie-details-page').classList.contains('active')) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k === 'escape' && $id('pl-eps') && $id('pl-eps').classList.contains('on')) { plEpsClose(); return; }
    if (k === ' ' || k === 'k') { e.preventDefault(); plToggle(); } else if (k === 'arrowright') plSkip(10); else if (k === 'arrowleft') plSkip(-10);
    else if (k === 'f') plFs(); else if (k === 'm') plMute(); else if (k === 'arrowup' && vid()) { vid().volume = Math.min(1, vid().volume + .1); } else if (k === 'arrowdown' && vid()) { vid().volume = Math.max(0, vid().volume - .1); }
});
window.addEventListener('pagehide', () => { if (PL.started) plSave(true); });
window.goBack = () => { if (plIsFs()) return plExitFs(); if (history.state && history.state.d > 0) history.back(); else showPage('home-page', false); };
