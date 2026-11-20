// ===== MovieBox-style details page with the video playing inline at the top =====
let currentSeasonKey = null;   // read by broken-link-reporter.js
let currentEpIndex = -1;
const PL = { mode: null, hls: null, yt: null, vimeo: null, ytTimer: null, wake: null, fake: false, url: '', playing: false, uiTimer: null, nextTimer: null, resumeAt: 0, upgraded: false, started: false, bright: 1, qs: null, level: null, sel: 'auto', auto: false, srcObj: null, epName: null, switching: false, sessSel: null, autoTimer: 0, stallT: 0, stallAt: 0, stalls: [], noUp: {}, failed: {}, lastSwitch: 0, graceUntil: 0, autoH: 0, autoHMovie: null };
const $id = (i) => document.getElementById(i);
const fmtT = (s) => { s = Math.max(0, s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = Math.floor(s % 60); return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const getLink = (o) => (o && (o.server1 || o.server2 || o.link)) || '';

// ---------- multi-quality (480p / 720p / 1080p + Auto) ----------
// A title/episode may carry q480, q720, q1080 (direct links). A box left empty by the admin simply does not exist for the player.
// The admin has no single-link box any more. Old content that only has the legacy link (server1) still plays as one plain source with no menu; once any quality is filled the legacy link is ignored.
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
    if (!nums.length) { PL.qs = null; PL.level = null; PL.auto = false; return { url: getLink(o), key: null }; }
    PL.qs = L;
    const hs = nums.map(x => x.h);
    let sel = (PL.sessSel && PL.sessSel.movie === currentMovieId) ? PL.sessSel.key : (typeof mxDefQ === 'function' ? mxDefQ() : 'auto');
    if (sel === 'default' && !L.some(x => x.key === 'default')) sel = 'auto';
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
const plToast = (msg) => { const t = $id('pl-toast'); if (!t) return; t.textContent = msg; t.classList.add('on'); clearTimeout(plToast._t); plToast._t = setTimeout(() => t.classList.remove('on'), 2200); };

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
            <input type="range" id="pl-vol" class="pl-vol" min="0" max="1" step="0.05" value="1">
            <span class="grow"></span>
            <button onclick="plEpsBtn()" class="ep-only pl-fs-only" aria-label="Episodes"><i class="fas fa-list"></i></button>
            <button onclick="plMenu('speed')" id="pl-speed-b" aria-label="Speed"><i class="fas fa-tachometer-alt"></i></button>
            <button onclick="plMenu('quality')" id="pl-q-b" class="hidden" aria-label="Quality"><i class="fas fa-cog"></i></button>
            <button onclick="plPip()" id="pl-pip-b" class="hidden" aria-label="Picture in picture"><i class="far fa-clone"></i></button>
            <button onclick="plFs()" aria-label="Fullscreen"><i id="pl-fs-i" class="fas fa-expand"></i></button>
          </div>
        </div>
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
window.plEpsBtn = () => { if (plIsFs()) plFs(); openAllEps(); };
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
    const link = PL.started && PL.url ? PL.url : (m.contentType === 'series' ? getLink(eps[currentEpIndex]) : getLink(m));
    reportBrokenLink('user-report', link || ''); closeSheet(); plToast('Thanks, reported');
};
// ---------- player engine ----------
const vid = () => $id('pl-video');
const plCur = () => PL.mode === 'yt' && PL.yt && PL.yt.getCurrentTime ? PL.yt.getCurrentTime() : PL.mode === 'vimeo' ? (PL._vt || 0) : (vid() ? vid().currentTime : 0);
const plDurV = () => PL.mode === 'yt' && PL.yt && PL.yt.getDuration ? PL.yt.getDuration() : PL.mode === 'vimeo' ? (PL._vd || 0) : (vid() ? vid().duration : 0);
const setPlaying = (p) => { PL.playing = p; const i = $id('pl-pp-i'); if (i) i.className = p ? 'fas fa-pause' : 'fas fa-play'; const pl = $id('pl'); if (pl) pl.classList.toggle('playing', p); if (p) { plShowUI(); wakeOn(); } else { wakeOff(); plShowUI(true); } };
const spin = (on) => { const s = $id('pl-spin'); if (s) s.style.display = on ? 'block' : 'none'; const pl = $id('pl'); if (pl) pl.classList.toggle('loading', !!on); };
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
    const srcObj = (arg && typeof arg === 'object') ? arg : { server1: arg || '' };
    let url;
    if (opts.url) url = opts.url;   // quality switch: the link is already chosen
    else { const pk = plChoose(srcObj); url = pk.url; PL.level = pk.key; PL.failed = {}; PL.noUp = {}; PL.stalls = []; }
    if (!url) { plShowErr('Video link is not available right now.'); return; }
    PL.srcObj = srcObj; PL.epName = epName;
    plTeardown(); $id('pl-err').classList.remove('on'); plCancelNext();
    PL.switching = !!opts.switching; PL.lastSwitch = Date.now(); PL.graceUntil = Date.now() + 8000; PL.stallAt = 0;
    const qb = $id('pl-q-b'); if (qb) qb.classList.toggle('hidden', !(PL.qs && PL.qs.length > 1));
    const pl = $id('pl'); pl.classList.add('started'); PL.started = true; PL.upgraded = false;
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
            PL.hls.on(Hls.Events.MANIFEST_PARSED, () => { if (!PL.qs && PL.hls.levels.length > 1) $id('pl-q-b').classList.remove('hidden'); if (!opts.keepPaused) v.play().catch(() => setPlaying(false)); });
            PL.hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) plFail('hls', url); });
        } else return plFail('hls', url);
    } else { v.src = url; v.load(); if (!opts.keepPaused) v.play().catch(() => setPlaying(false)); }
    if ('pictureInPictureEnabled' in document || v.webkitSetPresentationMode) $id('pl-pip-b').classList.remove('hidden');
    v.playbackRate = plSpeed(); v.volume = parseFloat(localStorage.getItem('pl_vol') || '1'); $id('pl-vol').value = v.volume;
    plAutoStart();
};
const bindVideo = (v) => {
    v.onloadedmetadata = () => { if (PL.resumeAt && PL.resumeAt < v.duration - (PL.switching ? 1 : 5)) v.currentTime = PL.resumeAt; PL.resumeAt = 0; PL.switching = false; };
    v.onwaiting = () => { spin(true); plStallStart(v); }; v.oncanplay = () => spin(false); v.onplaying = () => { spin(false); setPlaying(true); plStallEnd(); }; v.onseeking = () => { PL.graceUntil = Date.now() + 4000; };
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
        const cand = PL.qs.filter(x => !PL.failed[x.key]).sort((a, b) => (a.h ? 0 : 1) - (b.h ? 0 : 1) || Math.abs(a.h - cur) - Math.abs(b.h - cur) || a.h - b.h)[0];
        if (cand) { plToast('Could not play this quality, trying ' + (cand.h ? cand.h + 'p' : 'Default')); plSwitch(cand.key, { force: true }); return; }
    }
    plShowErr(PL.upgraded ? 'This link is not secure (http) and could not be opened. Please tell the admin to use https.' : 'This video could not be loaded.');
    try { reportBrokenLink(type, url); } catch (e) {}
};
const plShowErr = (t) => { const e = $id('pl-err'); if (!e) return; $id('pl-err-t').textContent = t; e.classList.add('on'); };
window.plRetry = () => { $id('pl-err').classList.remove('on'); const m = allMovies[currentMovieId]; if (m.contentType === 'series') { const e = epList()[currentEpIndex]; plLoad(e, e.name); } else plLoad(m, null); };
const plTick = () => {
    const c = plCur(), d = plDurV(); if (!(d > 0)) return; PL.dur = d;
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
    clearInterval(PL.autoTimer); clearTimeout(PL.stallT); PL.autoTimer = 0; PL.stallT = 0;
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
const plSpeed = () => parseFloat(localStorage.getItem('pl_speed') || '1');
window.plToggle = () => {
    if (!PL.started) return startPlayback();
    if (PL.mode === 'yt' && PL.yt) return PL.yt.getPlayerState() === 1 ? PL.yt.pauseVideo() : PL.yt.playVideo();
    if (PL.mode === 'vimeo' && PL.vimeo) return PL.playing ? PL.vimeo.pause() : PL.vimeo.play();
    const v = vid(); if (v.paused) v.play().catch(() => {}); else v.pause();
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
        items = [`<button class="${PL.auto ? 'on' : ''}" onclick="plPickQ('auto')">Auto${PL.auto && PL.level && PL.level !== 'default' ? ' <small>(' + PL.level + 'p)</small>' : ''}</button>`]
            .concat(nums.map(x => `<button class="${!PL.auto && PL.level === x.key ? 'on' : ''}" onclick="plPickQ('${x.key}')">${x.h}p</button>`));
        if (def) items.push(`<button class="${!PL.auto && PL.level === 'default' ? 'on' : ''}" onclick="plPickQ('default')">Default</button>`);
    }
    else if (PL.hls) items = [`<button class="${PL.hls.currentLevel === -1 ? 'on' : ''}" onclick="plSetQ(-1)">Auto</button>`].concat(PL.hls.levels.map((l, i) => ({ h: l.height, i })).sort((a, b) => b.h - a.h).map(o => `<button class="${PL.hls.currentLevel === o.i ? 'on' : ''}" onclick="plSetQ(${o.i})">${o.h}p</button>`));
    pop.dataset.k = kind; pop.innerHTML = items.join(''); pop.classList.add('on'); plShowUI();
};
window.plSetSpeed = (s) => { localStorage.setItem('pl_speed', s); if (PL.mode === 'yt' && PL.yt) PL.yt.setPlaybackRate(s); else if (PL.mode === 'vimeo' && PL.vimeo) PL.vimeo.setPlaybackRate(s); else if (vid()) vid().playbackRate = s; $id('pl-pop').classList.remove('on'); };
window.plSetQ = (i) => { if (PL.hls) PL.hls.currentLevel = i; $id('pl-pop').classList.remove('on'); };
// Switch to another quality link and carry on from the exact second the viewer reached (play/pause state is kept too).
const plSwitch = (key, o) => {
    o = o || {};
    if (!PL.qs || !PL.srcObj) return;
    const it = PL.qs.find(x => x.key === key); if (!it || (key === PL.level && !o.force)) return;
    const t = PL.mode === 'iframe' ? 0 : plCur(), wasPlaying = PL.playing;
    if (!o.force) plSave(true);                       // remember the position first
    PL.resumeAt = t > 1 ? t : 0; PL.level = key;
    plLoad(PL.srcObj, PL.epName, { switching: true, url: it.url, keepPaused: !wasPlaying && !o.force });
};
// the viewer picked a quality in the player: valid for this title until they leave it; the saved default is never changed here
window.plPickQ = (key) => {
    $id('pl-pop').classList.remove('on');
    if (!PL.qs) return;
    PL.sessSel = { movie: currentMovieId, key }; PL.sel = key; PL.auto = key === 'auto';
    if (key === 'auto') {
        PL.noUp = {};
        const hs = PL.qs.filter(x => x.h).map(x => x.h);
        if (!PL.level || PL.level === 'default') plSwitch(String(nearestQ(hs, netStartQ())));
        else plAutoStart();
        plToast('Auto quality');
    } else { plSwitch(key); plAutoStart(); }
};
// ----- Auto: start from the network speed, step down when it keeps buffering, step up slowly when it is smooth -----
const plAutoLevels = () => (PL.qs || []).filter(x => x.h).map(x => x.h).sort((a, b) => a - b);
const plStallStart = (v) => {
    if (!PL.auto || !PL.qs || PL.switching || v.seeking || Date.now() < PL.graceUntil) return;
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
    if (!PL.auto || !PL.qs || PL.switching || Date.now() < PL.graceUntil) return;
    const cur = +PL.level, lower = plAutoLevels().filter(h => h < cur); if (!lower.length) return;
    const nh = lower[lower.length - 1]; PL.noUp[cur] = Date.now() + 180000; PL.autoH = nh; PL.autoHMovie = currentMovieId;
    plToast('Slow connection: switching to ' + nh + 'p'); plSwitch(String(nh));
};
const plAutoTick = () => {
    const v = vid(); if (!PL.auto || !PL.qs || !v || PL.switching || !PL.playing || v.seeking || v.paused) return;
    const now = Date.now(); if (now < PL.graceUntil || now - PL.lastSwitch < 60000 || bufAhead(v) < 20) return;
    const cur = +PL.level, up = plAutoLevels().filter(h => h > cur)[0]; if (!up || (PL.noUp[up] || 0) > now) return;
    const c = netConn(); if (c && typeof c.downlink === 'number' && c.downlink > 0 && c.downlink < (up >= 1080 ? 5 : 2.5)) return;
    PL.autoH = up; PL.autoHMovie = currentMovieId; plToast('Switching to ' + up + 'p'); plSwitch(String(up));
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
    if (!keep && PL.playing) PL.uiTimer = setTimeout(() => { pl.classList.remove('ui'); const p = $id('pl-pop'); if (p) p.classList.remove('on'); }, 3200);
}
// gestures + input
function plBind() {
    const pl = $id('pl'), touch = $id('pl-touch'), seek = $id('pl-seek'), vol = $id('pl-vol'); if (!pl) return;
    seek.addEventListener('input', () => { seek.dataset.drag = '1'; $id('pl-cur').textContent = fmtT(seek.value); $id('pl-fill').style.width = (seek.value / (seek.max || 1) * 100) + '%'; });
    seek.addEventListener('change', () => { const t = parseFloat(seek.value); if (PL.mode === 'yt' && PL.yt) PL.yt.seekTo(t, true); else if (PL.mode === 'vimeo' && PL.vimeo) PL.vimeo.setCurrentTime(t); else vid().currentTime = t; delete seek.dataset.drag; });
    vol.addEventListener('input', () => { const v = vid(); v.muted = false; v.volume = vol.value; localStorage.setItem('pl_vol', vol.value); $id('pl-vol-i').className = vol.value == 0 ? 'fas fa-volume-mute' : 'fas fa-volume-up'; });
    pl.addEventListener('mousemove', () => plShowUI());
    // mouse: click toggles play
    touch.addEventListener('click', (e) => { if (e.pointerType === 'touch' || PL._touched) { PL._touched = false; return; } if (!PL.started) return; plToggle(); });
    // touch: tap = show/hide, double tap = skip, long press = 2x, vertical swipe = brightness/volume
    let t0 = 0, lastTap = 0, lastSide = '', sx = 0, sy = 0, moved = false, lp = null, base = 0, mode = '';
    touch.addEventListener('touchstart', (e) => { PL._touched = true; const t = e.touches[0]; sx = t.clientX; sy = t.clientY; moved = false; mode = ''; t0 = Date.now(); const r = touch.getBoundingClientRect(); base = (sx - r.left) / r.width;
        clearTimeout(lp); lp = setTimeout(() => { if (!moved && PL.started && PL.mode !== 'iframe') { PL._lp = true; if (vid()) vid().playbackRate = 2; plToast('2x speed'); } }, 550); }, { passive: true });
    touch.addEventListener('touchmove', (e) => { const t = e.touches[0], dy = sy - t.clientY, dx = t.clientX - sx; if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { moved = true; clearTimeout(lp); const v = vid(); if (!v || !PL.started) return;
        if (base < 0.4) { PL.bright = Math.max(0.3, Math.min(1.6, PL.bright + (dy - (PL._ly || 0)) / 250)); v.style.filter = 'brightness(' + PL.bright + ')'; plToast('Brightness ' + Math.round(PL.bright * 100) + '%'); }
        else if (base > 0.6) { v.muted = false; v.volume = Math.max(0, Math.min(1, v.volume + (dy - (PL._ly || 0)) / 250)); vol.value = v.volume; plToast('Volume ' + Math.round(v.volume * 100) + '%'); }
        PL._ly = dy; } }, { passive: true });
    touch.addEventListener('touchend', (e) => { clearTimeout(lp); PL._ly = 0; if (PL._lp) { PL._lp = false; if (vid()) vid().playbackRate = plSpeed(); return; } if (moved) return; if (Date.now() - t0 > 450) return;
        const side = base < 0.35 ? 'left' : base > 0.65 ? 'right' : 'mid', now = Date.now();
        if (PL.started && now - lastTap < 320 && side === lastSide && side !== 'mid') { plSkip(side === 'right' ? 10 : -10); lastTap = 0; return; }
        lastTap = now; lastSide = side;
        setTimeout(() => { if (lastTap === now) { if (!PL.started) return; if (pl.classList.contains('ui') && PL.playing) pl.classList.remove('ui'); else plShowUI(); } }, 330); e.preventDefault(); });
}
document.addEventListener('keydown', (e) => {
    if (!PL.started || !$id('movie-details-page') || !$id('movie-details-page').classList.contains('active')) return;
    if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || '')) && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); plToggle(); } else if (k === 'arrowright') plSkip(10); else if (k === 'arrowleft') plSkip(-10);
    else if (k === 'f') plFs(); else if (k === 'm') plMute(); else if (k === 'arrowup' && vid()) { vid().volume = Math.min(1, vid().volume + .1); } else if (k === 'arrowdown' && vid()) { vid().volume = Math.max(0, vid().volume - .1); }
});
window.addEventListener('pagehide', () => { if (PL.started) plSave(true); });
window.goBack = () => { if (plIsFs()) return plExitFs(); if (history.state && history.state.d > 0) history.back(); else showPage('home-page', false); };
