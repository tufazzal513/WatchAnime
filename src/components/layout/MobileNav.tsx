import React from 'react';
import { Home, Tv, Film, Search, Bookmark, User } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../context/AuthContext';

interface MobileNavProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onOpenAuth: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  onSelectTab,
  onOpenAuth,
}) => {
  const { t } = useLanguage();
  const { user } = useAuth();

  const items = [
    { id: 'home', label: t.nav.home, icon: Home },
    { id: 'anime', label: t.nav.anime, icon: Tv },
    { id: 'movies', label: t.nav.movies, icon: Film },
    { id: 'search', label: t.nav.search, icon: Search },
    { id: 'my-list', label: t.nav.myList, icon: Bookmark },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#121212]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1.5 flex items-center justify-around shadow-2xl">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = currentTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
              isActive ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[55px]">
              {item.label}
            </span>
          </button>
        );
      })}

      {/* Profile or Sign in button */}
      <button
        onClick={() => (user ? onSelectTab('profile') : onOpenAuth())}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
          currentTab === 'profile' ? 'text-red-500 font-bold' : 'text-neutral-400 hover:text-white'
        }`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[55px]">
          {user ? t.nav.profile : t.nav.login}
        </span>
      </button>
    </nav>
  );
};
