// Safe, additive importer for Firebase Realtime Database JSON exports.
// Existing records and metadata are never overwritten or deleted.
import { clean } from './store.js';

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 400 && !/[.$#\[\]/\u0000-\u001f]/.test(id);
const clone = (v) => JSON.parse(JSON.stringify(v));

function entries(value) {
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v]);
  if (isObject(value)) return Object.entries(value);
  return [];
}

function seasonIdentity(name) {
  const s = String(name || '').trim().toLowerCase();
  const m = /^(?:season|s)\s*0*(\d+)$/i.exec(s);
  return m ? `season:${Number(m[1])}` : `name:${s}`;
}

function episodeIdentity(ep, index) {
  if (!isObject(ep)) return `index:${index}`;
  for (const k of ['episodeNumber', 'episode_number', 'episodeNo', 'episode_no', 'number', 'ep', 'n']) {
    const n = Number(ep[k]);
    if (ep[k] !== undefined && ep[k] !== null && Number.isFinite(n) && n > 0) return `episode:${n}`;
  }
  const name = String(ep.name || ep.title || '').trim();
  const match = /(?:episode|ep|e)\s*[-_#.]?\s*0*(\d+)/i.exec(name);
  if (match) return `episode:${Number(match[1])}`;
  if (name) return `name:${name.toLowerCase()}`;
  return `index:${index}`;
}

function validEpisode(ep) {
  return isObject(ep) && Object.keys(ep).length > 0 && (
    typeof ep.name === 'string' || typeof ep.title === 'string' ||
    ep.episodeNumber !== undefined || ep.episode_number !== undefined ||
    typeof ep.q480 === 'string' || typeof ep.q720 === 'string' || typeof ep.q1080 === 'string'
  );
}

function sanitizeSeasons(rawSeasons, report) {
  const result = {};
  for (const [seasonName, rawEpisodes] of entries(rawSeasons)) {
    if (!seasonName || (!Array.isArray(rawEpisodes) && !isObject(rawEpisodes))) {
      report.skipped++; report.addIssue(`Invalid season: ${seasonName || '(unnamed)'}`); continue;
    }
    const eps = [];
    const seenEpisodes = new Set();
    for (const [idx, ep] of entries(rawEpisodes)) {
      if (!validEpisode(ep)) {
        report.skipped++; report.addIssue(`Invalid episode in ${seasonName}: ${idx}`); continue;
      }
      const identity = episodeIdentity(ep, Number(idx));
      if (seenEpisodes.has(identity)) { report.duplicateEpisodes++; continue; }
      try {
        const c = clean(ep);
        if (c !== undefined) { eps.push(c); seenEpisodes.add(identity); }
      } catch {
        report.skipped++; report.addIssue(`Invalid episode data in ${seasonName}: ${idx}`);
      }
    }
    if (!eps.length) {
      report.skipped++; report.addIssue(`Season has no valid episodes: ${seasonName}`); continue;
    }
    result[seasonName] = eps;
  }
  return result;
}

function sanitizeMovie(raw, report) {
  if (!isObject(raw) || typeof raw.title !== 'string' || !raw.title.trim()) return null;
  const out = clone(raw);
  if (out.seasons !== undefined) out.seasons = sanitizeSeasons(out.seasons, report);
  try { return clean(out); } catch { return null; }
}

function mergeSeriesSeasons(existing, incoming, report) {
  const out = clone(existing || {});
  const current = isObject(out.seasons) ? out.seasons : {};
  const incomingSeasons = isObject(incoming.seasons) ? incoming.seasons : {};
  let changed = false;

  const currentByIdentity = new Map(Object.keys(current).map(k => [seasonIdentity(k), k]));
  for (const [incomingName, rawEpisodes] of Object.entries(incomingSeasons)) {
    if (!incomingName || (!Array.isArray(rawEpisodes) && !isObject(rawEpisodes))) {
      report.skipped++; report.addIssue(`Invalid season: ${incomingName || '(unnamed)'}`); continue;
    }
    const identity = seasonIdentity(incomingName);
    const existingName = currentByIdentity.get(identity);
    if (!existingName) {
      const valid = sanitizeSeasons({ [incomingName]: rawEpisodes }, report)[incomingName];
      if (valid && valid.length) {
        current[incomingName] = valid;
        currentByIdentity.set(identity, incomingName);
        report.addedSeasons++;
        report.addedEpisodes += valid.length;
        changed = true;
      }
      continue;
    }

    const oldEpisodes = entries(current[existingName]).map(([, ep]) => ep);
    const known = new Set(oldEpisodes.map((ep, i) => episodeIdentity(ep, i)));
    const nextEpisodes = [...oldEpisodes];
    for (const [idx, ep] of entries(rawEpisodes)) {
      if (!validEpisode(ep)) {
        report.skipped++; report.addIssue(`Invalid episode in ${incomingName}: ${idx}`); continue;
      }
      const key = episodeIdentity(ep, Number(idx));
      if (known.has(key)) { report.duplicateEpisodes++; continue; }
      try {
        const c = clean(ep);
        if (c !== undefined) {
          nextEpisodes.push(c);
          known.add(key);
          report.addedEpisodes++;
          changed = true;
        }
      } catch {
        report.skipped++; report.addIssue(`Invalid episode data in ${incomingName}: ${idx}`);
      }
    }
    if (nextEpisodes.length !== oldEpisodes.length) current[existingName] = nextEpisodes;
  }
  if (changed) out.seasons = current;
  return { movie: out, changed };
}

export function mergeFirebaseTree(store, data) {
  if (!isObject(data)) {
    const e = new Error('invalid_import_root'); e.status = 400; throw e;
  }

  const report = {
    ok: true, scanned: 0, added: 0, merged: 0, duplicate: 0, skipped: 0,
    addedMovies: 0, addedSeries: 0, addedSeasons: 0, addedEpisodes: 0,
    duplicateEpisodes: 0, addedOther: 0, issues: [],
    addIssue(message) { if (this.issues.length < 100) this.issues.push(String(message).slice(0, 240)); },
  };

  const apply = () => {
    for (const [collection, rawCollection] of Object.entries(data)) {
      if (collection === 'online_users') continue; // presence is temporary, never imported
      if (!validId(collection) || !isObject(rawCollection)) {
        report.skipped++; report.addIssue(`Invalid collection: ${collection}`); continue;
      }

      // Firebase's analytics/errors branch is stored as a dedicated collection.
      if (collection === 'analytics') {
        const rawErrors = rawCollection.errors;
        for (const [id, raw] of entries(rawErrors)) {
          report.scanned++;
          if (!validId(id) || !isObject(raw)) { report.skipped++; report.addIssue(`Invalid analytics error: ${id}`); continue; }
          if (store.readRaw(['analytics', 'errors', id]) !== undefined) { report.duplicate++; continue; }
          try { const v = clean(raw); if (v !== undefined) { store.writeAt(['analytics', 'errors', id], v); report.addedOther++; report.added++; } }
          catch { report.skipped++; report.addIssue(`Invalid analytics error data: ${id}`); }
        }
        continue;
      }

      for (const [id, raw] of Object.entries(rawCollection)) {
        report.scanned++;
        if (!validId(id)) { report.skipped++; report.addIssue(`Invalid record ID in ${collection}`); continue; }
        // Admin membership is now exclusively controlled by ADMIN_UID on the host.
        if (collection === 'settings' && id === 'adminUIDs') { report.skipped++; continue; }
        if (raw === null || raw === undefined) { report.skipped++; continue; }

        const old = store.readRaw([collection, id]);
        if (collection === 'movies') {
          const incoming = sanitizeMovie(raw, report);
          if (!incoming) { report.skipped++; report.addIssue(`Invalid movie/series record: ${id} (title is required)`); continue; }
          if (old === undefined) {
            store.writeAt(['movies', id], incoming);
            report.added++;
            if (incoming.contentType === 'series' || incoming.seasons) {
              report.addedSeries++;
              for (const eps of Object.values(incoming.seasons || {})) report.addedEpisodes += entries(eps).length;
            } else report.addedMovies++;
            continue;
          }
          if (!isObject(old)) { report.duplicate++; continue; }
          if (old.contentType && incoming.contentType && old.contentType !== incoming.contentType) { report.duplicate++; continue; }
          const seriesLike = old.contentType === 'series' || incoming.contentType === 'series' || old.seasons || incoming.seasons;
          if (seriesLike && incoming.seasons) {
            const merged = mergeSeriesSeasons(old, incoming, report);
            if (merged.changed) {
              // Existing title metadata and existing episodes remain untouched.
              store.writeAt(['movies', id], clean(merged.movie));
              report.merged++;
            } else report.duplicate++;
          } else report.duplicate++;
          continue;
        }

        if (old !== undefined) { report.duplicate++; continue; }
        try {
          const value = clean(raw);
          if (value === undefined) { report.skipped++; continue; }
          store.writeAt([collection, id], value);
          report.added++; report.addedOther++;
        } catch {
          report.skipped++; report.addIssue(`Invalid ${collection} record: ${id}`);
        }
      }
    }
  };

  store.transaction(apply);
  delete report.addIssue;
  return report;
}
