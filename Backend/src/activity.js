// Console activity log with built-in flood protection.
//  - Important, low-frequency actions (logins, writes, admin actions, denials, worker up/down...) = one line each.
//  - High-frequency traffic (reads, 304s, static files, presence, sync pulls) is only COUNTED and shown as one summary line per minute.
//  - Flood guard: at most `maxPerWindow` lines per `windowSec` seconds; the rest is counted and reported as "N lines hidden".
//  - LOG_LEVEL: quiet   = errors + start/stop only
//               normal  = activity lines + 1-minute summary (default)
//               verbose = also one line per read request (debugging only)
const LEVELS = { quiet: 0, normal: 1, verbose: 2 };
const clean = (v, n = 110) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, n);

export function createActivity({ level = 'normal', log = console, role = 'main', summaryEverySec = 60, maxPerWindow = 60, windowSec = 10 } = {}) {
  const lvl = LEVELS[String(level).toLowerCase()] ?? 1;
  const tag = String(role).toUpperCase();
  const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
  const prefix = () => `${stamp()} [${tag}]`;
  let counters = {};
  let winStart = Date.now(), winCount = 0, hidden = 0;
  let timer = null, gauges = null;

  function flushHidden() {
    if (hidden > 0) { log.log(`${prefix()} ... ${hidden} more activity lines hidden (flood guard, still counted in the summary)`); hidden = 0; }
  }
  function emit(text) {
    const now = Date.now();
    if (now - winStart >= windowSec * 1000) { flushHidden(); winStart = now; winCount = 0; }
    if (winCount >= maxPerWindow) { hidden++; return; }
    winCount++;
    log.log(`${prefix()} ${text}`);
  }
  const who = (w) => (w && (w.uid || w.ip) ? `uid=${clean(w.uid || '-', 40)} ip=${clean(w.ip || '-', 45)}` : '');

  // kind = short word (WRITE, DENY, ADMIN, USER ...), w = { uid, ip }, detail = free text
  function event(kind, w, detail = '', minLevel = 1) {
    if (lvl < minLevel) return;
    emit(`${kind.padEnd(6)} ${who(w)}${detail ? ' ' + clean(detail) : ''}`.trimEnd());
  }
  const count = (name, n = 1) => { counters[name] = (counters[name] || 0) + n; };

  function summary() {
    flushHidden();
    const c = counters; counters = {};
    if (lvl < 1) return;
    const parts = Object.entries(c).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`);
    let extra = '';
    try { extra = gauges ? gauges() : ''; } catch { /* ignore */ }
    if (!parts.length && !extra) return;
    log.log(`${prefix()} STAT   last ${summaryEverySec}s: ${parts.join(' ') || 'idle'}${extra ? ' | ' + extra : ''}`);
  }
  function start() {
    if (timer) return;
    timer = setInterval(summary, summaryEverySec * 1000); timer.unref?.();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  // Drop-in replacement for console: adds the time + role to every older log line (backup, telegram, sync ...).
  const logger = {
    log: (...a) => log.log(prefix(), ...a),
    error: (...a) => log.error(prefix(), ...a),
    warn: (...a) => (log.warn || log.log).call(log, prefix(), ...a),
  };

  return {
    level: Object.keys(LEVELS).find(k => LEVELS[k] === lvl),
    event, count, summary, start, stop, logger,
    verbose: (kind, w, detail) => event(kind, w, detail, 2),
    setGauges: (fn) => { gauges = fn; },
  };
}
