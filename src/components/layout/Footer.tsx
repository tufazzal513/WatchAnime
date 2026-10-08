import React from 'react';
import { Shield, Film, Heart } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FooterProps {
  onSelectTab: (tab: string) => void;
  onOpenRequests: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onSelectTab, onOpenRequests }) => {
  const { t } = useLanguage();

  return (
    <footer className="bg-black text-neutral-400 border-t border-white/5 pt-12 pb-24 md:pb-12 text-sm mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide text-xs uppercase">
              Navigation
            </h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => onSelectTab('home')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.nav.home}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('anime')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.nav.anime}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('movies')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.nav.movies}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('series')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.nav.series}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide text-xs uppercase">
              Community
            </h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={onOpenRequests}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.requests.title}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('my-list')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.nav.myList}
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('history')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  {t.nav.history}
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide text-xs uppercase">
              Legal & Policy
            </h4>
            <ul className="space-y-2.5">
              <li>
                <button
                  onClick={() => onSelectTab('dmca')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  DMCA / Copyright Notice
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('privacy')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onSelectTab('terms')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Terms of Service
                </button>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4 tracking-wide text-xs uppercase flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-red-500" />
              <span>Disclaimer</span>
            </h4>
            <p className="text-xs text-neutral-500 leading-relaxed">
              WatchAnime (watchanime.cyou) does not host any media files directly on its servers. All videos and multimedia content are provided by non-affiliated, authorized third parties.
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-neutral-900 flex flex-col md:flex-row items-center justify-between text-xs text-neutral-500 gap-4">
          <p>© 2026 WatchAnime (watchanime.cyou). All rights reserved.</p>
          <div className="flex items-center space-x-2">
            <span>Optimized for Mobile & Desktop Streaming</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
