// ===== Desktop / laptop polish (no effect on phones) =====
//  - left / right arrow buttons on every poster row (rows are re-drawn often, so they are re-attached automatically)
//  - previous / next arrows on the home hero banner (they click the existing dots, the slider code is untouched)
//  - first letter of the user's name inside the header avatar
(function () {
    const fit = (row) => {
        const strip = row.querySelector('.nf-strip'); if (!strip) return;
        row.classList.toggle('can-prev', strip.scrollLeft > 4);
        row.classList.toggle('can-next', strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 4);
    };
    const rows = () => {
        document.querySelectorAll('.nf-row').forEach((row) => {
            const strip = row.querySelector('.nf-strip');
            if (!strip || row.querySelector('.row-arrow')) { if (strip) fit(row); return; }
            ['prev', 'next'].forEach((dir) => {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'row-arrow ' + dir; b.setAttribute('aria-label', dir === 'prev' ? 'Scroll left' : 'Scroll right');
                b.innerHTML = '<i class="fas fa-chevron-' + (dir === 'prev' ? 'left' : 'right') + '"></i>';
                b.addEventListener('click', (e) => { e.stopPropagation(); strip.scrollBy({ left: (dir === 'prev' ? -1 : 1) * Math.max(240, strip.clientWidth * 0.85), behavior: 'smooth' }); });
                row.appendChild(b);
            });
            strip.addEventListener('scroll', () => fit(row), { passive: true });
            fit(row);
        });
    };
    const hero = () => {
        const c = document.getElementById('carousel'); if (!c) return;
        const dots = c.querySelectorAll('.hero-dots i');
        if (dots.length < 2 || c.querySelector('.hero-nav')) return;
        ['prev', 'next'].forEach((dir) => {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'hero-nav ' + dir; b.setAttribute('aria-label', dir === 'prev' ? 'Previous banner' : 'Next banner');
            b.innerHTML = '<i class="fas fa-chevron-' + (dir === 'prev' ? 'left' : 'right') + '"></i>';
            b.addEventListener('click', (e) => {
                e.stopPropagation();
                const list = Array.from(c.querySelectorAll('.hero-dots i')), at = Math.max(0, list.findIndex(d => d.classList.contains('on')));
                const to = list[(at + (dir === 'prev' ? -1 : 1) + list.length) % list.length]; if (to) to.click();
            });
            c.appendChild(b);
        });
    };
    const avatar = () => {
        const n = document.getElementById('header-user-name'), av = document.querySelector('#global-header .nf-avatar');
        if (!n || !av) return;
        const m = /^Hi,\s*(.+)$/.exec((n.textContent || '').trim());
        av.setAttribute('data-i', m ? m[1].charAt(0).toUpperCase() : '');
    };

    let queued = false;
    const run = () => { queued = false; rows(); hero(); avatar(); };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(run); } };
    const watch = (el, opts) => { if (el) new MutationObserver(queue).observe(el, opts); };
    watch(document.getElementById('movie-carousels-container'), { childList: true });
    watch(document.getElementById('br-rows'), { childList: true });
    watch(document.getElementById('carousel'), { childList: true });
    watch(document.getElementById('header-user-name'), { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', () => document.querySelectorAll('.nf-row').forEach(fit));
    queue();
})();
