import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { submitContentRequest } from '../../services/contentService';
import { ContentType } from '../../types';

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const RequestModal: React.FC<RequestModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ContentType>('anime');
  const [releaseYear, setReleaseYear] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await submitContentRequest({
        userId: user.uid,
        userEmail: user.email || 'anonymous',
        title: title.trim(),
        type,
        ...(releaseYear ? { releaseYear: parseInt(releaseYear, 10) } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTitle('');
        setDescription('');
        setReleaseYear('');
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-[#181818] rounded-xl shadow-2xl p-6 sm:p-8 border border-white/10 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-black flex items-center space-x-2">
            <Send className="w-6 h-6 text-red-500" />
            <span>{t.requests.title}</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">{t.requests.subtitle}</p>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">Thank You!</h3>
            <p className="text-sm text-neutral-300">{t.requests.successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                {t.requests.contentTitle} *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bleach: Thousand-Year Blood War"
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  {t.requests.contentType}
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ContentType)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
                >
                  <option value="anime">Anime</option>
                  <option value="movie">Movie</option>
                  <option value="series">TV Series</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">
                  {t.requests.year}
                </label>
                <input
                  type="number"
                  value={releaseYear}
                  onChange={(e) => setReleaseYear(e.target.value)}
                  placeholder="e.g. 2024"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                {t.requests.notes}
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Season 2, English Dub or Japanese with Bengali Subtitles..."
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? t.common.loading : t.requests.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
