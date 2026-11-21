// ===== Settings page: default video quality (auto | 480 | 720 | 1080) =====
// Saved on the server (users/<uid>/settings/defaultQuality) so it follows the user to every device,
// with a per-account copy in localStorage so the player never has to wait for the network.
(function () {
    const VALID = ['auto', '480', '720', '1080'];
    const uidOf = () => { try { return (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.uid) || ''; } catch (e) { return ''; } };
    const keyOf = () => 'mx_defq_' + uidOf();
    const label = (q) => (q === 'auto' ? 'Auto' : q + 'p');
    window.mxDefQ = () => {
        let v = 'auto';
        try { v = localStorage.getItem(keyOf()) || 'auto'; } catch (e) {}
        return VALID.includes(v) ? v : 'auto';
    };
    const paint = () => {
        const cur = window.mxDefQ();
        document.querySelectorAll('#st-defq .st-opt').forEach(b => { const on = b.dataset.q === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.setAttribute('role', 'radio'); });
        const sub = document.getElementById('pf-set-sub'); if (sub) sub.textContent = 'Default video quality: ' + label(cur);
    };
    window.renderSettingsPage = paint;
    window.mxSetDefQ = (q) => {
        if (!VALID.includes(q)) return;
        try { localStorage.setItem(keyOf(), q); } catch (e) {}
        paint();
        try { if (uidOf()) db.ref('users/' + uidOf() + '/settings/defaultQuality').set(q).catch(() => {}); } catch (e) {}
    };
    // after login: pull the saved choice from the server (it wins over the local copy)
    window.mxLoadDefQ = () => {
        try {
            if (!uidOf()) return;
            db.ref('users/' + uidOf() + '/settings/defaultQuality').once('value').then((snap) => {
                const v = snap && snap.val ? snap.val() : null;
                if (VALID.includes(v)) { try { localStorage.setItem(keyOf(), v); } catch (e) {} }
                paint();
            }).catch(() => {});
        } catch (e) {}
    };
    paint();
})();
