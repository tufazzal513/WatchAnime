// --- RENDER SOCIALS & NOTIFICATIONS ---
const renderSocials = (socials) => {
    const container = document.getElementById('social-links-container');
    if(!container) return;
    const list = socials ? Object.values(socials).filter(x => x && x.url) : [];
    if(!list.length) { container.innerHTML = '<p class="pf-empty">No community links added yet.</p>'; return; }
    container.innerHTML = list.map(item => `
        <a class="pf-row" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">
            <i class="pf-ic ${esc(item.icon || 'fas fa-link')}"></i>
            <span class="pf-tx"><b>${esc(item.name)}</b><small>Tap to join</small></span>
            <i class="pf-go fas fa-external-link-alt"></i>
        </a>`).join('');
};


// Notifications: newest first, grouped by day. "Read" is remembered on this device (a New dot on the bell and on each unread item).
const NT_KEY = 'mx_notif_read';
const ntRead = () => { try { return new Set(JSON.parse(localStorage.getItem(NT_KEY) || '[]')); } catch (e) { return new Set(); } };
const ntSave = (set) => { try { localStorage.setItem(NT_KEY, JSON.stringify([...set].slice(-300))); } catch (e) {} };
let ntItems = [];
const ntAgo = (ts) => {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    const d = Math.floor(h / 24);
    return d < 7 ? d + (d === 1 ? ' day ago' : ' days ago') : new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
// text -> safe HTML: line breaks kept, web addresses become links
const ntText = (t) => esc(t).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
const ntUpdateDot = () => {
    const read = ntRead(), unread = ntItems.filter(n => !read.has(n.id)).length;
    const dot = document.getElementById('bell-dot'); if (dot) dot.style.display = unread ? '' : 'none';
    const btn = document.getElementById('nt-readall'); if (btn) btn.style.display = unread ? '' : 'none';
};
window.ntOpen = (id) => {
    const el = document.querySelector('[data-nt="' + id + '"]'); if (!el) return;
    el.classList.toggle('open');
    const read = ntRead(); if (!read.has(id)) { read.add(id); ntSave(read); el.classList.remove('unread'); ntUpdateDot(); }
};
window.markAllNotifsRead = () => {
    const read = ntRead(); ntItems.forEach(n => read.add(n.id)); ntSave(read);
    document.querySelectorAll('.nt-item.unread').forEach(e => e.classList.remove('unread'));
    ntUpdateDot();
};
const renderNotifications = (notifs) => {
    const container = document.getElementById('notifications-container');
    ntItems = Object.entries(notifs || {}).filter(([_, n]) => n && (n.title || n.message)).map(([id, n]) => ({ id, ...n })).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (!container) return;
    if (!ntItems.length) { container.innerHTML = '<div class="nf-empty"><i class="fas fa-bell-slash" style="font-size:42px;display:block;margin-bottom:10px"></i>No notifications yet.</div>'; ntUpdateDot(); return; }
    const read = ntRead();
    const dayOf = (ts) => { const d = new Date(ts), t = new Date(), y = new Date(Date.now() - 864e5);
        const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
        return same(d, t) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); };
    let last = '';
    container.innerHTML = ntItems.map((n) => {
        const day = n.timestamp ? dayOf(n.timestamp) : 'Earlier', head = day !== last ? `<h3 class="hs-day">${esc(day)}</h3>` : ''; last = day;
        return head + `
        <div class="nt-item ${read.has(n.id) ? '' : 'unread'}" data-nt="${esc(n.id)}" onclick="ntOpen('${esc(n.id)}')">
            <span class="nt-ic"><i class="fas fa-bullhorn"></i></span>
            <div class="nt-body">
                <div class="nt-top"><b class="nt-title">${esc(n.title || 'Notice')}</b><span class="nt-time">${n.timestamp ? ntAgo(n.timestamp) : ''}</span></div>
                <p class="nt-msg">${ntText(n.message || '')}</p>
            </div>
            <i class="nt-new"></i>
        </div>`;
    }).join('');
    ntUpdateDot();
};
