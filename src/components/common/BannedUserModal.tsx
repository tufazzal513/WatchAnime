import React from 'react';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';

export const BannedUserModal: React.FC = () => {
  const { isBanned, logout, user } = useAuth();
  const { t } = useLanguage();

  if (!isBanned || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="max-w-md w-full bg-neutral-900 border border-red-500/40 rounded-2xl p-6 text-center shadow-2xl shadow-red-950/50 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
        </div>

        <h3 className="text-xl font-bold text-white tracking-wide">
          Account Suspended
        </h3>

        <p className="text-sm text-neutral-300 leading-relaxed">
          Your account ({user.email}) has been suspended by the administrator due to violation of platform policies.
        </p>

        <div className="p-3 bg-neutral-950 rounded-xl border border-white/5 text-xs text-neutral-400">
          If you believe this is a mistake, please reach out to admin support at <span className="text-red-400 font-semibold">support@watchanime.cyou</span>.
        </div>

        <div className="pt-2">
          <button
            onClick={() => logout()}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-red-600/30"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
