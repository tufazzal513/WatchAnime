// Admin access is verified by the backend using ADMIN_UID from the host environment.
auth.onAuthStateChanged(user => {
    const loader = document.getElementById('global-loader');
    if (!user) {
        localStorage.removeItem('movex_admin_cache');
        window.adminPanelInitialized = false;
        if (loader) loader.style.display = 'none';
        loginScreen.style.display = 'flex';
        adminPanel.classList.add('hidden');
        return;
    }

    if (loader) loader.style.display = 'flex';
    loginScreen.style.display = 'none';
    adminPanel.classList.add('hidden');

    // The backend verifies the signed Firebase ID token and compares its UID with ADMIN_UID.
    mxApi('GET', '/api/admin/status').then(() => {
        localStorage.setItem('movex_admin_cache', 'true');
        if (loader) loader.style.display = 'none';
        loginScreen.style.display = 'none';
        adminPanel.classList.remove('hidden');
        if (!window.adminPanelInitialized) {
            window.adminPanelInitialized = true;
            initAdminPanel();
        }
    }).catch(err => {
        localStorage.removeItem('movex_admin_cache');
        window.adminPanelInitialized = false;
        if (loader) loader.style.display = 'none';
        adminPanel.classList.add('hidden');
        loginScreen.style.display = 'flex';
        authErrorEl.textContent = err && err.status === 403
            ? 'Access Denied: This Firebase UID is not configured as ADMIN_UID on the server.'
            : 'Could not verify Admin access. Check the server and ADMIN_UID configuration.';
        auth.signOut().catch(() => {});
    });
});

// Failsafe: do not leave the loader stuck if the server is unreachable.
setTimeout(() => {
    const loader = document.getElementById('global-loader');
    if (loader && loader.style.display !== 'none') loader.style.display = 'none';
}, 10000);

document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    // লগইন করার সময় লোডার দেখানো
    document.getElementById('global-loader').style.display = 'flex';
    auth.signInWithEmailAndPassword(email, password).catch(err => {
        document.getElementById('global-loader').style.display = 'none';
        authErrorEl.textContent = err.message;
    });
});

document.getElementById('admin-logout-sidebar-btn').addEventListener('click', () => {
    localStorage.removeItem('movex_admin_cache');
    auth.signOut().then(() => window.location.reload());
});
