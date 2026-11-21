import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  Bell,
  Heart,
  LogIn,
  LogOut,
  Menu,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingCart,
  X,
} from 'lucide-react';
import { FulfillmentMode, Lang, UserProfile } from '../types';
import { translate } from '../data/i18n';
import { BrandLogo } from './BrandLogo';
import { LocaleSwitcher } from './LocaleSwitcher';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  mode: FulfillmentMode;
  dineInTable: string;
  cartCount: number;
  favoritesCount: number;
  unreadNotifications: number;
  userProfile: UserProfile | null;
  authBusy: boolean;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onOpenQrScanner: () => void;
  onOpenCart: () => void;
  onOpenOrders: () => void;
  onOpenRewards: () => void;
  onOpenAdmin: () => void;
  onReserveTable: () => void;
  onSelectFavorites: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onChangeLang,
  mode,
  dineInTable,
  cartCount,
  favoritesCount,
  unreadNotifications,
  userProfile,
  authBusy,
  onSignInGoogle,
  onSignOutGoogle,
  onOpenQrScanner,
  onOpenCart,
  onOpenOrders,
  onOpenRewards,
  onOpenAdmin,
  onReserveTable,
  onSelectFavorites,
}) => {
  const t = (k: string) => translate(lang, k);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState('#menu');

  useEffect(() => {
    const sectionIds = ['top', 'menu', 'combo-builder', 'story', 'visit'];
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#full-menu-catalog' || hash === '#top') {
        setActiveHref('#menu');
      } else if (sectionIds.some((id) => `#${id}` === hash)) {
        setActiveHref(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) {
          setActiveHref(visible.target.id === 'top' ? '#menu' : `#${visible.target.id}`);
        }
      },
      { rootMargin: '-35% 0px -50% 0px', threshold: [0.1, 0.35] }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => {
      window.removeEventListener('hashchange', handleHash);
      observer.disconnect();
    };
  }, []);

  const jumpToSearch = () => {
    const target = document.getElementById('full-menu-catalog') || document.getElementById('menu');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      const input = document.getElementById('menu-search-input') as HTMLInputElement | null;
      input?.focus({ preventScroll: true });
    }, 350);
  };

  const navItems: Array<{ href: string; label: string; isAction?: boolean }> = [
    { href: '#menu', label: t('Menu') },
    { href: '#story', label: t('About') },
    { href: '#combo-builder', label: t('Combo Builder') },
    { href: '#reserve', label: t('Reserve a Table'), isAction: true },
    { href: '#visit', label: t('Contact') },
  ];

  return (
    <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3 pb-2 pointer-events-none">
      <div className="max-w-[1320px] mx-auto pointer-events-auto">
        <div className="bg-[#FAF8F3]/90 backdrop-blur-xl border border-[#191919]/10 rounded-full px-3.5 sm:px-5 h-[64px] sm:h-[70px] flex items-center justify-between gap-2 sm:gap-3 min-w-0 shadow-[0_10px_32px_rgba(25,25,25,0.08)]">
          {/* Left: THE BEST Signature Logo + Subtle Divider */}
          <div className="flex items-center gap-3.5 shrink-0">
            <a
              href="#top"
              onClick={() => setActiveHref('#menu')}
              aria-label="THE BEST FAST FOOD home"
              className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E9A92F] rounded-xl shrink-0"
            >
              <BrandLogo variant="light" size="sm" />
            </a>
            <span aria-hidden="true" className="hidden lg:block w-px h-6 bg-[#191919]/12" />
          </div>

          {/* Center: Clean Single-Line Navigation Links with Gold Underline */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex items-center justify-center gap-5 xl:gap-7 text-[13px] xl:text-[14px] font-medium min-w-0"
          >
            {navItems.map((item) => {
              const active = activeHref === item.href;
              if (item.isAction) {
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={onReserveTable}
                    className="relative py-2 whitespace-nowrap shrink-0 text-[#5C5346] hover:text-[#191919] transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                );
              }
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setActiveHref(item.href)}
                  className={`relative py-2 whitespace-nowrap shrink-0 transition-colors ${
                    active ? 'text-[#191919] font-semibold' : 'text-[#5C5346] hover:text-[#191919]'
                  }`}
                >
                  <span>{item.label}</span>
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#E9A92F]"
                    />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Right: Search Icon, Compact Utilities, Divider, Golden Order Now / Cart CTA */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={jumpToSearch}
              title={t('Search the menu…')}
              aria-label={t('Search the menu…')}
              className="h-9 w-9 hidden sm:inline-flex items-center justify-center rounded-full border border-[#191919]/12 bg-white text-[#191919] hover:text-[#B67A0E] hover:border-[#E9A92F] transition-colors cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4 shrink-0" />
            </button>

            <button
              type="button"
              onClick={onOpenOrders}
              title={t('Your orders')}
              aria-label={t('Your orders')}
              className="relative h-9 w-9 hidden sm:inline-flex items-center justify-center rounded-full text-[#5C5346] hover:text-[#191919] hover:bg-[#F2EDE3] transition-colors cursor-pointer shrink-0"
            >
              {unreadNotifications > 0 ? (
                <Bell className="w-4 h-4 text-[#D8961D]" />
              ) : (
                <ReceiptText className="w-4 h-4" />
              )}
              {unreadNotifications > 0 && (
                <span className="absolute top-0.5 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E9A92F] text-[#191919] text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenQrScanner}
              title={
                mode === 'dine-in' && dineInTable
                  ? `${t('Dine-in')} #${dineInTable}`
                  : t('Scan Table QR')
              }
              aria-label={t('Scan Table QR')}
              className={`h-9 px-2 hidden xl:inline-flex items-center justify-center gap-1 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                mode === 'dine-in'
                  ? 'bg-[#E9A92F]/20 text-[#191919] border border-[#E9A92F]'
                  : 'text-[#5C5346] hover:text-[#191919] hover:bg-[#F2EDE3]'
              }`}
            >
              <QrCode className="w-4 h-4 shrink-0" />
              {mode === 'dine-in' && dineInTable && <span>#{dineInTable}</span>}
            </button>

            <button
              type="button"
              onClick={onSelectFavorites}
              title={t('Favorites')}
              aria-label={`${t('Favorites')} (${favoritesCount})`}
              className="relative h-9 w-9 hidden 2xl:inline-flex items-center justify-center rounded-full text-[#5C5346] hover:text-[#191919] hover:bg-[#F2EDE3] transition-colors cursor-pointer shrink-0"
            >
              <Heart className="w-4 h-4" />
              {favoritesCount > 0 && (
                <span className="absolute top-0.5 right-0 min-w-[16px] h-[16px] px-1 rounded-full bg-[#E9A92F] text-[#191919] text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {favoritesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onOpenRewards}
              title={t('The Best Rewards')}
              aria-label={t('The Best Rewards')}
              className="h-9 w-9 hidden 2xl:inline-flex items-center justify-center rounded-full text-[#5C5346] hover:text-[#191919] hover:bg-[#F2EDE3] transition-colors cursor-pointer shrink-0"
            >
              <Award className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenAdmin}
              title={`${t('Admin')} / ${t('Kitchen')}`}
              aria-label={`${t('Admin')} / ${t('Kitchen')}`}
              className="h-9 w-9 hidden md:inline-flex items-center justify-center rounded-full text-[#5C5346] hover:text-[#191919] hover:bg-[#F2EDE3] transition-colors cursor-pointer shrink-0"
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            <PWAInstallButton compact />

            {userProfile ? (
              <div className="hidden sm:inline-flex items-center gap-1 h-9 pl-1 pr-1 rounded-full bg-white border border-[#191919]/12 shrink-0">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName || 'Account'}
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 rounded-full object-cover border border-[#E9A92F]"
                  />
                ) : (
                  <span className="w-6 h-6 rounded-full bg-[#E9A92F] text-[#191919] text-[11px] font-bold flex items-center justify-center">
                    {(userProfile.displayName || userProfile.email || 'U').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  title={t('Sign out')}
                  aria-label={t('Sign out')}
                  className="p-1 text-[#5C5346] hover:text-[#191919] transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                disabled={authBusy}
                title="Sign in with Google"
                aria-label="Sign in with Google"
                className="h-9 w-9 hidden xl:inline-flex items-center justify-center rounded-full text-[#5C5346] hover:text-[#191919] hover:bg-[#F2EDE3] disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              >
                <LogIn className="w-4 h-4 shrink-0" />
              </button>
            )}

            <div className="hidden sm:flex shrink-0">
              <LocaleSwitcher lang={lang} onChangeLang={onChangeLang} variant="light" mode="dropdown" />
            </div>

            <span aria-hidden="true" className="hidden sm:block w-px h-5 bg-[#191919]/12 mx-0.5" />

            {/* Golden Signature Order Now / Cart Pill CTA */}
            <button
              type="button"
              onClick={onOpenCart}
              aria-label={`${t('Order Now')}, ${t('Cart')}: ${cartCount}`}
              className="relative h-9 sm:h-10 px-3.5 sm:px-4.5 inline-flex items-center justify-center gap-2 rounded-full bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-xs sm:text-[13px] font-bold transition-all duration-150 cursor-pointer shrink-0 whitespace-nowrap shadow-[0_8px_20px_rgba(233,169,47,0.32)]"
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t('Order Now')}</span>
              {cartCount > 0 ? (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#191919] text-[#FAF8F3] text-[10px] font-mono font-bold flex items-center justify-center tabular-nums">
                  {cartCount}
                </span>
              ) : (
                <ArrowRight className="w-3.5 h-3.5 hidden sm:inline shrink-0" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
              className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-full border border-[#191919]/14 bg-white text-[#191919] hover:border-[#E9A92F] transition-colors cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Dedicated Responsive Light Mobile Navigation Sheet */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-2 bg-[#FAF8F3]/98 backdrop-blur-xl border border-[#191919]/12 rounded-2xl p-4 shadow-[0_20px_48px_rgba(25,25,25,0.14)] space-y-4">
            <nav aria-label="Mobile drawer navigation" className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                if (item.isAction) {
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onReserveTable();
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-white border border-[#191919]/10 hover:border-[#E9A92F] text-sm font-semibold text-[#191919] text-left cursor-pointer transition-colors"
                    >
                      {item.label}
                    </button>
                  );
                }
                const active = activeHref === item.href;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      setActiveHref(item.href);
                      setMobileMenuOpen(false);
                    }}
                    className={`px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#E9A92F] border-[#E9A92F] text-[#191919] font-bold'
                        : 'bg-white border-[#191919]/10 hover:border-[#E9A92F] text-[#191919]'
                    }`}
                  >
                    {item.label}
                  </a>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenRewards();
                }}
                className="px-3.5 py-2.5 rounded-xl bg-white border border-[#191919]/10 hover:border-[#E9A92F] text-sm font-semibold text-[#191919] text-left cursor-pointer transition-colors"
              >
                {t('The Best Rewards')}
              </button>
            </nav>

            <div className="pt-3 border-t border-[#191919]/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenQrScanner();
                  }}
                  className="h-9 px-3 rounded-xl bg-white border border-[#191919]/10 text-xs font-semibold text-[#191919] hover:border-[#E9A92F] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-[#D8961D]" />
                  <span>{t('Scan Table QR')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAdmin();
                  }}
                  className="h-9 px-3 rounded-xl bg-white border border-[#191919]/10 text-xs font-semibold text-[#191919] hover:border-[#E9A92F] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D8961D]" />
                  <span>{t('Admin')}</span>
                </button>
                {!userProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onSignInGoogle();
                    }}
                    className="sm:hidden h-9 px-3 rounded-xl bg-white border border-[#191919]/10 text-xs font-semibold text-[#191919] hover:border-[#E9A92F] inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-[#D8961D]" />
                    <span>Google</span>
                  </button>
                )}
              </div>
              <div className="sm:hidden">
                <LocaleSwitcher lang={lang} onChangeLang={onChangeLang} variant="light" />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
