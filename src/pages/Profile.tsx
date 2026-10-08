import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWatchlist } from '../context/WatchlistContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  User,
  Mail,
  Calendar,
  Bookmark,
  History,
  ShieldCheck,
  LogOut,
  Globe,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface ProfileProps {
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onSelectTab, onOpenAuth }) => {
  const { user, isAdmin, logout, bootstrapAdmin } = useAuth();
  const { watchlist, history } = useWatchlist();
  const { language, setLanguage, t } = useLanguage();
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#141414] pt-28 pb-20 px-4 text-center max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white">Sign In to Your Account</h2>
        <p className="text-sm text-neutral-400">
          Sign in to access your saved watchlist, playback progress, and member benefits.
        </p>
        <button
          onClick={onOpenAuth}
          className="w-full py-3 rounded-lg bg-red-600 hover:bg-red-700 font-bold text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer"
        >
          {t.nav.login}
        </button>
      </div>
    );
  }

  const handleBootstrap = async () => {
    setBootstrapping(true);
    const success = await bootstrapAdmin();
    setBootstrapping(false);
    if (success) {
      setBootstrapMsg(t.admin.bootstrapSuccess);
    } else {
      setBootstrapMsg('Admin bootstrap failed or user email not matching authorized superadmin.');
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20 px-4 sm:px-6 max-w-4xl mx-auto space-y-8">
      {/* Profile Card */}
      <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-24 h-24 rounded-full object-cover border-2 border-red-500 shadow-xl"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-red-950 border-2 border-red-500 flex items-center justify-center text-white text-3xl font-black shadow-xl">
              {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
            </div>
          )}

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-white">
                {user.displayName || 'WatchAnime Subscriber'}
              </h1>
              {isAdmin && (
                <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-600 text-white shadow">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-neutral-400">
              <span className="flex items-center space-x-1">
                <Mail className="w-3.5 h-3.5 text-neutral-500" />
                <span>{user.email}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                <span>UID: {user.uid.slice(0, 10)}...</span>
              </span>
            </div>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8 pt-6 border-t border-white/5">
          <div
            onClick={() => onSelectTab('my-list')}
            className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/50 transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-2 text-xs text-neutral-400 mb-1">
              <Bookmark className="w-4 h-4 text-red-500" />
              <span>Watchlist</span>
            </div>
            <p className="text-2xl font-black text-white">{watchlist.length}</p>
          </div>

          <div
            onClick={() => onSelectTab('history')}
            className="p-4 rounded-xl bg-black/40 border border-white/5 hover:border-red-500/50 transition-all cursor-pointer"
          >
            <div className="flex items-center space-x-2 text-xs text-neutral-400 mb-1">
              <History className="w-4 h-4 text-red-500" />
              <span>Watched Titles</span>
            </div>
            <p className="text-2xl font-black text-white">{history.length}</p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/5 col-span-2 sm:col-span-1">
            <div className="flex items-center space-x-2 text-xs text-neutral-400 mb-1">
              <Globe className="w-4 h-4 text-red-500" />
              <span>Language</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'bn' : 'en')}
              className="text-sm font-bold text-red-400 hover:text-red-300 cursor-pointer"
            >
              {language === 'en' ? 'English (Switch to বাংলা)' : 'বাংলা (Switch to EN)'}
            </button>
          </div>
        </div>
      </div>

      {/* Admin Quick Actions (If user is Admin or Superadmin email) */}
      {(isAdmin || user.email === 'mdtufazzal513@gmail.com') && (
        <div className="bg-neutral-900 border border-red-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-white font-bold">
              <ShieldCheck className="w-5 h-5 text-red-500" />
              <span>Admin Management Hub</span>
            </div>
            <button
              onClick={() => onSelectTab('admin')}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow cursor-pointer transition-colors"
            >
              Open Full Admin Panel
            </button>
          </div>

          {!isAdmin && user.email === 'mdtufazzal513@gmail.com' && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 space-y-3">
              <p className="text-xs text-red-200">
                You are logged in with the superadmin email (<code>mdtufazzal513@gmail.com</code>). Click below to initialize and write your admin credentials to the database!
              </p>
              <button
                onClick={handleBootstrap}
                disabled={bootstrapping}
                className="px-4 py-2 rounded-lg bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                {bootstrapping ? 'Activating...' : t.admin.bootstrapPrompt}
              </button>
              {bootstrapMsg && (
                <p className="text-xs text-green-400 font-semibold">{bootstrapMsg}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Account Settings / Logout */}
      <div className="flex justify-end">
        <button
          onClick={logout}
          className="flex items-center space-x-2 px-6 py-2.5 rounded-lg bg-neutral-900 hover:bg-red-950/40 text-red-400 hover:text-red-300 border border-white/5 hover:border-red-500/40 text-sm font-semibold transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>{t.nav.logout}</span>
        </button>
      </div>
    </div>
  );
};
