import React from 'react';
import { Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface FooterProps {
  onSelectTab: (tab: string) => void;
  onOpenRequests: () => void;
  siteSettings?: any;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectTab,
  onOpenRequests,
  siteSettings,
}) => {
  const { t } = useLanguage();

  return (
    <footer className="bg-[#0a0a0a] text-neutral-500 border-t border-white/5 py-8 px-4 sm:px-6 text-xs mt-12 mb-16 md:mb-0">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center space-y-4">
        {/* Brand Logo */}
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded bg-red-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-red-600/30">
            W
          </div>
          <span className="font-black text-sm tracking-wider text-white uppercase">
            WATCH<span className="text-red-600">ANIME</span>
          </span>
        </div>

        {/* Clean, Non-Duplicate Secondary & Policy Links */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-neutral-400 font-medium text-xs">
          <button
            onClick={onOpenRequests}
            className="hover:text-red-400 transition-colors cursor-pointer flex items-center space-x-1"
          >
            <Send className="w-3 h-3 text-red-500" />
            <span>{t.requests.title}</span>
          </button>
          <span className="text-neutral-700 hidden sm:inline">•</span>
          <button
            onClick={() => onSelectTab('dmca')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            DMCA Notice
          </button>
          <span className="text-neutral-700 hidden sm:inline">•</span>
          <button
            onClick={() => onSelectTab('privacy')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <span className="text-neutral-700 hidden sm:inline">•</span>
          <button
            onClick={() => onSelectTab('terms')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Terms of Service
          </button>
        </div>

        {/* Social Community Buttons if configured */}
        {(siteSettings?.telegramUrl || siteSettings?.facebookUrl || siteSettings?.youtubeUrl) && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            {siteSettings.telegramUrl && (
              <a
                href={siteSettings.telegramUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[11px] font-semibold border border-white/5 transition-colors"
              >
                Telegram Channel
              </a>
            )}
            {siteSettings.facebookUrl && (
              <a
                href={siteSettings.facebookUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[11px] font-semibold border border-white/5 transition-colors"
              >
                Facebook Community
              </a>
            )}
            {siteSettings.youtubeUrl && (
              <a
                href={siteSettings.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-[11px] font-semibold border border-white/5 transition-colors"
              >
                YouTube
              </a>
            )}
          </div>
        )}

        {/* Minimal Legal Disclaimer */}
        <p className="text-[11px] text-neutral-600 max-w-xl leading-relaxed">
          WatchAnime does not host any media files directly on its servers. All videos and multimedia content are provided by non-affiliated, authorized third parties.
        </p>

        {/* Copyright */}
        <p className="text-[11px] text-neutral-600">
          © {new Date().getFullYear()} WatchAnime. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
