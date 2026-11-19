
function initAdminPanel() {
    // The address bar decides which page opens (/admin/users, /admin/movies/<id>/edit ...); unknown paths go to the dashboard
    adminApplyRoute(adminParse(window.location.pathname), false);

    updateDashboard();
    initEditableSocials();
    initEditableNotifications();
    initUserManagement(); // new
    startUpcomingChecker();
    initLinkDetector(); // Auto link detector চালু করা হলো
    // Initially hide edit panels
    editPanel.classList.add('hidden');
    document.getElementById('user-edit-panel').classList.add('hidden');
}
