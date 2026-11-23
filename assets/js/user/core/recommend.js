// ===== Smart "Recommended for you" engine (used by the player page) =====
// Picks a SMALL set (9-12) of titles that are
//   1) similar to the title being watched   (genre, type, industry, language, cast, year, same series)
//   2) popular                              (admin rating + real plays + My List adds = mxHot)
//   3) a match for THIS user's taste        (My List + watch history, newer activity counts more)
// and keeps the list varied (no wall of the same genre / country).
// Pure functions: it only reads allMovies, myListIds, historyMap, mxStats. Nothing is written anywhere.
(function () {
    const lc = (s) => String(s == null ? '' : s).toLowerCase();

    // "Bleach [Hindi]" and "Bleach: Thousand-Year Blood War" -> both start with the franchise word(s) "bleach"
    const baseTitle = (t) => lc(t)
        .replace(/[\[\(].*?[\]\)]/g, ' ')
        .replace(/\b(season|part|cour)\s*\d+\b|\bs\d+\b|\b(hindi|bengali|tamil|telugu|english|dubbed|dub|sub|uncut|complete)\b/g, ' ')
        .replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
    const sameSeries = (a, b) => {
        if (!a || !b) return false;
        if (a === b) return true;
        const s = a.length <= b.length ? a : b, l = s === a ? b : a;
        return s.length >= 4 && l.indexOf(s + ' ') === 0;
    };
    const castOf = (m) => lc(m && m.cast).split(/[,;\/|]+/).map(x => x.trim()).filter(x => x.length > 2);

    // ---- what this user likes (0..1 per genre / language / industry / type) ----
    const tasteProfile = () => {
        const p = { g: {}, l: {}, i: {}, t: {}, n: 0 };
        const add = (m, w) => {
            if (!m || !(w > 0)) return;
            MX.genresOf(m).forEach(x => p.g[x] = (p.g[x] || 0) + w);
            MX.langsOf(m).forEach(x => p.l[x] = (p.l[x] || 0) + w);
            if (m.industry) p.i[m.industry] = (p.i[m.industry] || 0) + w;
            const t = MX.typeOf(m); p.t[t] = (p.t[t] || 0) + w;
            p.n += w;
        };
        const now = Date.now();
        Object.keys(window.myListIds || {}).forEach(id => add(allMovies[id], 2));
        Object.entries(window.historyMap || {}).forEach(([id, e]) => {
            const m = allMovies[id]; if (!m || !e) return;
            const days = e.at ? Math.max(0, (now - e.at) / 864e5) : 30;
            const recency = Math.exp(-days / 45);                              // last weeks count most
            const depth = e.done ? 1.4 : (e.d > 0 && e.t / e.d > 0.2 ? 1.1 : 0.5);   // finished / really watched > just opened
            add(m, depth * (0.4 + 0.6 * recency));
        });
        [p.g, p.l, p.i, p.t].forEach(o => { const mx = Math.max(0, ...Object.values(o)); if (mx) Object.keys(o).forEach(k => o[k] /= mx); });
        return p;
    };
    const tasteScore = (m, p) => {
        if (!p.n) return 0;
        const avg = (arr, o) => arr.length ? arr.reduce((s, k) => s + (o[k] || 0), 0) / arr.length : 0;
        const ind = m.industry ? (p.i[m.industry] || 0) : 0;
        return 0.55 * avg(MX.genresOf(m), p.g) + 0.2 * avg(MX.langsOf(m), p.l) + 0.15 * ind + 0.1 * (p.t[MX.typeOf(m)] || 0);
    };

    // ---- how alike two titles are (0..1) ----
    const similarity = (a, b) => {
        const ga = MX.genresOf(a), gb = MX.genresOf(b), shared = gb.filter(x => ga.includes(x));
        const union = new Set(ga.concat(gb)).size || 1;
        let s = 0.42 * (shared.length / union);
        if (MX.typeOf(a) === MX.typeOf(b)) s += 0.10;
        if (a.industry && a.industry === b.industry) s += 0.12;
        const la = MX.langsOf(a); if (MX.langsOf(b).some(x => la.includes(x))) s += 0.12;
        const ya = parseInt(a.year), yb = parseInt(b.year);
        if (ya && yb) s += Math.max(0, 0.08 - Math.abs(ya - yb) * 0.012);
        const ca = castOf(a); if (ca.length && castOf(b).some(x => ca.includes(x))) s += 0.10;
        return { score: Math.min(1, s), shared };
    };

    /** @returns {{id:string, m:object, why:string, icon:string}[]}  at most `limit` titles, best first */
    window.mxRecommend = (movieId, limit) => {
        limit = limit || 12;
        const cur = allMovies[movieId]; if (!cur) return [];
        const curBase = baseTitle(cur.title), prof = tasteProfile(), hist = window.historyMap || {};
        const pool = mxList().filter(([id]) => id !== movieId);
        if (!pool.length) return [];

        const hot = pool.map(([id, m]) => mxHot(id, m)), maxHot = Math.max(0.0001, ...hot);
        const useTaste = prof.n > 0;
        const rows = pool.map(([id, m], i) => {
            const sim = similarity(cur, m), pop = hot[i] / maxHot, taste = tasteScore(m, prof);
            const series = sameSeries(curBase, baseTitle(m.title));
            let score = useTaste ? 0.52 * sim.score + 0.28 * pop + 0.20 * taste : 0.62 * sim.score + 0.38 * pop;
            if (series) score += 0.35;
            const h = hist[id];
            if (h && h.done) score -= 0.12;                  // already finished: still allowed, just lower
            else if (h && h.d > 0 && h.t / h.d > 0.05) score += 0.04;   // started but not finished: nice to resume
            let why = 'Popular now', icon = 'fa-fire';
            if (series) { why = 'Same series'; icon = 'fa-layer-group'; }
            else if (useTaste && taste >= 0.55 && taste >= sim.score) { why = 'Matches your taste'; icon = 'fa-heart'; }
            else if (sim.score >= 0.4 && sim.shared.length) { why = 'Similar · ' + sim.shared[0]; icon = 'fa-clone'; }
            else if (pop < 0.35 && sim.score >= 0.25) { why = 'You may like'; icon = 'fa-thumbs-up'; }
            return { id, m, score, why, icon };
        });

        // pick one by one; every pick makes the same genre / country / type slightly less attractive for the next pick
        const picked = [], left = rows.slice(), gUse = {}, iUse = {}, tUse = {};
        while (picked.length < limit && left.length) {
            let bi = 0, bs = -1e9;
            left.forEach((r, i) => {
                const g0 = MX.genresOf(r.m)[0], ty = MX.typeOf(r.m);
                const adj = r.score - 0.045 * (gUse[g0] || 0) - 0.03 * (iUse[r.m.industry] || 0) - 0.02 * (tUse[ty] || 0);
                if (adj > bs) { bs = adj; bi = i; }
            });
            const r = left.splice(bi, 1)[0]; picked.push(r);
            const g0 = MX.genresOf(r.m)[0]; if (g0) gUse[g0] = (gUse[g0] || 0) + 1;
            if (r.m.industry) iUse[r.m.industry] = (iUse[r.m.industry] || 0) + 1;
            const ty = MX.typeOf(r.m); tUse[ty] = (tUse[ty] || 0) + 1;
        }
        return picked;
    };
})();
