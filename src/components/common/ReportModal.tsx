import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ContentItem, Episode, VideoServer } from '../../types';
import { submitVideoReport } from '../../services/contentService';
import { useAuth } from '../../context/AuthContext';

interface ReportModalProps {
  isOpen: boolean;
  content: ContentItem | null;
  episode?: Episode | null;
  server?: VideoServer | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  content,
  episode,
  server,
  onClose,
}) => {
  const { user } = useAuth();
  const [reason, setReason] = useState('Video is not loading / black screen');
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !content) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await submitVideoReport({
        contentId: content.id,
        contentTitle: content.title,
        ...(episode?.episodeNumber !== undefined ? { episodeNumber: episode.episodeNumber } : {}),
        serverName: server?.serverName || 'Default Server',
        reason: `${reason}${details ? ` - Details: ${details}` : ''}`,
        reportedBy: user?.email || user?.uid || 'Anonymous',
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDetails('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-[#181818] rounded-xl shadow-2xl p-6 border border-white/10 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center space-x-2 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <span>Report Broken Link</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Reporting: <span className="text-white font-semibold">{content.title}</span>
            {episode && ` (EP ${episode.episodeNumber})`}
          </p>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <h3 className="text-base font-bold text-white">Report Received</h3>
            <p className="text-xs text-neutral-300">
              Our moderation team will inspect this server and replace the link if needed!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Issue Description
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="Video is not loading / black screen">
                  Video is not loading / black screen
                </option>
                <option value="Broken or removed video link">
                  Broken or removed video link (404)
                </option>
                <option value="Audio out of sync or missing">Audio out of sync or missing</option>
                <option value="Wrong episode or title">Wrong episode or movie loaded</option>
                <option value="Subtitles not working">Subtitles missing or broken</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1">
                Additional Note (Optional)
              </label>
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g. Stuck buffering at minute 12..."
                className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Report'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
