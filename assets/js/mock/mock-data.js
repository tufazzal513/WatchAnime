/* =====================================================================================================
   MOCK DATA (testing only) - gives the site lots of fake movies / series / anime + hero banners so you can
   see how it looks with a full catalogue. Nothing is written to your server or database.

   HOW IT WORKS: it wraps db.ref('movies') and db.ref('banners'): the fake titles are added to what the
   real server returns (real data wins if an id ever clashes). If the server is offline you still get the
   fake titles.

   TURN OFF : set MOCK_ENABLED = false below   (or in the browser console:  localStorage.mx_mock = '0'  then reload)
   REMOVE   : delete this whole folder  Frontend/assets/js/mock/   (optionally also the "../mock/mock-data.js"
              line in assets/js/user/bootstrap.js - the site works with or without that line)
   ===================================================================================================== */
(function () {
  var MOCK_ENABLED = true;          // <- false = no mock data at all
  var COUNT = 160;                  // how many fake titles to create
  try { if (localStorage.getItem('mx_mock') === '0') MOCK_ENABLED = false; } catch (e) {}
  if (!MOCK_ENABLED || typeof db === 'undefined' || !db.ref) return;

  /* ---------- small seeded random generator (same data on every load, so ids/history/my-list stay stable) ---------- */
  var seed = 20261122;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function pickN(a, n) { var c = a.slice(), out = []; while (out.length < n && c.length) out.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return out; }
  function between(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

  /* ---------- free sample videos (Google's public test-video bucket + Blender open movies) ---------- */
  var BASE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/';
  var VIDEOS = ['BigBuckBunny', 'ElephantsDream', 'Sintel', 'TearsOfSteel', 'ForBiggerBlazes', 'ForBiggerEscapes', 'ForBiggerFun',
    'ForBiggerJoyrides', 'ForBiggerMeltdowns', 'SubaruOutbackOnStreetAndDirt', 'VolkswagenGTIReview', 'WeAreGoingOnBullrun', 'WhatCarCanYouGetForAGrand']
    .map(function (n) { return BASE + n + '.mp4'; });

  /* ---------- word lists (all titles / names are invented) ---------- */
  var ADJ = ['Crimson', 'Silent', 'Midnight', 'Broken', 'Golden', 'Hidden', 'Eternal', 'Savage', 'Frozen', 'Neon', 'Lost', 'Burning', 'Shattered', 'Secret', 'Rising', 'Final', 'Dark', 'Wild', 'Iron', 'Silver', 'Phantom', 'Electric', 'Last', 'Hollow', 'Scarlet', 'Wandering', 'Forgotten', 'Radiant', 'Fallen', 'Distant'];
  var NOUN = ['Horizon', 'Empire', 'Legacy', 'Protocol', 'Kingdom', 'Voyage', 'Echo', 'Storm', 'Code', 'Garden', 'Frontier', 'Shadow', 'Harvest', 'Oath', 'Signal', 'Dynasty', 'Reckoning', 'Orbit', 'Covenant', 'Mirage', 'Tide', 'Citadel', 'Paradox', 'Ember', 'Gambit', 'Requiem', 'Uprising', 'Odyssey', 'Pursuit', 'Machine'];
  var ANIME_A = ['Blade', 'Spirit', 'Dragon', 'Star', 'Moon', 'Sky', 'Thunder', 'Flame', 'Cursed', 'Soul', 'Demon', 'Hero', 'Sword', 'Magic', 'Titan'];
  var ANIME_B = ['Academy', 'Chronicle', 'Hunter', 'Legend', 'Saga', 'Arena', 'Guild', 'Slayer', 'Realm', 'Awakening', 'Knights', 'Alliance', 'Rebirth', 'Master', 'Wars'];
  var FIRST = ['Aarav', 'Emma', 'Liam', 'Sofia', 'Noah', 'Mia', 'Ethan', 'Zara', 'Kenji', 'Yuki', 'Hana', 'Ravi', 'Priya', 'Omar', 'Layla', 'Lucas', 'Ava', 'Mateo', 'Nora', 'Arjun', 'Ishan', 'Tara', 'Daniel', 'Chloe', 'Rafi', 'Nadia', 'Sora', 'Ren', 'Aiko', 'Leo'];
  var LAST = ['Rahman', 'Carter', 'Sato', 'Mehta', 'Rossi', 'Khan', 'Nguyen', 'Silva', 'Walker', 'Tanaka', 'Hossain', 'Kapoor', 'Moreau', 'Ivanov', 'Park', 'Reyes', 'Ali', 'Fischer', 'Das', 'Brooks', 'Ito', 'Sharma', 'Cole', 'Haque', 'Ortiz'];
  var PLOT_A = ['A disgraced detective', 'A young runaway', 'A retired soldier', 'A gifted student', 'An ambitious hacker', 'A small-town doctor', 'A fearless pilot', 'A forgotten prince', 'A lonely inventor', 'Two rival siblings', 'A band of outcasts', 'A mysterious stranger'];
  var PLOT_B = ['uncovers a conspiracy that reaches the highest levels of power', 'must cross a war-torn land to save everything they love', 'discovers a hidden power that could change the world', 'is pulled back into a past they tried to bury', 'races against time to stop a catastrophe', 'forms an unlikely alliance to survive impossible odds', 'learns that the enemy has been closer than anyone imagined', 'sets out to find the truth behind a vanished city'];
  var PLOT_C = ['Packed with action, heart and unexpected twists.', 'A visually stunning journey you will not forget.', 'Told with humour, tension and a stirring score.', 'Every choice has a price, and the clock is ticking.', 'An emotional ride from the first scene to the last.'];

  var GENRES = (window.MX && MX.GENRES) || ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller', 'Crime', 'Mystery'];
  var COMMON_GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Drama', 'Family', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Sport', 'Music'];
  COMMON_GENRES = COMMON_GENRES.filter(function (g) { return GENRES.indexOf(g) >= 0; });
  if (COMMON_GENRES.length < 6) COMMON_GENRES = GENRES.slice(0, 16);
  var INDUSTRIES = ['Hollywood', 'Hollywood', 'Hollywood', 'Bollywood', 'Bollywood', 'Korean', 'Tollywood', 'Kollywood', 'British', 'French', 'Chinese', 'Dhallywood'];
  var LANGS = ['English', 'Hindi', 'Bengali', 'Korean', 'Tamil', 'Telugu', 'French', 'Spanish'];

  /* ---------- generated artwork (SVG data URIs: no internet needed, always loads) ---------- */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function wrap(title, max) {
    var words = title.split(' '), lines = [], cur = '';
    words.forEach(function (w) { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  }
  function uri(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
  function art(title, hue, tag, w, h) {
    var wide = w > h, h2 = (hue + 50) % 360, size = wide ? 78 : 46, max = wide ? 18 : 11;
    var lines = wrap(title.toUpperCase(), max), lh = size * 1.12;
    var y0 = wide ? h / 2 - ((lines.length - 1) * lh) / 2 : h - 80 - (lines.length - 1) * lh;
    var tx = wide ? 90 : 32, ta = 'start';
    var text = lines.map(function (l, i) { return '<text x="' + tx + '" y="' + (y0 + i * lh) + '" fill="#fff" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="' + size + '" text-anchor="' + ta + '" style="paint-order:stroke" stroke="rgba(0,0,0,.35)" stroke-width="4">' + esc(l) + '</text>'; }).join('');
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
      + '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',70%,38%)"/><stop offset="1" stop-color="hsl(' + h2 + ',75%,16%)"/></linearGradient>'
      + '<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".75"/></linearGradient></defs>'
      + '<rect width="' + w + '" height="' + h + '" fill="url(#g)"/>'
      + '<circle cx="' + (wide ? w * 0.78 : w * 0.7) + '" cy="' + (wide ? h * 0.35 : h * 0.28) + '" r="' + (wide ? h * 0.42 : w * 0.45) + '" fill="hsl(' + h2 + ',80%,60%)" opacity=".22"/>'
      + '<circle cx="' + (wide ? w * 0.62 : w * 0.2) + '" cy="' + (wide ? h * 0.8 : h * 0.55) + '" r="' + (wide ? h * 0.25 : w * 0.3) + '" fill="#fff" opacity=".07"/>'
      + '<rect width="' + w + '" height="' + h + '" fill="url(#s)"/>' + text
      + '<text x="' + tx + '" y="' + (wide ? 70 : 52) + '" fill="#fff" opacity=".85" font-family="Arial,sans-serif" font-weight="700" font-size="' + (wide ? 26 : 20) + '" letter-spacing="4">' + esc(tag.toUpperCase()) + '</text></svg>';
    return uri(svg);
  }

  /* ---------- build the fake catalogue ---------- */
  var movies = {}, ids = [], used = {}, now = Date.now(), DAY = 86400000;
  for (var i = 1; i <= COUNT; i++) {
    var roll = rnd(), kind = roll < 0.5 ? 'movie' : (roll < 0.78 ? 'series' : 'anime');   // anime = series or film
    var isSeries = kind === 'series' || (kind === 'anime' && rnd() < 0.7);
    var title, tries = 0;
    do {
      title = kind === 'anime' ? pick(ANIME_A) + ' ' + pick(ANIME_B) + (rnd() < 0.4 ? ' ' + pick(['Z', 'X', 'Origins', 'Reborn']) : '')
        : (rnd() < 0.5 ? pick(ADJ) + ' ' + pick(NOUN) : 'The ' + pick(ADJ) + ' ' + pick(NOUN));
    } while (used[title] && ++tries < 12);
    if (used[title]) title += ' ' + between(2, 9);
    used[title] = 1;

    var hue = between(0, 359), id = 'mock_' + (i < 10 ? '00' : i < 100 ? '0' : '') + i;
    var year = kind === 'anime' ? between(2005, 2026) : between(1998, 2026);
    var type = kind === 'anime' ? 'Anime' : (isSeries ? pick(['Series', 'Series', 'Web Series', 'TV Show']) : 'Movie');
    var tag = type === 'Movie' ? 'Movie' : type;
    var genres = pickN(kind === 'anime' ? ['Action', 'Adventure', 'Fantasy', 'Comedy', 'Drama', 'Romance', 'Sci-Fi', 'Animation'].filter(function (g) { return GENRES.indexOf(g) >= 0; }) : COMMON_GENRES, between(1, 3));
    if (!genres.length) genres = [GENRES[0]];
    var industry = kind === 'anime' ? 'Japanese' : pick(INDUSTRIES);
    var langs = kind === 'anime' ? (rnd() < 0.5 ? ['Japanese'] : ['Japanese', 'English']) : (rnd() < 0.25 ? pickN(LANGS, 2) : [pick(LANGS)]);
    var vid = pick(VIDEOS);
    var cast = pickN(FIRST, 5).map(function (f) { return f + ' ' + pick(LAST); }).join(', ');
    var m = {
      title: title, year: String(year), rating: (Math.round((5 + rnd() * 4.6) * 10) / 10).toFixed(1),
      posterUrl: art(title, hue, tag, 400, 600), coverUrl: art(title, hue, tag, 1280, 720),
      cast: cast, description: pick(PLOT_A) + ' ' + pick(PLOT_B) + '. ' + pick(PLOT_C),
      type: type, industry: industry, languages: langs, dubbed: langs.length > 1 || (kind !== 'anime' && industry !== 'Hollywood' && rnd() < 0.3),
      genres: genres, category: genres[0],
      isPrivate: false, isUpcoming: false, releaseDate: null, releaseTs: null,
      contentType: isSeries ? 'series' : 'movie',
      trailerUrl: vid, isMock: true
    };
    if (isSeries) {
      var seasons = {}, sn = between(1, kind === 'anime' ? 3 : 4);
      for (var s = 1; s <= sn; s++) {
        var eps = [], en = between(4, 12);
        for (var e = 1; e <= en; e++) { var v = pick(VIDEOS); eps.push({ name: 'Episode ' + e, q480: v, q720: v, q1080: v }); }
        seasons['Season ' + s] = eps;
      }
      m.seasons = seasons;
    } else { m.q480 = vid; m.q720 = vid; m.q1080 = vid; }
    if (i % 27 === 0) {                       // a few "coming soon" titles
      var when = now + between(5, 120) * DAY;
      m.isUpcoming = true; m.releaseTs = when; m.releaseDate = new Date(when).toISOString().slice(0, 16);
    }
    movies[id] = m; ids.push(id);
  }

  /* ---------- hero banners (wide artwork, linked to some of the fake titles) ---------- */
  var banners = {}, bannerIds = pickN(ids.filter(function (id) { return !movies[id].isUpcoming; }), 8);
  bannerIds.forEach(function (id, n) { banners['mock_b' + (n + 1)] = { imageUrl: movies[id].coverUrl, movieId: id, movieTitle: movies[id].title }; });

  window.__MX_MOCK = { movies: movies, banners: banners };

  /* ---------- hook into db.ref ---------- */
  function mkSnap(path, v) {
    return {
      key: path.split('/').filter(Boolean).pop() || null,
      val: function () { return v === undefined ? null : v; },
      exists: function () { return v !== null && v !== undefined; },
      hasChildren: function () { return !!v && typeof v === 'object' && Object.keys(v).length > 0; },
      numChildren: function () { return v && typeof v === 'object' ? Object.keys(v).length : 0; },
      child: function (p) { var x = v; p.split('/').filter(Boolean).forEach(function (k) { x = x && typeof x === 'object' ? x[k] : undefined; }); return mkSnap(path + '/' + p, x); },
      forEach: function (cb) { if (!v || typeof v !== 'object') return false; var ks = Object.keys(v); for (var i = 0; i < ks.length; i++) if (cb(mkSnap(path + '/' + ks[i], v[ks[i]])) === true) return true; return false; }
    };
  }
  function merged(real, extra) { return Object.assign({}, extra, real && typeof real === 'object' ? real : {}); }

  // a ref for a whole list: shows the fake items at once, then fake + real when the server answers
  function listRef(ref, path, extra) {
    var w = Object.create(ref);
    w.on = function (evt, cb, errCb) {
      Promise.resolve().then(function () { try { cb(mkSnap(path, extra)); } catch (e) { console.error(e); } });
      ref.on(evt, function (s) { cb(mkSnap(path, merged(s.val(), extra))); }, errCb);
      return cb;
    };
    w.off = function () { return ref.off.apply(ref, arguments); };
    w.once = function (evt, cb, errCb) {
      return ref.once('value').then(function (s) { return mkSnap(path, merged(s.val(), extra)); }, function () { return mkSnap(path, extra); })
        .then(function (sn) { if (cb) cb(sn); return sn; });
    };
    ['lite', 'orderByChild', 'limitToLast'].forEach(function (f) { if (ref[f]) w[f] = function () { return listRef(ref[f].apply(ref, arguments), path, extra); }; });
    return w;
  }
  // a ref for one fake title (e.g. the player page asks for movies/<id>)
  function itemRef(ref, path, item) {
    var w = Object.create(ref);
    w.once = function (evt, cb) { var sn = mkSnap(path, item); if (cb) { cb(sn); } return Promise.resolve(sn); };
    w.on = function (evt, cb) { Promise.resolve().then(function () { cb(mkSnap(path, item)); }); return cb; };
    w.off = function () {};
    return w;
  }

  var realRef = db.ref.bind(db);
  db.ref = function (p) {
    var ref = realRef(p), path = String(p || '').split('/').filter(Boolean).join('/');
    if (path === 'movies') return listRef(ref, path, movies);
    if (path === 'banners') return listRef(ref, path, banners);
    var mm = /^movies\/(mock_[0-9]+)$/.exec(path);
    if (mm && movies[mm[1]]) return itemRef(ref, path, movies[mm[1]]);
    return ref;
  };

  try { console.info('[MOCK DATA ON] ' + ids.length + ' fake titles + ' + bannerIds.length + ' banners. Turn off: localStorage.mx_mock = "0"'); } catch (e) {}
})();
