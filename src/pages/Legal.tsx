import React from 'react';
import { Shield, AlertCircle, FileText, ArrowLeft } from 'lucide-react';

interface LegalProps {
  page: 'dmca' | 'privacy' | 'terms';
  onBack: () => void;
}

export const Legal: React.FC<LegalProps> = ({ page, onBack }) => {
  return (
    <div className="min-h-screen bg-[#141414] pt-24 pb-20 px-4 sm:px-6 max-w-4xl mx-auto space-y-8 text-neutral-300">
      <button
        onClick={onBack}
        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Home</span>
      </button>

      {page === 'dmca' && (
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center space-x-3 text-red-500 pb-4 border-b border-white/10">
            <Shield className="w-8 h-8" />
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              DMCA & Copyright Content Removal Policy
            </h1>
          </div>

          <p className="text-sm leading-relaxed">
            <strong>WatchAnime (watchanime.cyou)</strong> is in compliance with 17 U.S.C. § 512 and the Digital Millennium Copyright Act (DMCA). It is our policy to respond to any infringement notices and take appropriate actions under the DMCA and other applicable intellectual property laws.
          </p>

          <h2 className="text-lg font-bold text-white pt-2">Third-Party Hosting Notice</h2>
          <p className="text-sm leading-relaxed">
            WatchAnime does not host, upload, store, or manage any video files, media streams, or multimedia content on its servers. All media files and videos available on this site are hosted on third-party websites and servers (such as YouTube, Dailymotion, Vidstream, Streamtape, and other authorized embed providers) that are entirely unaffiliated with WatchAnime.
          </p>

          <h2 className="text-lg font-bold text-white pt-2">How to Submit a DMCA Takedown Notice</h2>
          <p className="text-sm leading-relaxed">
            If your copyrighted material has been indexed on watchanime.cyou and you want this material removed or links delinked, you must provide a written communication that details the information listed below:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs sm:text-sm text-neutral-400">
            <li>Provide evidence of the authorized person to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
            <li>Provide sufficient contact information (Name, Email address, Telephone number).</li>
            <li>You must identify in sufficient detail the copyrighted work claimed to have been infringed and provide the direct URL(s) on watchanime.cyou.</li>
            <li>A statement that the complaining party has a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
          </ul>

          <p className="text-sm pt-4">
            Direct your copyright infringement notices to our designated contact email:
            <br />
            <span className="text-red-400 font-mono font-semibold">dmca@watchanime.cyou</span> or <span className="text-red-400 font-mono font-semibold">mdtufazzal513@gmail.com</span>
          </p>
        </div>
      )}

      {page === 'privacy' && (
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center space-x-3 text-red-500 pb-4 border-b border-white/10">
            <FileText className="w-8 h-8" />
            <h1 className="text-2xl sm:text-3xl font-black text-white">Privacy Policy</h1>
          </div>

          <p className="text-sm leading-relaxed">
            Last Updated: 2026. At WatchAnime (watchanime.cyou), the privacy of our visitors is of extreme importance to us. This Privacy Policy document outlines the types of personal information that is received and collected by WatchAnime and how it is used.
          </p>

          <h2 className="text-lg font-bold text-white pt-2">User Accounts & Authentication</h2>
          <p className="text-sm leading-relaxed">
            When you register or log in using Google OAuth or Email/Password, Firebase securely stores your authentication credentials. We use your user identifier solely to persist your private watchlist and viewing history. We never sell or share your personal data with third parties.
          </p>

          <h2 className="text-lg font-bold text-white pt-2">Cookies & Local Storage</h2>
          <p className="text-sm leading-relaxed">
            WatchAnime uses browser local storage and cookies to record user preferences (such as selected language: English or Bengali, and continue-watching timestamps) in order to optimize the user browsing experience.
          </p>
        </div>
      )}

      {page === 'terms' && (
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-6 sm:p-10 space-y-6">
          <div className="flex items-center space-x-3 text-red-500 pb-4 border-b border-white/10">
            <FileText className="w-8 h-8" />
            <h1 className="text-2xl sm:text-3xl font-black text-white">Terms of Service</h1>
          </div>

          <p className="text-sm leading-relaxed">
            By accessing or using WatchAnime (watchanime.cyou), you agree to be bound by these Terms of Service. If you disagree with any part of these terms, you may not access the service.
          </p>

          <h2 className="text-lg font-bold text-white pt-2">Acceptable Use</h2>
          <p className="text-sm leading-relaxed">
            You agree not to use the service for any illegal purposes or to attempt unauthorized administrative actions, database scraping, or tampering with site security rules.
          </p>
        </div>
      )}
    </div>
  );
};
