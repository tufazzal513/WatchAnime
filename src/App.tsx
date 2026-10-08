import React, { useState, useEffect } from 'react';
import { ContentItem, Episode, VideoServer, SiteSettings } from './types';
import { getAllContent, getSiteSettings } from './services/contentService';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { WatchlistProvider } from './context/WatchlistContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { MobileNav } from './components/layout/MobileNav';
import { Home } from './pages/Home';
import { Browse } from './pages/Browse';
import { Search } from './pages/Search';
import { MyList } from './pages/MyList';
import { History } from './pages/History';
import { Profile } from './pages/Profile';
import { WatchPage } from './pages/WatchPage';
import { Legal } from './pages/Legal';
import { DetailModal } from './components/common/DetailModal';
import { AuthModal } from './components/common/AuthModal';
import { RequestModal } from './components/common/RequestModal';
import { ReportModal } from './components/common/ReportModal';
import { BannedUserModal } from './components/common/BannedUserModal';
import { NotificationsPage } from './pages/Notifications';
import { AdBanner } from './components/ads/AdBanner';
import { AdminDashboard } from './admin/AdminDashboard';
import { AlertCircle } from 'lucide-react';

function MainApp() {
  const getInitialTab = (): string => {
    try {
      // Check if arriving via GitHub Pages 404 redirect
      const stored = sessionStorage.getItem('watchanime_redirect_path');
      if (stored) {
        sessionStorage.removeItem('watchanime_redirect_path');
        window.history.replaceState(null, '', stored);
      }

      const path = window.location.pathname.replace(/^\/|\/$/g, '');
      const hash = window.location.hash.replace(/^#\/?/, '');
      const params = new URLSearchParams(window.location.search);
      const pParam = params.get('p') || params.get('tab');

      const route = (pParam || hash || path).toLowerCase();
      if (route === 'admin') return 'admin';
      if (route === 'profile') return 'profile';
      if (route === 'anime') return 'anime';
      if (route === 'movies') return 'movies';
      if (route === 'series') return 'series';
      if (route === 'search') return 'search';
      if (route === 'notifications') return 'notifications';
      if (route === 'my-list' || route === 'mylist') return 'my-list';
      if (route === 'history') return 'history';
      if (route === 'watch') return 'watch';
      if (route === 'dmca' || route === 'privacy' || route === 'terms') return route;
    } catch {}
    return 'home';
  };

  const [currentTab, setCurrentTab] = useState<string>(getInitialTab);
  const [contentList, setContentList] = useState<ContentItem[]>([]);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [selectedGenreForBrowse, setSelectedGenreForBrowse] = useState<string>('All');

  // Change tab and sync address bar URL (e.g. /admin, /profile, /anime)
  const switchTab = (tab: string) => {
    setCurrentTab(tab);
    try {
      if (tab === 'home') {
        window.history.pushState(null, '', '/');
      } else if (tab === 'watch') {
        if (watchingContent?.content) {
          const epQuery = watchingContent.episode ? `&ep=${watchingContent.episode.episodeNumber}` : '';
          window.history.pushState(null, '', `/watch?id=${encodeURIComponent(watchingContent.content.id)}${epQuery}`);
        } else {
          window.history.pushState(null, '', '/watch');
        }
      } else {
        window.history.pushState(null, '', `/${tab}`);
      }
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Listen to browser Back/Forward & Hash changes
  useEffect(() => {
    const handlePopState = () => {
      const target = getInitialTab();
      setCurrentTab(target);
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Modals state
  const [detailItem, setDetailItem] = useState<ContentItem | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reportModalData, setReportModalData] = useState<{
    content: ContentItem | null;
    episode?: Episode | null;
    server?: VideoServer | null;
  }>({ content: null });

  // Watch page state
  const [watchingContent, setWatchingContent] = useState<{
    content: ContentItem;
    episode?: Episode;
  } | null>(null);

  const loadData = async () => {
    try {
      const [items, settings] = await Promise.all([
        getAllContent(),
        getSiteSettings(),
      ]);
      setContentList(items);
      setSiteSettings(settings);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Clean ?p= from 404 redirect and restore real URL in address bar + handle direct links
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const pParam = params.get('p');
      if (pParam) {
        const clean = pParam.replace(/^\//, '');
        const rest = new URLSearchParams(window.location.search);
        rest.delete('p');
        const searchStr = rest.toString() ? `?${rest.toString()}` : '';
        window.history.replaceState(null, '', `/${clean}${searchStr}${window.location.hash}`);
      }
    } catch {}
  }, []);

  // Handle direct content linking (e.g., /watch?id=solo-leveling or ?content=solo-leveling)
  useEffect(() => {
    if (contentList.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const contentId = params.get('id') || params.get('content');
      if (contentId) {
        const found = contentList.find((c) => c.id === contentId || c.slug === contentId);
        if (found) {
          const path = window.location.pathname.toLowerCase();
          if (path.includes('watch') || currentTab === 'watch') {
            handlePlayContent(found, undefined);
          } else {
            setDetailItem(found);
          }
        }
      }
    } catch {}
  }, [contentList, currentTab]);

  const handlePlayContent = (content: ContentItem, episode?: Episode) => {
    setWatchingContent({ content, episode });
    setDetailItem(null);
    setCurrentTab('watch');
    try {
      const epQuery = episode ? `&ep=${episode.episodeNumber}` : '';
      window.history.pushState(null, '', `/watch?id=${encodeURIComponent(content.id)}${epQuery}`);
    } catch {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectGenre = (genre: string) => {
    setSelectedGenreForBrowse(genre);
    switchTab('anime');
  };

  // Render Page Content based on tab
  const renderCurrentView = () => {
    if (currentTab === 'admin') {
      return (
        <AdminDashboard
          onBackToSite={() => switchTab('home')}
          onRefreshCatalog={loadData}
        />
      );
    }

    if (currentTab === 'watch' && watchingContent) {
      return (
        <WatchPage
          content={watchingContent.content}
          initialEpisode={watchingContent.episode}
          allContent={contentList}
          onBack={() => setCurrentTab('home')}
          onSelectContent={(c) => handlePlayContent(c)}
          onOpenReport={(srv) =>
            setReportModalData({
              content: watchingContent.content,
              episode: watchingContent.episode,
              server: srv,
            })
          }
        />
      );
    }

    if (currentTab === 'home') {
      return (
        <Home
          contentList={contentList}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
          onSelectGenre={handleSelectGenre}
        />
      );
    }

    if (currentTab === 'anime') {
      return (
        <Browse
          type="anime"
          contentList={contentList}
          initialGenre={selectedGenreForBrowse}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
        />
      );
    }

    if (currentTab === 'movies') {
      return (
        <Browse
          type="movie"
          contentList={contentList}
          initialGenre={selectedGenreForBrowse}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
        />
      );
    }

    if (currentTab === 'series') {
      return (
        <Browse
          type="series"
          contentList={contentList}
          initialGenre={selectedGenreForBrowse}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
        />
      );
    }

    if (currentTab === 'search') {
      return (
        <Search
          contentList={contentList}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
        />
      );
    }

    if (currentTab === 'my-list') {
      return (
        <MyList
          contentList={contentList}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
          onExplore={() => setCurrentTab('anime')}
        />
      );
    }

    if (currentTab === 'history') {
      return (
        <History
          contentList={contentList}
          onSelect={(c) => setDetailItem(c)}
          onPlay={(c) => handlePlayContent(c)}
          onExplore={() => setCurrentTab('home')}
        />
      );
    }

    if (currentTab === 'profile') {
      return (
        <Profile
          onSelectTab={(tab) => setCurrentTab(tab)}
          onOpenAuth={() => setAuthModalOpen(true)}
        />
      );
    }

    if (currentTab === 'notifications') {
      return (
        <NotificationsPage
          onSelectContent={(contentId) => {
            const found = contentList.find((c) => c.id === contentId);
            if (found) setDetailItem(found);
          }}
        />
      );
    }

    if (currentTab === 'dmca' || currentTab === 'privacy' || currentTab === 'terms') {
      return (
        <Legal
          page={currentTab as any}
          onBack={() => setCurrentTab('home')}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-[#141414] text-white flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Top Announcement Bar if set */}
      {siteSettings?.announcement && currentTab !== 'admin' && (
        <div className="bg-red-950/80 border-b border-red-500/30 text-red-200 text-xs py-1.5 px-4 text-center font-medium sticky top-0 z-50">
          {siteSettings.announcement}
        </div>
      )}

      {/* Global Header (Hidden on Admin screen) */}
      {currentTab !== 'admin' && (
        <Header
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setSelectedGenreForBrowse('All');
            switchTab(tab);
          }}
          onOpenAuth={() => setAuthModalOpen(true)}
          onOpenRequests={() => setRequestModalOpen(true)}
        />
      )}

      {/* Top Banner Ad if configured */}
      {currentTab !== 'admin' && currentTab !== 'watch' && (
        <AdBanner
          placement="top"
          enabled={siteSettings?.adsEnabled}
          adCode={siteSettings?.bannerAdTop}
        />
      )}

      {/* Main View Router */}
      <main className="flex-1">{renderCurrentView()}</main>

      {/* Bottom Banner Ad if configured */}
      {currentTab !== 'admin' && currentTab !== 'watch' && (
        <AdBanner
          placement="bottom"
          enabled={siteSettings?.adsEnabled}
          adCode={siteSettings?.bannerAdBottom}
        />
      )}

      {/* Footer - Only shown on catalog & policy pages, never on watch, search, profile or admin */}
      {['home', 'anime', 'movies', 'series', 'dmca', 'privacy', 'terms'].includes(currentTab) && (
        <Footer
          onSelectTab={(tab) => switchTab(tab)}
          onOpenRequests={() => setRequestModalOpen(true)}
          siteSettings={siteSettings}
        />
      )}

      {/* Mobile Bottom Navigation Bar (Hidden while watching videos or in admin) */}
      {currentTab !== 'admin' && currentTab !== 'watch' && (
        <MobileNav
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setSelectedGenreForBrowse('All');
            switchTab(tab);
          }}
          onOpenAuth={() => setAuthModalOpen(true)}
        />
      )}

      {/* Detail Info Modal */}
      {detailItem && (
        <DetailModal
          content={detailItem}
          onClose={() => setDetailItem(null)}
          onPlay={(c, ep) => handlePlayContent(c, ep)}
          onOpenReport={(c) =>
            setReportModalData({
              content: c,
            })
          }
        />
      )}

      {/* Auth Modal (Sign In / Register / Reset) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* Request Content Modal */}
      <RequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onOpenAuth={() => {
          setRequestModalOpen(false);
          setAuthModalOpen(true);
        }}
      />

      {/* Report Broken Link Modal */}
      <ReportModal
        isOpen={reportModalData.content !== null}
        content={reportModalData.content}
        episode={reportModalData.episode}
        server={reportModalData.server}
        onClose={() => setReportModalData({ content: null })}
      />

      {/* Banned User Alert Modal (MoveX Feature) */}
      <BannedUserModal />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <WatchlistProvider>
          <MainApp />
        </WatchlistProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
