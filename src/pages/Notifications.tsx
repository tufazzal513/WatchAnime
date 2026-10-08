import React, { useEffect, useState } from 'react';
import { Bell, Sparkles, ExternalLink, Calendar, Info, Film } from 'lucide-react';
import { AppNotification, ContentItem } from '../types';
import { getAllNotifications } from '../services/contentService';
import { useLanguage } from '../i18n/LanguageContext';

interface NotificationsProps {
  onSelectContent?: (contentId: string) => void;
}

export const NotificationsPage: React.FC<NotificationsProps> = ({ onSelectContent }) => {
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifs = async () => {
      setLoading(true);
      try {
        const data = await getAllNotifications();
        setNotifications(data);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifs();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
              Notifications & Announcements
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400">
              Latest releases, maintenance alerts and updates from WatchAnime
            </p>
          </div>
        </div>

        <span className="text-xs bg-neutral-800 text-neutral-300 px-3 py-1 rounded-full border border-white/5">
          {notifications.length} Updates
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 bg-neutral-900/40 rounded-2xl border border-white/5 p-8 space-y-3">
          <Sparkles className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="text-base font-bold text-neutral-300">No Notifications Yet</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            You're all caught up! New anime releases, server additions and announcements will appear right here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-xl bg-neutral-900/90 border border-white/10 hover:border-red-500/40 transition-all shadow-lg hover:shadow-red-950/20 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                  <h3 className="text-base font-bold text-white leading-tight">
                    {item.title}
                  </h3>
                </div>
                <div className="flex items-center text-[11px] text-neutral-400 space-x-1 flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
                {item.message}
              </p>

              {(item.targetContentId || item.linkUrl) && (
                <div className="pt-2 flex items-center gap-3">
                  {item.targetContentId && onSelectContent && (
                    <button
                      onClick={() => onSelectContent(item.targetContentId!)}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-semibold text-white flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md shadow-red-600/30"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Watch Now</span>
                    </button>
                  )}
                  {item.linkUrl && (
                    <a
                      href={item.linkUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 flex items-center space-x-1.5 transition-colors cursor-pointer border border-white/10"
                    >
                      <span>Open Link</span>
                      <ExternalLink className="w-3 h-3 text-neutral-400" />
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
