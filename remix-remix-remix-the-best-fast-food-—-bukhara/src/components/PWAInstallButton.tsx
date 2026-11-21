import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Install THE BEST App"
        aria-label="Install THE BEST App"
        className={
          compact
            ? 'h-9 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white text-[#111111] hover:border-[#F2B01E] hover:bg-[#FAFAFA] text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs'
            : 'h-10 px-4 inline-flex items-center gap-2 rounded-full bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-xs font-bold transition-colors cursor-pointer shadow-xs whitespace-nowrap'
        }
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className={compact ? 'hidden 2xl:inline' : ''}>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Install on iPhone / iPad"
          aria-label="Install on iPhone / iPad"
          className="h-9 px-2.5 inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white text-[#111111] hover:border-[#F2B01E] hover:bg-[#FAFAFA] text-xs font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span className={compact ? 'hidden 2xl:inline' : ''}>Install App</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Install on iPhone or iPad"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4"
          >
            <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-200 p-6 shadow-2xl text-[#111111] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-[#111111]">Install THE BEST App</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="w-8 h-8 rounded-lg border border-neutral-200 bg-white flex items-center justify-center text-neutral-600 hover:text-[#111111] hover:border-[#F2B01E] cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                1. Tap the <strong className="text-[#111111]">Share</strong> icon in your Safari toolbar.
                <br />
                2. Scroll down and tap <strong className="text-[#111111]">Add to Home Screen</strong>.
                <br />
                3. Tap <strong className="text-[#111111]">Add</strong> for instant full-screen ordering in Bukhara.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full h-10 rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-sm font-bold transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-18 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-white text-[#111111] border border-[#F2B01E] px-3.5 py-2 text-xs font-semibold shadow-xl"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#E5A210] shrink-0" />
      <span>Offline Mode — Cached menu is available</span>
    </div>
  );
};
