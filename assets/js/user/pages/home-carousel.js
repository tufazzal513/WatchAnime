// --- HERO BANNER SLIDER (replaces 3D carousel) ---
let heroTimer;
const renderBanners = (banners) => {
    carouselEl = document.getElementById('carousel');
    if (!carouselEl) return;
    window.__bannersRaw = banners;
    // A banner that points to a title the user cannot see (private / removed) is not shown at all.
    // Until the movie list has loaded we cannot tell yet, so wait (user-data.js draws the banners again once it arrives).
    const moviesReady = typeof allMovies === 'object' && Object.keys(allMovies).length > 0;
    const list = Object.values(banners || {}).filter(b => b && (!b.movieId || (moviesReady && allMovies[b.movieId])));
    clearInterval(heroTimer);
    if (!list.length) { if (moviesReady || !banners) carouselEl.innerHTML = ''; return; }

    const n = list.length;
    const slide = (b) => {
        const m = (b.movieId && allMovies[b.movieId]) || {};
        const img = b.imageUrl || m.coverUrl || m.posterUrl || '';
        const desc = m.description || m.overview || m.plot || '';
        const id = b.movieId ? esc(b.movieId) : '';
        return `<div class="hero-slide">
            <img src="${esc(img)}" alt="" draggable="false">
            <div class="hero-info">
                <span class="hero-tag">${m.contentType === 'series' ? 'Series' : 'Featured'}</span>
                <h2 class="hero-title">${esc(m.title || b.title || '')}</h2>
                <div class="hero-meta">${m.year ? `<span>${esc(m.year)}</span>` : ''}${m.rating ? `<span><i class="fas fa-star" style="color:#facc15"></i> ${esc(m.rating)}</span>` : ''}${m.industry ? `<span>${esc(m.industry)}</span>` : ''}${MX.genresOf(m).length ? `<span>${esc(MX.genresOf(m).slice(0, 2).join(', '))}</span>` : ''}</div>
                ${desc ? `<p class="hero-desc">${esc(desc)}</p>` : ''}
                ${b.movieId ? `<div class="hero-actions"><button class="hero-btn" onclick="showMovieDetails('${id}')"><i class="fas fa-play"></i> Play</button><button class="hero-btn ghost ${inMyList(b.movieId) ? 'on' : ''}" data-mylist="${id}" onclick="toggleMyList('${id}', event)"><i class="fas ${inMyList(b.movieId) ? 'fa-check' : 'fa-plus'}"></i> <span class="lbl">${inMyList(b.movieId) ? 'In My List' : 'Add to list'}</span></button></div>` : ''}
            </div>
        </div>`;
    };
    // with 2+ banners the rail has a copy of the last slide in front and of the first at the end, so swiping loops without a visible jump
    const items = n > 1 ? [list[n - 1], ...list, list[0]] : list;
    carouselEl.innerHTML = `<div class="hero-rail">${items.map(slide).join('')}</div><div class="hero-dots">${list.map((_, i) => `<i data-i="${i}" class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>`;

    const rail = carouselEl.querySelector('.hero-rail');
    const dots = carouselEl.querySelectorAll('.hero-dots i');
    let pos = n > 1 ? 1 : 0, dragging = false;
    const SLIDE = 'transform .45s cubic-bezier(.22,.61,.36,1)';
    const place = (dx) => { rail.style.transform = `translate3d(calc(${-pos * 100}% + ${dx || 0}px),0,0)`; };
    const mark = () => { const r = n > 1 ? (pos - 1 + n) % n : 0; dots.forEach((d, i) => d.classList.toggle('on', i === r)); };
    const jump = () => { rail.style.transition = 'none'; place(0); void rail.offsetWidth; };
    const fix = () => { if (n < 2) return; if (pos === 0) { pos = n; jump(); } else if (pos === n + 1) { pos = 1; jump(); } };   // landed on a copy -> silently move to the real slide
    const go = (p) => { pos = p; rail.style.transition = SLIDE; place(0); mark(); };
    rail.addEventListener('transitionend', (e) => { if (e.target === rail) fix(); });
    jump();
    if (n < 2) { dots.forEach(d => d.style.display = 'none'); return; }

    const start = () => { clearInterval(heroTimer); heroTimer = setInterval(() => { if (!dragging && !document.hidden) { fix(); go(pos + 1); } }, 5000); };
    dots.forEach(d => d.onclick = () => { fix(); go(+d.dataset.i + 1); start(); });

    // swipe / drag (touch, pen and mouse): the rail follows the finger, then settles on the nearest slide
    let sx = 0, sy = 0, st = 0, dx = 0, id = null, intent = false;
    rail.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        fix(); id = e.pointerId; sx = e.clientX; sy = e.clientY; st = Date.now(); dx = 0; intent = false;
        rail.style.transition = 'none'; clearInterval(heroTimer);
    });
    rail.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        const mx = e.clientX - sx, my = e.clientY - sy;
        if (!intent) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            if (Math.abs(my) > Math.abs(mx)) { id = null; go(pos); start(); return; }   // vertical scroll: leave it to the page
            intent = true; dragging = true; try { rail.setPointerCapture(id); } catch (err) {}
        }
        dx = mx; place(dx);
    });
    const end = (e) => {
        if (e.pointerId !== id) return;
        id = null;
        if (!intent) { start(); return; }
        intent = false; dragging = false;
        const w = rail.offsetWidth || 1, fast = Math.abs(dx) / Math.max(1, Date.now() - st) > 0.4;
        let p = pos;
        if (Math.abs(dx) > w * 0.18 || (fast && Math.abs(dx) > 20)) p = dx < 0 ? pos + 1 : pos - 1;
        rail._moved = Date.now();
        go(p); start();
    };
    rail.addEventListener('pointerup', end);
    rail.addEventListener('pointercancel', end);
    rail.addEventListener('click', (e) => { if (rail._moved && Date.now() - rail._moved < 350) { e.preventDefault(); e.stopPropagation(); } }, true);   // a swipe must not press Play / My List
    start();
};
function rotateCarousel() {}

window.addEventListener('scroll', () => {
    const h = document.getElementById('global-header');
    if (h) h.classList.toggle('solid', window.scrollY > 40);
}, { passive: true });
