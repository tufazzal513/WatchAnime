import React from 'react';

interface AdBannerProps {
  placement: 'top' | 'bottom';
  adCode?: string;
  enabled?: boolean;
}

export const AdBanner: React.FC<AdBannerProps> = ({ placement, adCode, enabled }) => {
  if (!enabled) return null;

  return (
    <div className="w-full max-w-5xl mx-auto my-6 px-4">
      <div className="relative rounded-lg bg-neutral-900/40 border border-dashed border-white/10 p-3 flex flex-col items-center justify-center text-center overflow-hidden min-h-[90px]">
        <span className="absolute top-1 right-2 text-[9px] uppercase tracking-wider text-neutral-500 font-semibold">
          Sponsored
        </span>
        {adCode ? (
          <div
            className="w-full flex items-center justify-center"
            dangerouslySetInnerHTML={{ __html: adCode }}
          />
        ) : (
          <div className="py-2 text-xs text-neutral-500">
            Ad Space ({placement.toUpperCase()} BANNER 728x90 / 300x250) - Manage in Admin Panel
          </div>
        )}
      </div>
    </div>
  );
};
