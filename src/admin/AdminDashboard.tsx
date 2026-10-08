import React, { useState, useEffect } from 'react';
import {
  ContentItem,
  Episode,
  ContentRequest,
  VideoReport,
  SiteSettings,
  ContentType,
  VideoServer,
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
  getSiteSettings,
  saveSiteSettings,
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
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToSite: () => void;
  onRefreshCatalog: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBackToSite,
  onRefreshCatalog,
}) => {
  const { isAdmin, user } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'content' | 'episodes' | 'requests' | 'reports' | 'settings' | 'backup'
  >('dashboard');

  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [reports, setReports] = useState<VideoReport[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Content editing state
  const [editingContent, setEditingContent] = useState<Partial<ContentItem> | null>(null);
  const [isNewContent, setIsNewContent] = useState(false);

  // Episode editing state
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('');
  const [seriesEpisodes, setSeriesEpisodes] = useState<Episode[]>([]);
  const [editingEpisode, setEditingEpisode] = useState<Partial<Episode> | null>(null);
  const [isNewEpisode, setIsNewEpisode] = useState(false);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const loadAllAdminData = async () => {
    setLoading(true);
    try {
      const [allC, allReq, allRep, settings] = await Promise.all([
        getAllContent(),
        getAllRequests(),
        getAllReports(),
        getSiteSettings(),
      ]);
      setContentList(allC);
      setRequests(allReq);
      setReports(allRep);
      setSiteSettings(settings);
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#141414] pt-28 pb-20 px-4 text-center max-w-md mx-auto space-y-4">
        <AlertTriangle className="w-16 h-16 text-red-500 mx-auto" />
        <h2 className="text-2xl font-black text-white">Access Denied</h2>
        <p className="text-sm text-neutral-400">
          You must be an authorized Administrator to access this control panel.
        </p>
        <button
          onClick={onBackToSite}
          className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm cursor-pointer"
        >
          Return to WatchAnime
        </button>
      </div>
    );
  }

  // --- Handlers for Content CRUD ---
  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContent || !editingContent.title || !editingContent.type) return;

    try {
      const slug =
        editingContent.slug ||
        editingContent.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const id = editingContent.id || slug;

      const itemToSave: ContentItem = {
        id,
        title: editingContent.title,
        originalTitle: editingContent.originalTitle || editingContent.title,
        slug,
        type: editingContent.type as ContentType,
        description: editingContent.description || '',
        posterUrl: editingContent.posterUrl || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600',
        backdropUrl: editingContent.backdropUrl || editingContent.posterUrl || '',
        releaseYear: editingContent.releaseYear || new Date().getFullYear(),
        genres: editingContent.genres || ['Action'],
        rating: editingContent.rating || 8.0,
        runtime: editingContent.runtime || '24m',
        country: editingContent.country || 'Japan',
        audioLanguage: editingContent.audioLanguage || 'Japanese',
        subtitles: editingContent.subtitles || ['English', 'Bengali'],
        status: editingContent.status || 'published',
        featured: editingContent.featured || false,
        trending: editingContent.trending || false,
        totalSeasons: editingContent.totalSeasons || 1,
        totalEpisodes: editingContent.totalEpisodes || 12,
        cast: editingContent.cast || [],
        director: editingContent.director || '',
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

      await saveContent(itemToSave);
      showNotification('Content saved successfully to Firestore!');
      setEditingContent(null);
      await loadAllAdminData();
      onRefreshCatalog();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteContent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this title?')) return;
    try {
      await deleteContent(id);
      showNotification('Deleted content successfully');
      await loadAllAdminData();
      onRefreshCatalog();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // --- Handlers for Episode CRUD ---
  const handleSaveEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEpisode || !selectedSeriesId) return;

    try {
      const epNumber = editingEpisode.episodeNumber || seriesEpisodes.length + 1;
      const epId = editingEpisode.id || `ep-${epNumber}-${Date.now()}`;

      const episodeToSave: Episode = {
        id: epId,
        contentId: selectedSeriesId,
        seasonNumber: editingEpisode.seasonNumber || 1,
        episodeNumber: epNumber,
        title: editingEpisode.title || `Episode ${epNumber}`,
        description: editingEpisode.description || '',
        thumbnail: editingEpisode.thumbnail || '',
        duration: editingEpisode.duration || '24m',
        videoServers: editingEpisode.videoServers?.length
          ? editingEpisode.videoServers
          : [
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

      await saveEpisode(episodeToSave);
      showNotification('Episode saved successfully!');
      setEditingEpisode(null);
      const updatedEps = await getEpisodes(selectedSeriesId);
      setSeriesEpisodes(updatedEps);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!window.confirm('Delete this episode?')) return;
    try {
      await deleteEpisode(selectedSeriesId, episodeId);
      showNotification('Episode deleted');
      const updatedEps = await getEpisodes(selectedSeriesId);
      setSeriesEpisodes(updatedEps);
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // --- Handlers for Site Settings ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteSettings) return;
    try {
      await saveSiteSettings(siteSettings);
      showNotification('Site and Ad settings updated!');
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  // --- Handlers for Backup & Restore ---
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(contentList, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watchanime-catalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Database backup exported to JSON');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (Array.isArray(json)) {
          for (const item of json) {
            await saveContent(item);
          }
          showNotification(`Imported ${json.length} items successfully!`);
          await loadAllAdminData();
          onRefreshCatalog();
        }
      } catch (err: any) {
        showNotification('Invalid JSON file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  const handleSeedCatalog = async () => {
    if (!window.confirm('Seed sample anime, movies and episodes to Cloud Firestore?')) return;
    try {
      setLoading(true);
      const count = await seedCatalogToFirestore();
      showNotification(`Successfully seeded ${count} anime & movies to Firestore!`);
      await loadAllAdminData();
      onRefreshCatalog();
    } catch (err: any) {
      showNotification('Seeding error: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const animeCount = contentList.filter((c) => c.type === 'anime').length;
  const movieCount = contentList.filter((c) => c.type === 'movie').length;
  const seriesCount = contentList.filter((c) => c.type === 'series').length;
  const pendingRequestsCount = requests.filter((r) => r.status === 'pending').length;
  const openReportsCount = reports.filter((r) => r.status === 'open').length;

  return (
    <div className="min-h-screen bg-[#101010] text-neutral-200 pb-20">
      {/* Top Admin Navbar */}
      <header className="bg-neutral-900 border-b border-white/10 px-4 sm:px-6 py-3.5 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToSite}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Site</span>
          </button>
          <span className="font-black text-white text-base tracking-tight hidden sm:inline">
            WATCH<span className="text-red-600">ANIME</span> ADMIN
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-neutral-400 hidden md:inline">
            Logged in as <strong className="text-white">{user?.email}</strong>
          </span>
          <button
            onClick={handleSeedCatalog}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Seed Catalog</span>
          </button>
        </div>
      </header>

      {/* Floating Status Notification */}
      {msg && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-lg text-xs font-semibold shadow-2xl flex items-center space-x-2 animate-in fade-in ${
            msg.type === 'success'
              ? 'bg-green-950 border border-green-500/50 text-green-300'
              : 'bg-red-950 border border-red-500/50 text-red-300'
          }`}
        >
          {msg.type === 'success' ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      {/* Admin Mobile-Friendly Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-white/10 text-xs font-bold">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('content')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'content'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Content ({contentList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('episodes')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'episodes'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Episodes & Servers</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Requests ({pendingRequestsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Reports ({openReportsCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Site & Ads</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center space-x-1.5 px-4 py-2.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'backup'
                ? 'bg-red-600 text-white shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup & JSON</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        {/* 1. DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-xs text-neutral-400 block mb-1">Total Titles</span>
                <p className="text-2xl font-black text-white">{contentList.length}</p>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-xs text-neutral-400 block mb-1">Anime Series</span>
                <p className="text-2xl font-black text-red-400">{animeCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-xs text-neutral-400 block mb-1">Movies</span>
                <p className="text-2xl font-black text-amber-400">{movieCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-xs text-neutral-400 block mb-1">TV Series</span>
                <p className="text-2xl font-black text-blue-400">{seriesCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-xs text-neutral-400 block mb-1">Pending Requests</span>
                <p className="text-2xl font-black text-yellow-400">{pendingRequestsCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-neutral-900 border border-white/5">
                <span className="text-xs text-neutral-400 block mb-1">Broken Reports</span>
                <p className="text-2xl font-black text-rose-500">{openReportsCount}</p>
              </div>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-red-500" />
                <span>Admin Quick Actions</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setIsNewContent(true);
                    setEditingContent({
                      type: 'anime',
                      status: 'published',
                      genres: ['Action', 'Fantasy'],
                      rating: 8.5,
                      releaseYear: 2024,
                    });
                    setActiveTab('content');
                  }}
                  className="p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors text-left space-y-1 cursor-pointer"
                >
                  <Plus className="w-5 h-5 text-red-500 mb-1" />
                  <h4 className="font-bold text-white text-sm">Add New Title</h4>
                  <p className="text-xs text-neutral-400">
                    Publish a new anime, movie or web series with video servers.
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('episodes')}
                  className="p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors text-left space-y-1 cursor-pointer"
                >
                  <Server className="w-5 h-5 text-green-500 mb-1" />
                  <h4 className="font-bold text-white text-sm">Manage Video Links</h4>
                  <p className="text-xs text-neutral-400">
                    Add or update iframe embed links for episodes and movies.
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('backup')}
                  className="p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors text-left space-y-1 cursor-pointer"
                >
                  <Download className="w-5 h-5 text-blue-500 mb-1" />
                  <h4 className="font-bold text-white text-sm">Export Full Backup</h4>
                  <p className="text-xs text-neutral-400">
                    Save JSON copy of all published content and episodes.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. CONTENT MANAGER */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Media Catalogue Management</h2>
              <button
                onClick={() => {
                  setIsNewContent(true);
                  setEditingContent({
                    type: 'anime',
                    status: 'published',
                    genres: ['Action', 'Fantasy'],
                    rating: 8.5,
                    releaseYear: 2024,
                  });
                }}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Content</span>
              </button>
            </div>

            {/* Content Editor Modal / Drawer */}
            {editingContent && (
              <div className="bg-neutral-900 border border-red-500/40 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">
                    {isNewContent ? 'Add New Title' : `Edit: ${editingContent.title}`}
                  </h3>
                  <button
                    onClick={() => setEditingContent(null)}
                    className="p-1 rounded text-neutral-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveContent} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Title *</label>
                      <input
                        type="text"
                        required
                        value={editingContent.title || ''}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, title: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Content Type</label>
                      <select
                        value={editingContent.type || 'anime'}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            type: e.target.value as ContentType,
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      >
                        <option value="anime">Anime</option>
                        <option value="movie">Movie</option>
                        <option value="series">TV Series</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Release Year</label>
                      <input
                        type="number"
                        value={editingContent.releaseYear || 2024}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            releaseYear: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Poster URL</label>
                      <input
                        type="url"
                        value={editingContent.posterUrl || ''}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, posterUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Backdrop URL</label>
                      <input
                        type="url"
                        value={editingContent.backdropUrl || ''}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, backdropUrl: e.target.value })
                        }
                        placeholder="https://..."
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Description / Synopsis</label>
                    <textarea
                      rows={3}
                      value={editingContent.description || ''}
                      onChange={(e) =>
                        setEditingContent({ ...editingContent, description: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Rating (1-10)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editingContent.rating || 8.0}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            rating: parseFloat(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Genres (comma separated)</label>
                      <input
                        type="text"
                        value={editingContent.genres?.join(', ') || ''}
                        onChange={(e) =>
                          setEditingContent({
                            ...editingContent,
                            genres: e.target.value.split(',').map((g) => g.trim()),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>

                    <div className="flex items-center space-x-2 pt-5">
                      <input
                        type="checkbox"
                        id="featured"
                        checked={editingContent.featured || false}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, featured: e.target.checked })
                        }
                        className="rounded"
                      />
                      <label htmlFor="featured" className="text-xs font-semibold cursor-pointer">
                        Featured on Hero
                      </label>
                    </div>

                    <div className="flex items-center space-x-2 pt-5">
                      <input
                        type="checkbox"
                        id="trending"
                        checked={editingContent.trending || false}
                        onChange={(e) =>
                          setEditingContent({ ...editingContent, trending: e.target.checked })
                        }
                        className="rounded"
                      />
                      <label htmlFor="trending" className="text-xs font-semibold cursor-pointer">
                        Trending
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditingContent(null)}
                      className="px-4 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow"
                    >
                      Save Title
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Content Table / Cards List */}
            <div className="bg-neutral-900 border border-white/5 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold border-b border-white/5">
                    <tr>
                      <th className="p-3">Title</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Year</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {contentList.map((item) => (
                      <tr key={item.id} className="hover:bg-neutral-800/50">
                        <td className="p-3 flex items-center space-x-3">
                          <img
                            src={item.posterUrl}
                            alt=""
                            className="w-8 h-10 object-cover rounded bg-neutral-950 flex-shrink-0"
                          />
                          <div>
                            <span className="font-bold text-white block">{item.title}</span>
                            <span className="text-[10px] text-neutral-500">{item.id}</span>
                          </div>
                        </td>
                        <td className="p-3 uppercase font-semibold text-neutral-300">
                          {item.type}
                        </td>
                        <td className="p-3 text-neutral-300">{item.releaseYear}</td>
                        <td className="p-3 text-amber-400 font-bold">★ {item.rating.toFixed(1)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.status === 'published'
                                ? 'bg-green-950 text-green-300'
                                : 'bg-yellow-950 text-yellow-300'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => {
                              setIsNewContent(false);
                              setEditingContent(item);
                            }}
                            className="p-1.5 rounded hover:bg-neutral-700 text-neutral-300 hover:text-white"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteContent(item.id)}
                            className="p-1.5 rounded hover:bg-red-950 text-neutral-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
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

        {/* 3. EPISODES & SERVERS MANAGER */}
        {activeTab === 'episodes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Episodes & Streaming Servers</h2>
                <p className="text-xs text-neutral-400">
                  Select an anime or TV series to manage its individual episodes and video embed links.
                </p>
              </div>

              {/* Series Picker */}
              <div className="flex items-center space-x-2 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs">
                <span>Selected:</span>
                <select
                  value={selectedSeriesId}
                  onChange={(e) => setSelectedSeriesId(e.target.value)}
                  className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                >
                  {contentList.map((c) => (
                    <option key={c.id} value={c.id} className="bg-neutral-900 text-white">
                      {c.title} ({c.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setIsNewEpisode(true);
                  setEditingEpisode({
                    seasonNumber: 1,
                    episodeNumber: seriesEpisodes.length + 1,
                    duration: '24m',
                    videoServers: [
                      {
                        id: `srv-${Date.now()}`,
                        serverName: 'Server 1 (HD)',
                        embedUrl: 'https://www.youtube-nocookie.com/embed/s0wTdCQoc2k',
                        quality: '1080p',
                        subDub: 'Sub',
                        isDefault: true,
                      },
                    ],
                  });
                }}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Episode</span>
              </button>
            </div>

            {/* Episode Form Modal */}
            {editingEpisode && (
              <div className="bg-neutral-900 border border-red-500/40 rounded-xl p-5 sm:p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-bold text-white">
                    {isNewEpisode ? 'Add New Episode' : `Edit: ${editingEpisode.title}`}
                  </h3>
                  <button
                    onClick={() => setEditingEpisode(null)}
                    className="p-1 rounded text-neutral-400 hover:text-white"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEpisode} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Episode Number</label>
                      <input
                        type="number"
                        required
                        value={editingEpisode.episodeNumber || 1}
                        onChange={(e) =>
                          setEditingEpisode({
                            ...editingEpisode,
                            episodeNumber: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Season Number</label>
                      <input
                        type="number"
                        value={editingEpisode.seasonNumber || 1}
                        onChange={(e) =>
                          setEditingEpisode({
                            ...editingEpisode,
                            seasonNumber: parseInt(e.target.value, 10),
                          })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold mb-1">Duration</label>
                      <input
                        type="text"
                        value={editingEpisode.duration || '24m'}
                        onChange={(e) =>
                          setEditingEpisode({ ...editingEpisode, duration: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Episode Title</label>
                    <input
                      type="text"
                      required
                      value={editingEpisode.title || ''}
                      onChange={(e) =>
                        setEditingEpisode({ ...editingEpisode, title: e.target.value })
                      }
                      placeholder="e.g. Episode 1: The Beginning"
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Primary Video Embed URL (Iframe source) *
                    </label>
                    <input
                      type="url"
                      required
                      value={editingEpisode.videoServers?.[0]?.embedUrl || ''}
                      onChange={(e) => {
                        const existing = editingEpisode.videoServers || [];
                        const updated = [...existing];
                        if (updated.length === 0) {
                          updated.push({
                            id: 'srv-1',
                            serverName: 'Server 1 (HD)',
                            embedUrl: e.target.value,
                            quality: '1080p',
                            subDub: 'Sub',
                            isDefault: true,
                          });
                        } else {
                          updated[0] = { ...updated[0], embedUrl: e.target.value };
                        }
                        setEditingEpisode({ ...editingEpisode, videoServers: updated });
                      }}
                      placeholder="https://www.youtube-nocookie.com/embed/..."
                      className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setEditingEpisode(null)}
                      className="px-4 py-2 rounded bg-neutral-800 text-xs text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 rounded bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow"
                    >
                      Save Episode
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Episodes List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {seriesEpisodes.map((ep) => (
                <div
                  key={ep.id}
                  className="p-4 rounded-xl bg-neutral-900 border border-white/5 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-red-400">EP {ep.episodeNumber}</span>
                      <span className="text-neutral-500">{ep.duration}</span>
                    </div>
                    <h4 className="font-bold text-white text-sm line-clamp-1">{ep.title}</h4>
                    <p className="text-[11px] text-neutral-400 mt-1 truncate">
                      Embed: {ep.videoServers?.[0]?.embedUrl || 'No server'}
                    </p>
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => {
                        setIsNewEpisode(false);
                        setEditingEpisode(ep);
                      }}
                      className="p-1 rounded text-neutral-300 hover:text-white"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteEpisode(ep.id)}
                      className="p-1 rounded text-neutral-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. USER REQUESTS */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">User Content Requests</h2>
            <div className="bg-neutral-900 border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold border-b border-white/5">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">User</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Moderate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {requests.map((req) => (
                    <tr key={req.id}>
                      <td className="p-3 font-bold text-white">{req.title}</td>
                      <td className="p-3 uppercase">{req.type}</td>
                      <td className="p-3 text-neutral-400">{req.userEmail || req.userId}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            req.status === 'completed'
                              ? 'bg-green-950 text-green-300'
                              : req.status === 'approved'
                              ? 'bg-blue-950 text-blue-300'
                              : 'bg-yellow-950 text-yellow-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={async () => {
                            await updateRequestStatus(req.id, 'approved');
                            showNotification('Request approved');
                            loadAllAdminData();
                          }}
                          className="px-2 py-1 rounded bg-blue-900/60 hover:bg-blue-800 text-blue-200 text-[10px] font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={async () => {
                            await updateRequestStatus(req.id, 'completed');
                            showNotification('Request marked completed');
                            loadAllAdminData();
                          }}
                          className="px-2 py-1 rounded bg-green-900/60 hover:bg-green-800 text-green-200 text-[10px] font-semibold"
                        >
                          Completed
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. VIDEO REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Broken Link & Video Reports</h2>
            <div className="bg-neutral-900 border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold border-b border-white/5">
                  <tr>
                    <th className="p-3">Title</th>
                    <th className="p-3">Server</th>
                    <th className="p-3">Issue Reason</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reports.map((rep) => (
                    <tr key={rep.id}>
                      <td className="p-3 font-bold text-white">{rep.contentTitle}</td>
                      <td className="p-3 text-neutral-400">{rep.serverName}</td>
                      <td className="p-3 text-neutral-300">{rep.reason}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            rep.status === 'resolved'
                              ? 'bg-green-950 text-green-300'
                              : 'bg-red-950 text-red-300'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={async () => {
                            await updateReportStatus(rep.id, 'resolved');
                            showNotification('Report marked as resolved');
                            loadAllAdminData();
                          }}
                          className="px-2.5 py-1 rounded bg-green-900/60 hover:bg-green-800 text-green-200 text-[10px] font-semibold"
                        >
                          Mark Resolved
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. SITE & AD SETTINGS */}
        {activeTab === 'settings' && siteSettings && (
          <form onSubmit={handleSaveSettings} className="space-y-6 max-w-3xl">
            <h2 className="text-xl font-bold text-white">Website & Advertising Manager</h2>

            <div className="bg-neutral-900 border border-white/5 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white">General Settings</h3>
              <div>
                <label className="block text-xs font-semibold mb-1">Site Title</label>
                <input
                  type="text"
                  value={siteSettings.siteName}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, siteName: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Announcement Banner</label>
                <input
                  type="text"
                  value={siteSettings.announcement || ''}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, announcement: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white"
                />
              </div>
            </div>

            <div className="bg-neutral-900 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Banner Advertising</h3>
                  <p className="text-xs text-neutral-400">
                    Enable or disable banner advertisement slots on watchanime.cyou.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="adsEnabled"
                  checked={siteSettings.adsEnabled}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, adsEnabled: e.target.checked })
                  }
                  className="w-5 h-5 accent-red-600 rounded"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Top Header Ad Slot HTML / Tag
                </label>
                <textarea
                  rows={2}
                  value={siteSettings.bannerAdTop || ''}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, bannerAdTop: e.target.value })
                  }
                  placeholder="<!-- Ad banner tag -->"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Bottom Footer Ad Slot HTML / Tag
                </label>
                <textarea
                  rows={2}
                  value={siteSettings.bannerAdBottom || ''}
                  onChange={(e) =>
                    setSiteSettings({ ...siteSettings, bannerAdBottom: e.target.value })
                  }
                  placeholder="<!-- Ad banner tag -->"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded text-xs text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-xs text-white shadow-lg cursor-pointer"
            >
              Save Configuration
            </button>
          </form>
        )}

        {/* 7. BACKUP & RESTORE */}
        {activeTab === 'backup' && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-xl font-bold text-white">Database Backup & JSON Portability</h2>
            <p className="text-xs text-neutral-400">
              Export all your movies and anime metadata to a standard JSON format, or restore from a previous backup file.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-neutral-900 border border-white/5 space-y-3">
                <Download className="w-8 h-8 text-blue-500" />
                <h3 className="font-bold text-white text-sm">Export Content JSON</h3>
                <p className="text-xs text-neutral-400">
                  Download all {contentList.length} media items as a JSON backup file.
                </p>
                <button
                  onClick={handleExportJSON}
                  className="w-full py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white transition-colors cursor-pointer"
                >
                  Download Backup (.json)
                </button>
              </div>

              <div className="p-5 rounded-xl bg-neutral-900 border border-white/5 space-y-3">
                <Upload className="w-8 h-8 text-green-500" />
                <h3 className="font-bold text-white text-sm">Import Content JSON</h3>
                <p className="text-xs text-neutral-400">
                  Restore or bulk-insert items from an exported JSON file.
                </p>
                <label className="block w-full py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white text-center cursor-pointer">
                  <span>Select JSON File</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
