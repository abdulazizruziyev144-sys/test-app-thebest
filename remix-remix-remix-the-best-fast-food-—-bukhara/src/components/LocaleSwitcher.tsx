import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Globe } from 'lucide-react';
import { SUPPORTED_LOCALES } from '../context/LocaleContext';
import { Lang } from '../types';

interface LocaleSwitcherProps {
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  variant?: 'light' | 'dark';
  mode?: 'segmented' | 'dropdown';
}

export const LocaleSwitcher: React.FC<LocaleSwitcherProps> = ({
  lang,
  onChangeLang,
  variant = 'light',
  mode = 'segmented',
}) => {
  const isLight = variant === 'light';
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [menuOpen]);

  if (mode === 'dropdown') {
    const activeLoc = SUPPORTED_LOCALES.find((l) => l.code === lang) || SUPPORTED_LOCALES[0];
    return (
      <div ref={containerRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label="Language switcher"
          className={`h-9 px-2.5 inline-flex items-center gap-1.5 rounded-full text-xs sm:text-[13px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            isLight
              ? 'bg-white text-[#111111] hover:bg-[#FAFAFA] border border-neutral-200 hover:border-[#F2B01E]'
              : 'text-white/90 hover:text-[#F2B01E] hover:bg-white/5'
          }`}
        >
          <Globe className={`w-4 h-4 shrink-0 ${isLight ? 'text-neutral-600' : 'text-white/80'}`} />
          <span>{activeLoc.label}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isLight ? 'text-neutral-600' : 'text-white/70'
            } ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Select language"
            className={`absolute right-0 mt-2 w-36 rounded-xl border shadow-xl p-1 z-50 ${
              isLight
                ? 'bg-white border-neutral-200'
                : 'bg-[#191919] border-[#F2B01E]/25'
            }`}
          >
            {SUPPORTED_LOCALES.map((loc) => {
              const active = lang === loc.code;
              return (
                <button
                  key={loc.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onChangeLang(loc.code);
                    setMenuOpen(false);
                  }}
                  className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#F2B01E] text-[#111111] font-bold'
                      : isLight
                        ? 'text-neutral-600 hover:bg-[#FAFAFA] hover:text-[#111111]'
                        : 'text-neutral-300 hover:bg-[#25221E] hover:text-white'
                  }`}
                >
                  <span>{loc.nativeName}</span>
                  <span className="font-mono text-[11px] flex items-center gap-1">
                    {loc.label}
                    {active && <Check className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Language switcher"
      className={`inline-flex items-center p-0.5 sm:p-1 rounded-xl border shrink-0 ${
        isLight
          ? 'bg-white border-neutral-200'
          : 'bg-[#191919] border-[#F2B01E]/18'
      }`}
    >
      {SUPPORTED_LOCALES.map((loc) => {
        const active = lang === loc.code;
        return (
          <button
            key={loc.code}
            type="button"
            onClick={() => onChangeLang(loc.code)}
            aria-pressed={active}
            title={loc.nativeName}
            className={`h-7 sm:h-8 px-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              active
                ? 'bg-[#F2B01E] text-[#111111] font-bold'
                : isLight
                  ? 'text-neutral-600 hover:text-[#111111]'
                  : 'text-neutral-300 hover:text-white'
            }`}
          >
            {loc.label}
          </button>
        );
      })}
    </div>
  );
};
