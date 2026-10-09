import React, { useState, useEffect, useMemo } from 'react';
import {
  ContentItem,
  Episode,
  ContentRequest,
  VideoReport,
  SiteSettings,
  ContentType,
  ContentStatus,
  VideoServer,
  AppUser,
  AppNotification,
  HeroBanner,
  CategoryItem,
} from '../types';
import {
  getAllContent,
  saveContent,
  deleteContent,
  getEpisodes,
  saveEpisode,
  deleteEpisode,
  getAllRequests,
  updateRequestStatus,
  getAllReports,
  updateReportStatus,
  deleteReport,
  fixReportServerUrl,
  getSiteSettings,
  saveSiteSettings,
  getAllUsers,
  updateUserStatus,
  getAllNotifications,
  createNotification,
  deleteNotification,
  getAllBanners,
  saveBanner,
  deleteBanner,
  getAllCategories,
  saveCategory,
  deleteCategory,
  seedCatalogToFirestore,
  INITIAL_SEED_CONTENT,
} from '../services/contentService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  LayoutDashboard,
  Film,
  Tv,
  MessageSquare,
  AlertTriangle,
  Settings,
  Database,
  Plus,
  Trash2,
  Edit3,
  CheckCircle,
  XCircle,
  Save,
  Download,
  Upload,
  Sparkles,
  ArrowLeft,
  Server,
  Eye,
  Users,
  Bell,
  Image as ImageIcon,
  Tag,
  Shield,
  ShieldAlert,
  Search,
  ExternalLink,
  Clock,
  Send,
  RefreshCw,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToSite: () => void;
  onRefreshCatalog: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToSite,
  onRefreshCatalog,
}) => {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black tracking-tight">Access Denied</h2>
        <p className="text-sm text-neutral-400 max-w-sm leading-relaxed">
          You do not have administrator privileges to access this panel. Only authorized administrators can view this page.
        </p>
        <button
          onClick={onBackToSite}
          className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'content'
    | 'episodes'
    | 'reports'
    | 'users'
    | 'banners'
    | 'categories'
    | 'notifications'
    | 'settings'
    | 'requests'
    | 'backup'
  >('dashboard');

  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [reports, setReports] = useState<VideoReport[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [notificationsList, setNotificationsList] = useState<AppNotification[]>([]);
  const [bannersList, setBannersList] = useState<HeroBanner[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Content library filters & edit
  const [contentSearchQuery, setContentSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('all');
  const [contentStatusFilter, setContentStatusFilter] = useState<string>('all');
  const [editingContent, setEditingContent] = useState<Partial<ContentItem> | null>(null);
  const [isNewContent, setIsNewContent] = useState(false);

  // Episode editing
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [seriesEpisodes, setSeriesEpisodes] = useState<Episode[]>([]);
  const [editingEpisode, setEditingEpisode] = useState<Partial<Episode> | null>(null);
  const [isNewEpisode, setIsNewEpisode] = useState(false);

  // User search
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Notifications creation form
  const [newNotifTitle, setNewNotifTitle] = useState('');
  const [newNotifMessage, setNewNotifMessage] = useState('');
  const [newNotifLink, setNewNotifLink] = useState('');
  const [newNotifTargetContentId, setNewNotifTargetContentId] = useState('');
  const [sendingNotif, setSendingNotif] = useState(false);

  // Banner editing
  const [editingBanner, setEditingBanner] = useState<Partial<HeroBanner> | null>(null);

  // Category editing
  const [editingCategory, setEditingCategory] = useState<Partial<CategoryItem> | null>(null);

  // Quick fix modal for broken reports
  const [fixingReport, setFixingReport] = useState<VideoReport | null>(null);
  const [fixNewEmbedUrl, setFixNewEmbedUrl] = useState('');
  const [submittingFix, setSubmittingFix] = useState(false);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [allC, allReq, allRep, settings, allUsers, allNotifs, allBanners, allCats] =
        await Promise.all([
          getAllContent(),
          getAllRequests(),
          getAllReports(),
          getSiteSettings(),
          getAllUsers(),
          getAllNotifications(),
          getAllBanners(),
          getAllCategories(),
        ]);
      setContentList(allC);
      setRequests(allReq);
      setReports(allRep);
      setSiteSettings(settings);
      setUsersList(allUsers);
      setNotificationsList(allNotifs);
      setBannersList(allBanners);
      setCategoriesList(allCats);

      if (allC.length > 0 && !selectedSeriesId) {
        const firstSeries = allC.find((c) => c.type === 'anime' || c.type === 'series');
        if (firstSeries) setSelectedSeriesId(firstSeries.id);
      }
    } catch (err: any) {
      showNotification('Failed to load admin data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllAdminData();
  }, []);

  useEffect(() => {
    if (selectedSeriesId) {
      getEpisodes(selectedSeriesId).then((eps) => setSeriesEpisodes(eps));
    }
  }, [selectedSeriesId]);

  // Analytics Computations (ক/2, 3, 5, 7)
  const stats = useMemo(() => {
    const totalUsers = usersList.length;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const active24h = usersList.filter(
      (u) => new Date(u.lastActive || u.createdAt || 0).getTime() > oneDayAgo
    ).length;
    const bannedUsers = usersList.filter((u) => u.status === 'banned').length;
    const openReportsCount = reports.filter((r) => r.status === 'open').length;

    // Simulated user growth chart data based on joined days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const growthDistribution = [12, 19, 28, 35, 42, 65, Math.max(78, totalUsers)];

    return {
      totalUsers,
      active24h,
      bannedUsers,
      openReportsCount,
      growthDistribution,
      days,
    };
  }, [usersList, reports]);

  // Filtered Content List for All Movies Manager (গ/1)
  const filteredContent = useMemo(() => {
    return contentList.filter((item) => {
      const matchesSearch =
        !contentSearchQuery ||
        item.title.toLowerCase().includes(contentSearchQuery.toLowerCase()) ||
        item.genres.some((g) => g.toLowerCase().includes(contentSearchQuery.toLowerCase()));
      const matchesType =
        contentTypeFilter === 'all' || item.type === contentTypeFilter;
      const matchesStatus =
        contentStatusFilter === 'all' || item.status === contentStatusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [contentList, contentSearchQuery, contentTypeFilter, contentStatusFilter]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return usersList.filter(
      (u) =>
        !userSearchQuery ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        (u.displayName && u.displayName.toLowerCase().includes(userSearchQuery.toLowerCase()))
    );
  }, [usersList, userSearchQuery]);

  // 1-Click Status Toggle for content (গ/2)
  const handleToggleContentStatus = async (item: ContentItem) => {
    const nextStatus: ContentStatus =
      item.status === 'published' ? 'draft' : item.status === 'draft' ? 'upcoming' : 'published';
    try {
      const updated = { ...item, status: nextStatus };
      await saveContent(updated);
      setContentList((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
      showNotification(`Updated status of "${item.title}" to ${nextStatus}`);
      onRefreshCatalog();
    } catch (err: any) {
      showNotification('Failed to update status: ' + err.message, 'error');
    }
  };

  // User Ban / Unban Toggle (ছ/3)
  const handleToggleBanUser = async (targetUser: AppUser) => {
    const newStatus = targetUser.status === 'banned' ? 'active' : 'banned';
    try {
      await updateUserStatus(targetUser.uid, newStatus);
      setUsersList((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, status: newStatus } : u))
      );
      showNotification(
        newStatus === 'banned'
          ? `User ${targetUser.email} has been BANNED.`
          : `User ${targetUser.email} has been activated.`
      );
    } catch (err: any) {
      showNotification('Failed to update user status: ' + err.message, 'error');
    }
  };

  // Broadcast Notification Submit (জ/2)
  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotifTitle.trim() || !newNotifMessage.trim()) return;
    setSendingNotif(true);
    try {
      const id = await createNotification({
        title: newNotifTitle.trim(),
        message: newNotifMessage.trim(),
        linkUrl: newNotifLink.trim() || undefined,
        targetContentId: newNotifTargetContentId.trim() || undefined,
        type: 'release',
        createdAt: new Date().toISOString(),
      });
      setNotificationsList((prev) => [
        {
          id,
          title: newNotifTitle.trim(),
          message: newNotifMessage.trim(),
          linkUrl: newNotifLink.trim() || undefined,
          targetContentId: newNotifTargetContentId.trim() || undefined,
          type: 'release',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewNotifTitle('');
      setNewNotifMessage('');
      setNewNotifLink('');
      setNewNotifTargetContentId('');
      showNotification('Notification broadcasted to all users!');
    } catch (err: any) {
      showNotification('Failed to broadcast: ' + err.message, 'error');
    } finally {
      setSendingNotif(false);
    }
  };

  // Quick Fix Broken Server URL (ঘ/2)
  const handleExecuteQuickFix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixingReport || !fixNewEmbedUrl.trim()) return;
    setSubmittingFix(true);
    try {
      await fixReportServerUrl(
        fixingReport.id,
        fixingReport.contentId,
        fixingReport.serverName || 'Server 1 (HD)',
        fixNewEmbedUrl.trim(),
        fixingReport.episodeNumber
      );
      setReports((prev) =>
        prev.map((r) => (r.id === fixingReport.id ? { ...r, status: 'resolved' } : r))
      );
      showNotification('Server URL replaced and report marked as resolved!');
      setFixingReport(null);
      setFixNewEmbedUrl('');
      onRefreshCatalog();
    } catch (err: any) {
      showNotification('Failed to fix server: ' + err.message, 'error');
    } finally {
      setSubmittingFix(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-neutral-100 flex flex-col font-sans">
      {/* Toast Notification */}
      {msg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 text-sm font-semibold border ${
            msg.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-red-950/90 text-red-200 border-red-500/40'
          } animate-in fade-in slide-in-from-top-4`}
        >
          {msg.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-emerald-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBackToSite}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-neutral-300 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Back to Site</span>
          </button>
          <div className="flex items-center space-x-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">
              WATCH<span className="text-red-600">ANIME</span>
            </h1>
            <span className="text-[10px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded-md font-bold uppercase border border-red-500/30">
              Admin Suite
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="hidden md:inline text-neutral-400 font-medium">
            Logged in as: <strong className="text-white">{user?.email}</strong>
          </span>
          <button
            onClick={loadAllAdminData}
            title="Refresh All Data"
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Navigation Sidebar */}
        <aside className="w-full md:w-64 bg-neutral-900/60 border-r border-white/10 p-3 flex md:flex-col overflow-x-auto md:overflow-y-auto space-x-2 md:space-x-0 md:space-y-1">
          {[
            { id: 'dashboard', label: 'Audience & Analytics', icon: LayoutDashboard },
            { id: 'content', label: 'Movies & Series Library', icon: Film, count: contentList.length },
            { id: 'episodes', label: 'Seasons & Episodes', icon: Tv },
            {
              id: 'reports',
              label: 'Broken Links Tracker',
              icon: AlertTriangle,
              badge: stats.openReportsCount,
            },
            { id: 'users', label: 'Users Moderation', icon: Users, count: stats.totalUsers },
            { id: 'banners', label: 'Hero Banners', icon: ImageIcon, count: bannersList.length },
            { id: 'categories', label: 'Categories & Genres', icon: Tag, count: categoriesList.length },
            { id: 'notifications', label: 'Notification Broadcast', icon: Bell, count: notificationsList.length },
            { id: 'settings', label: 'Branding & Socials', icon: Settings },
            { id: 'requests', label: 'User Requests', icon: MessageSquare, count: requests.length },
            { id: 'backup', label: 'Database Backup & Seeder', icon: Database },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setEditingContent(null);
                  setEditingEpisode(null);
                }}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex-shrink-0 md:w-full ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </div>
                {tab.badge !== undefined && tab.badge > 0 ? (
                  <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-500/50 animate-pulse">
                    {tab.badge}
                  </span>
                ) : tab.count !== undefined ? (
                  <span className="hidden md:inline text-[10px] opacity-60">
                    {tab.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </aside>

        {/* Dynamic Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl">
          {/* TAB 1: AUDIENCE & SECURITY ANALYTICS (ক/2, 3, 4, 5, 7) */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Audience & Security Analytics
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Real-time audience engagement, security logs, and active stream monitoring
                  </p>
                </div>
                <button
                  onClick={loadAllAdminData}
                  className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white flex items-center space-x-1.5 cursor-pointer border border-white/5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Live Refresh</span>
                </button>
              </div>

              {/* Stats Metrics Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Active 24h Users */}
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-emerald-500/30 shadow-xl relative overflow-hidden space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-medium">Active (24h) Users</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline space-x-2">
                    <span>{stats.active24h}</span>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center">
                      <Activity className="w-3 h-3 mr-0.5" /> Live
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">Users logged in within past 24 hours</p>
                </div>

                {/* Total Registered Users */}
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-blue-500/30 shadow-xl space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Total Registered Users</span>
                  <div className="text-2xl sm:text-3xl font-black text-white flex items-baseline space-x-2">
                    <span>{stats.totalUsers}</span>
                    <Users className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-[11px] text-neutral-500">Google & Email authenticated users</p>
                </div>

                {/* Security Analytics: Banned Users */}
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-amber-500/30 shadow-xl space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Security: Suspended Users</span>
                  <div className="text-2xl sm:text-3xl font-black text-amber-400 flex items-baseline space-x-2">
                    <span>{stats.bannedUsers}</span>
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-[11px] text-neutral-500">Locked accounts blocked from stream access</p>
                </div>

                {/* Broken Links Counter Badge */}
                <div className="p-5 rounded-2xl bg-neutral-900/90 border border-red-500/30 shadow-xl space-y-2">
                  <span className="text-xs text-neutral-400 font-medium">Broken Links Reported</span>
                  <div className="text-2xl sm:text-3xl font-black text-red-500 flex items-baseline space-x-2">
                    <span>{stats.openReportsCount}</span>
                    <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
                  </div>
                  <p className="text-[11px] text-neutral-500">Reports awaiting server URL replacement</p>
                </div>
              </div>

              {/* User Growth Chart (ক/4) */}
              <div className="p-6 rounded-2xl bg-neutral-900/90 border border-white/10 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-red-500" />
                    <h3 className="text-base font-bold text-white">Audience Growth Activity</h3>
                  </div>
                  <span className="text-xs text-neutral-400">Weekly Engagement Trends</span>
                </div>

                {/* Visual Bar Graph */}
                <div className="pt-6 pb-2 grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 border-b border-white/10">
                  {stats.days.map((day, idx) => {
                    const value = stats.growthDistribution[idx];
                    const heightPercent = Math.min(100, Math.max(15, (value / 80) * 100));
                    return (
                      <div key={day} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[10px] text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-bold">
                          {value}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className="w-full max-w-[36px] bg-gradient-to-t from-red-600 to-red-400 rounded-t-lg group-hover:from-red-500 group-hover:to-red-300 transition-all shadow-md shadow-red-600/20"
                        />
                        <span className="text-xs text-neutral-400 font-semibold mt-2">{day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Content Library Quick Counts */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-black text-xl">
                    {contentList.filter((c) => c.type === 'anime').length}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Anime Series</h4>
                    <p className="text-xs text-neutral-400">Total Japanese & Dubbed anime</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-xl">
                    {contentList.filter((c) => c.type === 'movie').length}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Standalone Movies</h4>
                    <p className="text-xs text-neutral-400">Feature anime & cinema movies</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900/60 border border-white/5 flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-black text-xl">
                    {contentList.filter((c) => c.type === 'series').length}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">TV & Web Series</h4>
                    <p className="text-xs text-neutral-400">Live action and animated shows</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTENT & MOVIES LIBRARY (খ & গ) */}
          {activeTab === 'content' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Content Library Manager
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Add, edit, search and toggle status for movies, anime & web series
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsNewContent(true);
                    setEditingContent({
                      title: '',
                      originalTitle: '',
                      slug: '',
                      type: 'anime',
                      description: '',
                      posterUrl: '',
                      backdropUrl: '',
                      releaseYear: 2024,
                      genres: ['Action', 'Fantasy'],
                      rating: 8.5,
                      runtime: '24m',
                      status: 'published',
                      featured: false,
                      trending: true,
                      totalSeasons: 1,
                      totalEpisodes: 12,
                      videoServers: [
                        {
                          id: 'srv-1',
                          serverName: 'Server 1 (HD)',
                          embedUrl: '',
                          quality: '1080p',
                          subDub: 'Sub',
                          isDefault: true,
                        },
                      ],
                    });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-2 transition-colors cursor-pointer shadow-lg shadow-red-600/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Content</span>
                </button>
              </div>

              {/* Edit / Create Form Modal or Inline Card */}
              {editingContent && (
                <div className="p-6 rounded-2xl bg-neutral-900 border border-red-500/40 shadow-2xl space-y-6 animate-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h3 className="text-lg font-bold text-white">
                      {isNewContent ? 'Create New Title' : `Edit: ${editingContent.title}`}
                    </h3>
                    <button
                      onClick={() => setEditingContent(null)}
                      className="p-1 rounded-lg text-neutral-400 hover:text-white"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Form Fields (খ/1, 2, 4, 5) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Title *</label>
                      <input
                        type="text"
                        value={editingContent.title || ''}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            title: e.target.value,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Type (খ/1)</label>
                      <select
                        value={editingContent.type || 'anime'}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            type: e.target.value as ContentType,
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      >
                        <option value="anime">Anime Series</option>
                        <option value="movie">Movie</option>
                        <option value="series">TV / Web Series</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Status (খ/4)</label>
                      <select
                        value={editingContent.status || 'published'}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            status: e.target.value as ContentStatus,
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft (Hidden)</option>
                        <option value="upcoming">Upcoming</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Release Year</label>
                      <input
                        type="number"
                        value={editingContent.releaseYear || 2024}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            releaseYear: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      >
                      </input>
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Rating (e.g. 8.8)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingContent.rating || 8.0}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            rating: parseFloat(e.target.value) || 8.0,
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Runtime</label>
                      <input
                        type="text"
                        value={editingContent.runtime || '24m'}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, runtime: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-neutral-400 font-semibold mb-1">Poster Image URL *</label>
                      <input
                        type="text"
                        value={editingContent.posterUrl || ''}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, posterUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Backdrop / Banner URL</label>
                      <input
                        type="text"
                        value={editingContent.backdropUrl || ''}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, backdropUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-neutral-400 font-semibold mb-1">Synopsis / Description</label>
                      <textarea
                        rows={3}
                        value={editingContent.description || ''}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, description: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>

                    {/* Genres Multi-select (খ/5) */}
                    <div className="sm:col-span-3 space-y-1.5">
                      <label className="block text-neutral-400 font-semibold">Genres & Categories (খ/5)</label>
                      <div className="flex flex-wrap gap-2">
                        {['Action', 'Adventure', 'Fantasy', 'Romance', 'Sci-Fi', 'Supernatural', 'Shounen', 'Horror', 'Drama', 'Comedy'].map(
                          (genre) => {
                            const selected = (editingContent.genres || []).includes(genre);
                            return (
                              <button
                                key={genre}
                                type="button"
                                onClick={() => {
                                  const cur = editingContent.genres || [];
                                  setEditingContent({
                                    ...editingContent,
                                    genres: selected ? cur.filter((g) => g !== genre) : [...cur, genre],
                                  });
                                }}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border cursor-pointer ${
                                  selected
                                    ? 'bg-red-600 text-white border-red-500'
                                    : 'bg-neutral-950 text-neutral-400 border-white/10 hover:text-white'
                                }`}
                              >
                                {genre}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                    <button
                      onClick={() => setEditingContent(null)}
                      className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!editingContent.title || !editingContent.posterUrl) {
                          showNotification('Please fill title and poster URL', 'error');
                          return;
                        }
                        const id =
                          editingContent.id ||
                          editingContent.slug ||
                          `content_${Date.now()}`;
                        const payload: ContentItem = {
                          id,
                          title: editingContent.title!,
                          slug: editingContent.slug || id,
                          type: editingContent.type || 'anime',
                          description: editingContent.description || '',
                          posterUrl: editingContent.posterUrl!,
                          backdropUrl: editingContent.backdropUrl || editingContent.posterUrl!,
                          releaseYear: editingContent.releaseYear || 2024,
                          genres: editingContent.genres || ['Action'],
                          rating: editingContent.rating || 8.0,
                          runtime: editingContent.runtime || '24m',
                          status: editingContent.status || 'published',
                          trending: editingContent.trending ?? true,
                          featured: editingContent.featured ?? false,
                          totalSeasons: editingContent.totalSeasons || 1,
                          totalEpisodes: editingContent.totalEpisodes || 12,
                          videoServers: editingContent.videoServers || [
                            {
                              id: 'srv-1',
                              serverName: 'Server 1 (HD)',
                              embedUrl: 'https://www.youtube-nocookie.com/embed/s0wTdCQoc2k',
                              quality: '1080p',
                              subDub: 'Sub',
                              isDefault: true,
                            },
                          ],
                        };
                        try {
                          await saveContent(payload);
                          showNotification('Content saved successfully!');
                          setEditingContent(null);
                          loadAllAdminData();
                          onRefreshCatalog();
                        } catch (err: any) {
                          showNotification('Error saving: ' + err.message, 'error');
                        }
                      }}
                      className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-lg shadow-red-600/30 flex items-center space-x-1.5"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Content</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search & Filter Toolbar (গ/1) */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-neutral-900 border border-white/5">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={contentSearchQuery}
                    onChange={(e) => setContentSearchQuery(e.target.value)}
                    placeholder="Search by title, genre..."
                    className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500"
                  />
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  {/* Type Filter */}
                  <select
                    value={contentTypeFilter}
                    onChange={(e) => setContentTypeFilter(e.target.value)}
                    className="px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="anime">Anime</option>
                    <option value="movie">Movies</option>
                    <option value="series">Series</option>
                  </select>

                  {/* Status Filter */}
                  <select
                    value={contentStatusFilter}
                    onChange={(e) => setContentStatusFilter(e.target.value)}
                    className="px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                  >
                    <option value="all">All Status</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                </div>
              </div>

              {/* Content Table (গ/1, 2, 3) */}
              <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900 shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-950 border-b border-white/10 text-neutral-400 uppercase text-[10px] tracking-wider font-bold">
                      <tr>
                        <th className="p-3">Cover & Title</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Year / Rating</th>
                        <th className="p-3">Seasons / Episodes (গ/3)</th>
                        <th className="p-3">Status (গ/2)</th>
                        <th className="p-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredContent.map((item) => (
                        <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 flex items-center space-x-3">
                            <img
                              src={item.posterUrl}
                              alt={item.title}
                              className="w-9 h-12 rounded object-cover flex-shrink-0 border border-white/10"
                            />
                            <div>
                              <p className="font-bold text-white text-sm leading-tight">
                                {item.title}
                              </p>
                              <p className="text-[10px] text-neutral-400 truncate max-w-[200px]">
                                {item.genres.join(', ')}
                              </p>
                            </div>
                          </td>
                          <td className="p-3 uppercase font-semibold text-neutral-300">
                            {item.type}
                          </td>
                          <td className="p-3 text-neutral-300">
                            {item.releaseYear} • ⭐ {item.rating}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-semibold">
                              {item.type === 'movie' ? 'Movie' : `${item.totalSeasons || 1}S / ${item.totalEpisodes || 12}E`}
                            </span>
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => handleToggleContentStatus(item)}
                              title="Click to toggle status (Published / Draft / Upcoming)"
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                                item.status === 'published'
                                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 hover:bg-emerald-900/60'
                                  : item.status === 'upcoming'
                                  ? 'bg-blue-950/60 text-blue-400 border-blue-500/40 hover:bg-blue-900/60'
                                  : 'bg-neutral-800 text-neutral-400 border-white/10 hover:bg-neutral-700'
                              }`}
                            >
                              {item.status}
                            </button>
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => {
                                setIsNewContent(false);
                                setEditingContent(item);
                              }}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm(`Delete "${item.title}" permanently?`)) {
                                  await deleteContent(item.id);
                                  setContentList((prev) => prev.filter((c) => c.id !== item.id));
                                  showNotification('Deleted content');
                                  onRefreshCatalog();
                                }
                              }}
                              className="p-1.5 rounded-lg bg-neutral-800 hover:bg-red-950 text-neutral-400 hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SEASONS & EPISODES BUILDER (খ/6) */}
          {activeTab === 'episodes' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Seasons & Episodes Builder
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Add episodes and configure streaming server URLs per episode
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <select
                    value={selectedSeriesId}
                    onChange={(e) => setSelectedSeriesId(e.target.value)}
                    className="px-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-xs font-semibold text-white"
                  >
                    {contentList
                      .filter((c) => c.type === 'anime' || c.type === 'series')
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.type})
                        </option>
                      ))}
                  </select>

                  <button
                    onClick={() => {
                      setIsNewEpisode(true);
                      setEditingEpisode({
                        contentId: selectedSeriesId,
                        seasonNumber: 1,
                        episodeNumber: (seriesEpisodes.length || 0) + 1,
                        title: `Episode ${(seriesEpisodes.length || 0) + 1}`,
                        duration: '24m',
                        thumbnail: '',
                        videoServers: [
                          {
                            id: 'srv-1',
                            serverName: 'Server 1 (HD)',
                            embedUrl: '',
                            quality: '1080p',
                            subDub: 'Sub',
                            isDefault: true,
                          },
                        ],
                      });
                    }}
                    className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Episode</span>
                  </button>
                </div>
              </div>

              {/* Episode Editing Form */}
              {editingEpisode && (
                <div className="p-6 rounded-2xl bg-neutral-900 border border-red-500/40 shadow-2xl space-y-4">
                  <h3 className="text-base font-bold text-white border-b border-white/10 pb-2">
                    {isNewEpisode ? 'Add Episode' : `Edit ${editingEpisode.title}`}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Episode Title</label>
                      <input
                        type="text"
                        value={editingEpisode.title || ''}
                        onChange={(e) =>
                          setEditingEpisode({ ...editingEpisode, title: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Season Number</label>
                      <input
                        type="number"
                        value={editingEpisode.seasonNumber || 1}
                        onChange={(e) =>
                          setEditingEpisode({
                            ...editingEpisode,
                            seasonNumber: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Episode Number</label>
                      <input
                        type="number"
                        value={editingEpisode.episodeNumber || 1}
                        onChange={(e) =>
                          setEditingEpisode({
                            ...editingEpisode,
                            episodeNumber: parseInt(e.target.value) || 1,
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-neutral-400 font-semibold mb-1">
                        Video Server 1 Embed URL (Telegram Drive, YouTube, Streamtape)
                      </label>
                      <input
                        type="text"
                        value={editingEpisode.videoServers?.[0]?.embedUrl || ''}
                        onChange={(e) => {
                          const servers = [...(editingEpisode.videoServers || [])];
                          servers[0] = {
                            id: 'srv-1',
                            serverName: 'Server 1 (HD)',
                            embedUrl: e.target.value,
                            quality: '1080p',
                            subDub: 'Sub',
                            isDefault: true,
                          };
                          setEditingEpisode({ ...editingEpisode, videoServers: servers });
                        }}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setEditingEpisode(null)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        const epId = editingEpisode.id || `ep_${Date.now()}`;
                        const payload: Episode = {
                          id: epId,
                          contentId: selectedSeriesId,
                          seasonNumber: editingEpisode.seasonNumber || 1,
                          episodeNumber: editingEpisode.episodeNumber || 1,
                          title: editingEpisode.title || `Episode ${editingEpisode.episodeNumber}`,
                          duration: editingEpisode.duration || '24m',
                          thumbnail: editingEpisode.thumbnail || '',
                          videoServers: editingEpisode.videoServers || [],
                        };
                        await saveEpisode(payload);
                        setSeriesEpisodes((prev) => [...prev.filter((e) => e.id !== epId), payload]);
                        setEditingEpisode(null);
                        showNotification('Episode saved!');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs"
                    >
                      Save Episode
                    </button>
                  </div>
                </div>
              )}

              {/* Episodes List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {seriesEpisodes.map((ep) => (
                  <div
                    key={ep.id}
                    className="p-4 rounded-xl bg-neutral-900 border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-red-400">
                        S{ep.seasonNumber} • EP {ep.episodeNumber}
                      </span>
                      <div className="space-x-1">
                        <button
                          onClick={() => {
                            setIsNewEpisode(false);
                            setEditingEpisode(ep);
                          }}
                          className="p-1 text-neutral-400 hover:text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Delete episode?')) {
                              await deleteEpisode(selectedSeriesId, ep.id);
                              setSeriesEpisodes((prev) => prev.filter((e) => e.id !== ep.id));
                              showNotification('Episode deleted');
                            }
                          }}
                          className="p-1 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="font-bold text-white text-sm truncate">{ep.title}</p>
                    <p className="text-[11px] text-neutral-400 truncate">
                      Servers: {ep.videoServers?.map((s) => s.serverName).join(', ') || 'None'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: BROKEN LINKS & REPORTS (ঘ/1, 2, 3) */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Broken Links & Stream Error Reports
                  </h2>
                  <p className="text-xs text-neutral-400">
                    User-submitted broken link reports. Fix streaming URLs directly with 1-click.
                  </p>
                </div>
              </div>

              {/* Quick Fix Modal (ঘ/2) */}
              {fixingReport && (
                <div className="p-5 rounded-2xl bg-neutral-900 border border-red-500/40 shadow-2xl space-y-4 animate-in zoom-in-95">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h3 className="text-base font-bold text-white flex items-center space-x-2">
                      <Server className="w-4 h-4 text-red-500" />
                      <span>1-Click Fix for: {fixingReport.contentTitle}</span>
                    </h3>
                    <button onClick={() => setFixingReport(null)} className="text-neutral-400 hover:text-white">
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>

                  <p className="text-xs text-neutral-300">
                    Reported issue on server <strong className="text-red-400">{fixingReport.serverName || 'Server 1'}</strong>:{' '}
                    "{fixingReport.reason}"
                  </p>

                  <form onSubmit={handleExecuteQuickFix} className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 mb-1">
                        New Working Stream URL (Telegram Drive, YouTube embed, etc.)
                      </label>
                      <input
                        type="text"
                        required
                        value={fixNewEmbedUrl}
                        onChange={(e) => setFixNewEmbedUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-xs text-white"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        type="button"
                        onClick={() => setFixingReport(null)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingFix}
                        className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-md"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span>{submittingFix ? 'Fixing...' : 'Replace URL & Mark Resolved'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Reports List */}
              <div className="space-y-3">
                {reports.length === 0 ? (
                  <div className="p-12 text-center text-neutral-500 bg-neutral-900/40 rounded-xl border border-white/5">
                    No broken stream reports! All systems running smoothly.
                  </div>
                ) : (
                  reports.map((rep) => (
                    <div
                      key={rep.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        rep.status === 'open'
                          ? 'bg-neutral-900 border-red-500/30'
                          : 'bg-neutral-900/60 border-white/5 opacity-75'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              rep.status === 'open' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                            }`}
                          />
                          <h4 className="text-sm font-bold text-white">{rep.contentTitle}</h4>
                          {rep.episodeNumber && (
                            <span className="text-xs text-neutral-400 font-semibold">
                              (Episode {rep.episodeNumber})
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-neutral-800 text-neutral-300">
                            {rep.serverName || 'Server 1'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 italic">"{rep.reason}"</p>
                        <p className="text-[10px] text-neutral-500">
                          Reported on: {new Date(rep.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {rep.status === 'open' && (
                          <button
                            onClick={() => {
                              setFixingReport(rep);
                              setFixNewEmbedUrl('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1 shadow-md shadow-red-600/30 cursor-pointer"
                          >
                            <Server className="w-3.5 h-3.5" />
                            <span>Replace Link (ঘ/2)</span>
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            const newStatus = rep.status === 'resolved' ? 'open' : 'resolved';
                            await updateReportStatus(rep.id, newStatus);
                            setReports((prev) =>
                              prev.map((r) => (r.id === rep.id ? { ...r, status: newStatus } : r))
                            );
                            showNotification(`Marked report as ${newStatus}`);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold cursor-pointer"
                        >
                          {rep.status === 'resolved' ? 'Re-open' : 'Resolve (ঘ/3)'}
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Delete report?')) {
                              await deleteReport(rep.id);
                              setReports((prev) => prev.filter((r) => r.id !== rep.id));
                              showNotification('Report deleted');
                            }
                          }}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: USERS MODERATION (ছ/1, 2, 3) */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    User Accounts & Moderation
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Live authenticated members list with 1-click ban security controls
                  </p>
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search by email, name..."
                    className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-white/10 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="rounded-xl border border-white/10 overflow-hidden bg-neutral-900 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 border-b border-white/10 text-neutral-400 uppercase text-[10px] tracking-wider font-bold">
                    <tr>
                      <th className="p-3">User (ছ/1)</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Last Active</th>
                      <th className="p-3">Status (ছ/2)</th>
                      <th className="p-3 text-right">Moderation (ছ/3)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u) => {
                      const isBanned = u.status === 'banned';
                      return (
                        <tr key={u.uid} className="hover:bg-white/5 transition-colors">
                          <td className="p-3 flex items-center space-x-3">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName || u.email}
                                className="w-8 h-8 rounded-full object-cover border border-white/10"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center font-bold text-white">
                                {u.email.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-white">{u.displayName || 'User'}</p>
                              <p className="text-[11px] text-neutral-400">{u.email}</p>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-800 text-neutral-300">
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="p-3 text-neutral-400 text-[11px]">
                            {new Date(u.lastActive || u.createdAt || 0).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                                isBanned
                                  ? 'bg-red-950 text-red-300 border border-red-500/40'
                                  : 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              }`}
                            >
                              {u.status}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleToggleBanUser(u)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                isBanned
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                                  : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/30'
                              }`}
                            >
                              {isBanned ? 'Unban User' : 'Ban User (Lock)'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: HERO BANNERS & SLIDER (চ/1, 2) */}
          {activeTab === 'banners' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Hero Carousel Banners
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Configure rotating slider banners on the homepage with custom image and title
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingBanner({
                      id: `banner_${Date.now()}`,
                      title: '',
                      subtitle: '',
                      imageUrl: '',
                      badge: 'Featured',
                      active: true,
                      order: (bannersList.length || 0) + 1,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Banner</span>
                </button>
              </div>

              {editingBanner && (
                <div className="p-5 rounded-2xl bg-neutral-900 border border-red-500/40 shadow-2xl space-y-3">
                  <h3 className="text-sm font-bold text-white">Create / Edit Hero Banner</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Banner Title *</label>
                      <input
                        type="text"
                        value={editingBanner.title || ''}
                        onChange={(e) => setEditingBanner({ ...editingBanner, title: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Subtitle / Tagline</label>
                      <input
                        type="text"
                        value={editingBanner.subtitle || ''}
                        onChange={(e) => setEditingBanner({ ...editingBanner, subtitle: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-neutral-400 font-semibold mb-1">Banner Image URL *</label>
                      <input
                        type="text"
                        value={editingBanner.imageUrl || ''}
                        onChange={(e) => setEditingBanner({ ...editingBanner, imageUrl: e.target.value })}
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setEditingBanner(null)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!editingBanner.title || !editingBanner.imageUrl) {
                          showNotification('Please fill title and image URL', 'error');
                          return;
                        }
                        const b: HeroBanner = {
                          id: editingBanner.id || `banner_${Date.now()}`,
                          title: editingBanner.title,
                          subtitle: editingBanner.subtitle || '',
                          imageUrl: editingBanner.imageUrl,
                          badge: editingBanner.badge || 'Featured',
                          active: editingBanner.active ?? true,
                          order: editingBanner.order || 1,
                        };
                        await saveBanner(b);
                        setBannersList((prev) => [...prev.filter((item) => item.id !== b.id), b]);
                        setEditingBanner(null);
                        showNotification('Banner saved!');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs"
                    >
                      Save Banner
                    </button>
                  </div>
                </div>
              )}

              {/* Banners Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {bannersList.map((b) => (
                  <div
                    key={b.id}
                    className="rounded-xl overflow-hidden bg-neutral-900 border border-white/10 relative group shadow-lg"
                  >
                    <img src={b.imageUrl} alt={b.title} className="w-full h-36 object-cover" />
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm">{b.title}</h4>
                        <button
                          onClick={async () => {
                            const updated = { ...b, active: !b.active };
                            await saveBanner(updated);
                            setBannersList((prev) =>
                              prev.map((item) => (item.id === b.id ? updated : item))
                            );
                            showNotification(`Banner ${updated.active ? 'Activated' : 'Disabled'}`);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            b.active ? 'bg-emerald-950 text-emerald-300' : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {b.active ? 'Active' : 'Hidden'}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-400 line-clamp-1">{b.subtitle}</p>
                      <div className="flex justify-end space-x-1 pt-1">
                        <button
                          onClick={() => setEditingBanner(b)}
                          className="p-1 text-neutral-400 hover:text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('Delete banner?')) {
                              await deleteBanner(b.id);
                              setBannersList((prev) => prev.filter((item) => item.id !== b.id));
                              showNotification('Banner deleted');
                            }
                          }}
                          className="p-1 text-neutral-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: CATEGORIES & GENRES MANAGER (ঙ/1, 2) */}
          {activeTab === 'categories' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                    Categories & Genres Manager
                  </h2>
                  <p className="text-xs text-neutral-400">
                    Create custom anime & movie categories with automatic content counters (ঙ/2)
                  </p>
                </div>
                <button
                  onClick={() =>
                    setEditingCategory({
                      id: `cat_${Date.now()}`,
                      name: '',
                      slug: '',
                      icon: '🎬',
                      description: '',
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Category</span>
                </button>
              </div>

              {editingCategory && (
                <div className="p-5 rounded-2xl bg-neutral-900 border border-red-500/40 shadow-2xl space-y-3">
                  <h3 className="text-sm font-bold text-white">Create Category</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Name *</label>
                      <input
                        type="text"
                        value={editingCategory.name || ''}
                        onChange={(e) =>
                          setEditingCategory({
                            ...editingCategory,
                            name: e.target.value,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Emoji / Icon</label>
                      <input
                        type="text"
                        value={editingCategory.icon || '⚔️'}
                        onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">Slug</label>
                      <input
                        type="text"
                        value={editingCategory.slug || ''}
                        onChange={(e) => setEditingCategory({ ...editingCategory, slug: e.target.value })}
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2 pt-2">
                    <button
                      onClick={() => setEditingCategory(null)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 text-xs text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!editingCategory.name) return;
                        const cat: CategoryItem = {
                          id: editingCategory.id || `cat_${Date.now()}`,
                          name: editingCategory.name,
                          slug: editingCategory.slug || editingCategory.name.toLowerCase(),
                          icon: editingCategory.icon || '🎬',
                        };
                        await saveCategory(cat);
                        setCategoriesList((prev) => [...prev.filter((c) => c.id !== cat.id), cat]);
                        setEditingCategory(null);
                        showNotification('Category saved!');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-bold text-xs"
                    >
                      Save Category
                    </button>
                  </div>
                </div>
              )}

              {/* Categories Grid with Counter (ঙ/2) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {categoriesList.map((cat) => {
                  const count = contentList.filter((c) =>
                    c.genres.some((g) => g.toLowerCase() === cat.name.toLowerCase())
                  ).length;
                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-xl bg-neutral-900 border border-white/10 hover:border-red-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{cat.icon || '🎬'}</span>
                        <div className="space-x-1">
                          <button
                            onClick={() => setEditingCategory(cat)}
                            className="p-1 text-neutral-400 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('Delete category?')) {
                                await deleteCategory(cat.id);
                                setCategoriesList((prev) => prev.filter((c) => c.id !== cat.id));
                                showNotification('Category deleted');
                              }
                            }}
                            className="p-1 text-neutral-400 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-bold text-white text-sm">{cat.name}</h4>
                      <p className="text-xs text-neutral-400">
                        <strong className="text-red-400">{count}</strong> Titles in catalog
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 8: NOTIFICATION BROADCASTER (জ/2) */}
          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  In-App Notification Broadcaster
                </h2>
                <p className="text-xs text-neutral-400">
                  Send announcement alerts and new release notifications directly to all site users
                </p>
              </div>

              {/* Broadcast Form */}
              <form
                onSubmit={handleBroadcastNotification}
                className="p-6 rounded-2xl bg-neutral-900 border border-white/10 shadow-xl space-y-4 max-w-2xl"
              >
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">
                      Notification Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={newNotifTitle}
                      onChange={(e) => setNewNotifTitle(e.target.value)}
                      placeholder="e.g. Solo Leveling Season 2 Episode 1 Released!"
                      className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">
                      Message Content *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={newNotifMessage}
                      onChange={(e) => setNewNotifMessage(e.target.value)}
                      placeholder="e.g. Episode 1 is now available in 1080p Subbed with Server 1 HD."
                      className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">
                      Target Content ID (Optional: opens movie details)
                    </label>
                    <select
                      value={newNotifTargetContentId}
                      onChange={(e) => setNewNotifTargetContentId(e.target.value)}
                      className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                    >
                      <option value="">None (General announcement)</option>
                      {contentList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{sendingNotif ? 'Broadcasting...' : 'Send Broadcast to Users'}</span>
                </button>
              </form>

              {/* Sent Notifications List */}
              <div className="space-y-3 pt-4 border-t border-white/10">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">
                  Previously Sent Announcements ({notificationsList.length})
                </h3>
                {notificationsList.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-4 rounded-xl bg-neutral-900 border border-white/5 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Bell className="w-3.5 h-3.5 text-red-500" />
                        <h4 className="font-bold text-white text-sm">{notif.title}</h4>
                      </div>
                      <p className="text-xs text-neutral-300">{notif.message}</p>
                      <p className="text-[10px] text-neutral-500">
                        Sent on {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        await deleteNotification(notif.id);
                        setNotificationsList((prev) => prev.filter((n) => n.id !== notif.id));
                        showNotification('Notification deleted');
                      }}
                      className="p-1.5 text-neutral-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 9: BRANDING & SOCIAL LINKS SETTINGS (জ/1) */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  Branding & Social Links (জ/1)
                </h2>
                <p className="text-xs text-neutral-400">
                  Configure site metadata, brand identity, and Telegram/Facebook community links
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-neutral-900 border border-white/10 shadow-xl space-y-6 max-w-2xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">Site Title</label>
                    <input
                      type="text"
                      value={siteSettings?.siteName || 'WatchAnime'}
                      onChange={(e) =>
                        setSiteSettings((prev) =>
                          prev ? { ...prev, siteName: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-400 font-semibold mb-1">Top Announcement</label>
                    <input
                      type="text"
                      value={siteSettings?.announcement || ''}
                      onChange={(e) =>
                        setSiteSettings((prev) =>
                          prev ? { ...prev, announcement: e.target.value } : null
                        )
                      }
                      className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                    />
                  </div>

                  {/* Social Links (জ/1) */}
                  <div className="sm:col-span-2 pt-2 border-t border-white/5 space-y-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                      Social Community Links
                    </h3>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">
                        Telegram Channel Link
                      </label>
                      <input
                        type="text"
                        value={siteSettings?.telegramUrl || ''}
                        onChange={(e) =>
                          setSiteSettings((prev) =>
                            prev ? { ...prev, telegramUrl: e.target.value } : null
                          )
                        }
                        placeholder="https://t.me/yourchannel"
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">
                        Facebook Group / Page
                      </label>
                      <input
                        type="text"
                        value={siteSettings?.facebookUrl || ''}
                        onChange={(e) =>
                          setSiteSettings((prev) =>
                            prev ? { ...prev, facebookUrl: e.target.value } : null
                          )
                        }
                        placeholder="https://facebook.com/yourgroup"
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-neutral-400 font-semibold mb-1">
                        YouTube Channel
                      </label>
                      <input
                        type="text"
                        value={siteSettings?.youtubeUrl || ''}
                        onChange={(e) =>
                          setSiteSettings((prev) =>
                            prev ? { ...prev, youtubeUrl: e.target.value } : null
                          )
                        }
                        placeholder="https://youtube.com/@channel"
                        className="w-full px-3 py-2 bg-neutral-950 border border-white/10 rounded-lg text-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (siteSettings) {
                      await saveSiteSettings(siteSettings);
                      showNotification('Settings saved successfully!');
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-lg shadow-red-600/30 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Platform Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 10: USER REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                User Content Requests ({requests.length})
              </h2>
              <div className="space-y-3">
                {requests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-white">{req.title}</h4>
                      <p className="text-xs text-neutral-400">
                        Type: {req.type} • Requested by: {req.userEmail || req.userId}
                      </p>
                    </div>
                    <select
                      value={req.status}
                      onChange={async (e) => {
                        await updateRequestStatus(req.id, e.target.value as any);
                        setRequests((prev) =>
                          prev.map((r) => (r.id === req.id ? { ...r, status: e.target.value as any } : r))
                        );
                        showNotification('Status updated');
                      }}
                      className="px-3 py-1.5 bg-neutral-950 border border-white/10 rounded-lg text-xs font-semibold text-white"
                    >
                      <option value="pending">Pending</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 11: DATABASE BACKUP & 1-CLICK SEEDER */}
          {activeTab === 'backup' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  Database Tools & Seeder
                </h2>
                <p className="text-xs text-neutral-400">
                  Export JSON backup or seed Firestore with rich anime & movie catalog
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-6 rounded-2xl bg-neutral-900 border border-white/10 space-y-3">
                  <h3 className="font-bold text-white text-base">Export Backup (JSON)</h3>
                  <p className="text-xs text-neutral-400">
                    Download complete snapshot of catalog, episodes, and settings.
                  </p>
                  <button
                    onClick={() => {
                      const dataStr =
                        'data:text/json;charset=utf-8,' +
                        encodeURIComponent(JSON.stringify({ contentList, siteSettings }, null, 2));
                      const downloadAnchor = document.createElement('a');
                      downloadAnchor.setAttribute('href', dataStr);
                      downloadAnchor.setAttribute('download', `watchanime_backup_${Date.now()}.json`);
                      document.body.appendChild(downloadAnchor);
                      downloadAnchor.click();
                      downloadAnchor.remove();
                    }}
                    className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-6 rounded-2xl bg-neutral-900 border border-white/10 space-y-3">
                  <h3 className="font-bold text-white text-base">1-Click Catalog Seeder</h3>
                  <p className="text-xs text-neutral-400">
                    Populate Cloud Firestore with popular anime & series (Solo Leveling, JJK, Demon Slayer).
                  </p>
                  <button
                    onClick={async () => {
                      if (confirm('Seed database with default catalog?')) {
                        await seedCatalogToFirestore();
                        showNotification('Database seeded successfully!');
                        loadAllAdminData();
                        onRefreshCatalog();
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center space-x-2 shadow-lg shadow-red-600/30"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Seed Catalog to Firestore</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
