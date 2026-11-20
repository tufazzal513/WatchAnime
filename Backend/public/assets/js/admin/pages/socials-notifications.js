// --- Editable Socials + Notifications ---
// The admin only picks a platform and pastes a link. Name and icon are filled in from the platform automatically
// (stored as { name, url, icon } so the user app and old records keep working unchanged).
const SOCIAL_PLATFORMS = {
    facebook:  { name: 'Facebook',    icon: 'fab fa-facebook' },
    youtube:   { name: 'YouTube',     icon: 'fab fa-youtube' },
    telegram:  { name: 'Telegram',    icon: 'fab fa-telegram' },
    instagram: { name: 'Instagram',   icon: 'fab fa-instagram' },
    tiktok:    { name: 'TikTok',      icon: 'fab fa-tiktok' },
    whatsapp:  { name: 'WhatsApp',    icon: 'fab fa-whatsapp' },
    discord:   { name: 'Discord',     icon: 'fab fa-discord' },
    twitter:   { name: 'X / Twitter', icon: 'fab fa-twitter' },
    other:     { name: 'Website',     icon: 'fas fa-link' }
};

function initEditableSocials(){
    const form = document.getElementById('social-form');
    const platformEl = document.getElementById('social-platform');
    const urlEl  = document.getElementById('social-url');
    const previewEl = document.getElementById('social-icon-preview');
    const submitBtn = document.getElementById('social-submit-btn');
    const cancelBtn = document.getElementById('social-cancel-btn');

    if(!form) return;

    // When editing an old record whose name/icon don't match a platform, keep them unless the admin picks another platform.
    let legacy = null;

    const syncIcon = () => {
        const p = SOCIAL_PLATFORMS[platformEl.value] || SOCIAL_PLATFORMS.other;
        previewEl.className = ((legacy && platformEl.value === 'other') ? legacy.icon : p.icon) + ' text-blue-400';
    };
    platformEl?.addEventListener('change', () => { legacy = null; syncIcon(); });
    syncIcon();

    const reset = () => {
        form.dataset.editId = '';
        submitBtn.textContent = 'Add Link';
        cancelBtn.classList.add('hidden');
        urlEl.value = '';
        platformEl.value = 'facebook';
        legacy = null;
        syncIcon();
    };

    cancelBtn?.addEventListener('click', reset);

    form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const url = (urlEl.value||'').trim();
        if(!url) return alert('Please paste the link');
        const p = SOCIAL_PLATFORMS[platformEl.value] || SOCIAL_PLATFORMS.other;
        const data = legacy && platformEl.value === 'other'
            ? { name: legacy.name, url, icon: legacy.icon }
            : { name: p.name, url, icon: p.icon };
        const editId = form.dataset.editId;
        const ref = editId ? db.ref(`socialLinks/${editId}`) : db.ref('socialLinks').push();
        ref.set(data).then(()=> reset());
    });

    window.editSocial = (id, item) => {
        form.dataset.editId = id;
        urlEl.value = item?.url || '';
        const icon = (item?.icon || '').trim();
        const key = Object.keys(SOCIAL_PLATFORMS).find(k => k !== 'other' && SOCIAL_PLATFORMS[k].icon === icon);
        if (key) { platformEl.value = key; legacy = null; }
        else { platformEl.value = 'other'; legacy = { name: item?.name || 'Website', icon: icon || 'fas fa-link' }; }
        syncIcon();
        submitBtn.textContent = 'Update Link';
        cancelBtn.classList.remove('hidden');
        showAdminPage('settings');
        setTimeout(() => {
            document.getElementById('social-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    db.ref('socialLinks').on('value', s=>{
        const data = s.val() || {};
        window.__tmp_socials = data;
        const listEl = document.getElementById('socials-list');
        if(!listEl) return;
        const entries = Object.entries(data);
        listEl.innerHTML = entries.length ? entries.map(([id,i])=>`
            <div class="flex items-center justify-between bg-gray-700/50 p-2 rounded border border-gray-600">
                <div class="flex items-center gap-2">
                    <i class="${(i.icon||'fas fa-link')} text-blue-400"></i>
                    <div>
                        <div class="text-sm font-semibold">${i.name||''}</div>
                        <div class="text-[10px] text-gray-400 truncate max-w-[260px]">${i.url||''}</div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick='editSocial("${id}", (window.__tmp_socials||{})["${id}"])' class="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-white">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button onclick="deleteItem('socialLinks','${id}')" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('') : '<p class="text-xs text-gray-500">No social links yet.</p>';
    });

    reset();
}

function initEditableNotifications(){
    const form = document.getElementById('notification-form');
    const titleEl = document.getElementById('notif-title');
    const msgEl = document.getElementById('notif-message');
    const submitBtn = document.getElementById('notif-submit-btn');
    const cancelBtn = document.getElementById('notif-cancel-btn');

    if(!form) return;

    const reset = () => {
        form.dataset.editId = '';
        submitBtn.textContent = 'Send';
        cancelBtn.classList.add('hidden');
        titleEl.value = '';
        msgEl.value = '';
    };
    cancelBtn?.addEventListener('click', reset);

    form.addEventListener('submit', (e)=>{
        e.preventDefault();
        const data = { title: (titleEl.value||'').trim(), message: (msgEl.value||'').trim(), timestamp: Date.now() };
        if(!data.title || !data.message) return alert('Title and message required');
        const editId = form.dataset.editId;
        const ref = editId ? db.ref(`notifications/${editId}`) : db.ref('notifications').push();
        ref.set(data).then(()=> reset());
    });

    window.editNotif = (id, item) => {
        form.dataset.editId = id;
        titleEl.value = item?.title || '';
        msgEl.value = item?.message || '';
        submitBtn.textContent = 'Update';
        cancelBtn.classList.remove('hidden');
        showAdminPage('settings');
        setTimeout(() => {
            document.getElementById('notification-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    db.ref('notifications').on('value', s=>{
        const data = s.val() || {};
        window.__tmp_notifs = data;
        const listEl = document.getElementById('notifications-list');
        if(!listEl) return;
        const entries = Object.entries(data).sort((a,b)=>(b[1].timestamp||0)-(a[1].timestamp||0));
        listEl.innerHTML = entries.length ? entries.map(([id,i])=>`
            <div class="bg-gray-700/50 p-3 rounded border border-gray-600 relative">
                <h5 class="font-bold text-xs pr-20">${i.title||''}</h5>
                <p class="text-xs text-gray-300 mt-1">${i.message||''}</p>
                <p class="text-[10px] text-gray-500 mt-2 text-right">${i.timestamp?new Date(i.timestamp).toLocaleString():''}</p>
                <div class="absolute top-2 right-2 flex gap-2">
                    <button onclick='editNotif("${id}", (window.__tmp_notifs||{})["${id}"])' class="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-white">
                        <i class="fas fa-pen"></i>
                    </button>
                    <button onclick="deleteItem('notifications','${id}')" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('') : '<p class="text-xs text-gray-500">No notifications yet.</p>';
    });

    reset();
}
