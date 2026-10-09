import React, { useState, useEffect } from 'react';
import {
  Search,
  Globe,
  User,
  ShieldCheck,
  Menu,
  X,
  Bookmark,
  Film,
  Tv,
  Sparkles,
  Send,
  LogOut,
  Bell,
  History,
  Home,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenRequests: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
  onOpenRequests,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const { user, isAdmin, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'anime', label: t.nav.anime, icon: Tv },
    { id: 'movies', label: t.nav.movies, icon: Film },
    { id: 'series', label: t.nav.series, icon: Film },
    { id: 'my-list', label: t.nav.myList, icon: Bookmark },
    { id: 'history', label: t.nav.history, icon: History },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#141414]/95 backdrop-blur-md shadow-2xl py-3 border-b border-white/5'
          : 'bg-gradient-to-b from-black/90 via-black/40 to-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        {/* Brand & Desktop Navigation */}
        <div className="flex items-center space-x-4 md:space-x-8">
          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => onSelectTab('home')}
            className="flex items-center space-x-2 text-left group cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center font-black text-white text-lg tracking-wider shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
              W
            </div>
            <span className="text-lg sm:text-2xl font-black tracking-tight text-white uppercase group-hover:text-red-500 transition-colors">
              WATCH<span className="text-red-600">ANIME</span>
            </span>
          </button>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`transition-colors cursor-pointer ${
                  currentTab === item.id
                    ? 'text-white font-bold border-b-2 border-red-600 pb-0.5'
                    : 'text-neutral-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center space-x-2.5 sm:space-x-4">
          {/* Search Button */}
          <button
            onClick={() => onSelectTab('search')}
            aria-label="Search"
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              currentTab === 'search'
                ? 'bg-red-600 text-white'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications Button */}
          <button
            onClick={() => onSelectTab('notifications')}
            aria-label="Notifications"
            title="Announcements & Notifications"
            className={`p-2 rounded-full transition-colors cursor-pointer relative ${
              currentTab === 'notifications'
                ? 'bg-red-600 text-white'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
          >
            <Bell className="w-5 h-5" />
            <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1.5 right-1.5 ring-2 ring-neutral-900 animate-pulse" />
          </button>

          {/* Request Button */}
          <button
            onClick={onOpenRequests}
            title={t.requests.title}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-neutral-200 hover:bg-white/20 hover:text-white transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-red-500" />
            <span>{t.nav.requests}</span>
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
            title="Switch Language (English / বাংলা)"
            className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold border border-white/20 text-neutral-300 hover:text-white hover:border-white/50 bg-black/40 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-red-500" />
            <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
          </button>

          {/* Admin Panel Link */}
          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/40 ring-2 ring-white/20'
                  : 'bg-red-950/70 border border-red-500/40 text-red-300 hover:bg-red-900/60'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">{t.nav.admin}</span>
            </button>
          )}

          {/* User Account / Profile */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center space-x-2 p-1 rounded-full hover:ring-2 hover:ring-red-500 transition-all cursor-pointer"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-800 border border-white/20 flex items-center justify-center text-white text-xs font-bold">
                    {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                )}
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl py-2 z-50 text-sm animate-in fade-in slide-in-from-top-2"
                  onMouseLeave={() => setUserDropdownOpen(false)}
                >
                  <div className="px-4 py-2 border-b border-neutral-800">
                    <p className="font-semibold text-white truncate">
                      {user.displayName || 'Subscriber'}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      onSelectTab('profile');
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-neutral-800 text-neutral-200 flex items-center space-x-2 transition-colors cursor-pointer"
                  >
                    <User className="w-4 h-4 text-neutral-400" />
                    <span>{t.nav.profile}</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-950/60 text-red-400 flex items-center space-x-2 transition-colors cursor-pointer border-t border-neutral-800"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t.nav.logout}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-600/30 transition-all cursor-pointer whitespace-nowrap"
            >
              {t.nav.login}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Slide-out Menu Drawer (Ensures proper z-index and solid background to prevent overlapping) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md animate-in fade-in duration-200 flex">
          <div className="w-4/5 max-w-xs bg-[#121212] h-full shadow-2xl p-6 flex flex-col justify-between border-r border-white/10 animate-in slide-in-from-left duration-200">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded bg-red-600 flex items-center justify-center font-black text-white text-sm shadow-md">
                    W
                  </div>
                  <span className="font-black text-base text-white uppercase">
                    WATCH<span className="text-red-600">ANIME</span>
                  </span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSelectTab(item.id);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-red-600 text-white shadow-md'
                          : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenRequests();
                  }}
                  className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center space-x-3 text-neutral-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4 text-red-500" />
                  <span>{t.requests.title}</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSelectTab('admin');
                    }}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center space-x-3 transition-colors cursor-pointer ${
                      currentTab === 'admin'
                        ? 'bg-red-600 text-white'
                        : 'bg-red-950/60 text-red-300 border border-red-500/30'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-red-400" />
                    <span>{t.nav.admin}</span>
                  </button>
                )}
              </nav>
            </div>

            {/* Bottom Profile / Auth */}
            <div className="pt-4 border-t border-white/10 space-y-3">
              {user ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-3 px-2">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="User"
                        className="w-9 h-9 rounded-full object-cover border border-white/20"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-neutral-800 flex items-center justify-center text-white font-bold text-xs">
                        {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="truncate">
                      <p className="text-xs font-bold text-white truncate">
                        {user.displayName || 'Subscriber'}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSelectTab('profile');
                    }}
                    className="w-full py-2 rounded-lg bg-neutral-900 text-neutral-200 text-xs font-semibold flex items-center justify-center space-x-2 border border-white/5 cursor-pointer"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>{t.nav.profile}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logout();
                    }}
                    className="w-full py-2 rounded-lg bg-red-950/60 text-red-400 text-xs font-semibold flex items-center justify-center space-x-2 border border-red-500/30 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t.nav.logout}</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuth();
                  }}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md shadow-red-600/30 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>{t.nav.login} / Register</span>
                </button>
              )}
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </header>
  );
};
