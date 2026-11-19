// Who may see which movie, and how much of it. Applied on every non-admin read of /api/db/movies and /api/db/banners.
//   - Private titles do not exist for normal users (not in the list, not by id, not in banners).
//   - Upcoming titles (not yet released) are visible, but every stream link is removed. The links reach the user's device only after the release time.
// Same release rule as the site: isUpcoming + a release time that has not passed yet = locked.
import { getIn } from './store.js';

export function releaseMs(m) {
  if (!m) return 0;
  if (typeof m.releaseTs === 'number') return m.releaseTs;
  if (m.releaseDate) { const t = Date.parse(m.releaseDate); return Number.isNaN(t) ? 0 : t; }
  return 0;
}
export function isLocked(m, now = Date.now()) {
  if (!m || typeof m !== 'object' || !m.isUpcoming) return false;
  const ms = releaseMs(m);
  return !(ms && ms <= now);
}

const LINK_KEY = /^server\d*$/;
function scrub(v) {
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!LINK_KEY.test(k)) o[k] = scrub(x);
    return o;
  }
  return v;
}

// One movie as a normal user may see it (undefined = hidden completely).
export function publicMovie(m, now = Date.now()) {
  if (!m || typeof m !== 'object') return m;
  if (m.isPrivate) return undefined;
  return isLocked(m, now) ? scrub(m) : m;
}
export function publicMovies(map, now = Date.now()) {
  if (!map || typeof map !== 'object') return map;
  const out = {};
  for (const [id, m] of Object.entries(map)) { const p = publicMovie(m, now); if (p !== undefined) out[id] = p; }
  return out;
}
// A read at movies/<id>/... : filter the movie first, then walk into it.
export function publicMoviePath(movie, rest, now = Date.now()) {
  const p = publicMovie(movie, now);
  return p === undefined ? undefined : getIn(p, rest);
}
// Banners that point to a private title are dropped (banners without a movie, or with an unknown one, stay as they are).
export function publicBanners(banners, movies) {
  if (!banners || typeof banners !== 'object') return banners;
  const out = {};
  for (const [id, b] of Object.entries(banners)) {
    const m = b && b.movieId && movies ? movies[b.movieId] : null;
    if (m && m.isPrivate) continue;
    out[id] = b;
  }
  return out;
}
