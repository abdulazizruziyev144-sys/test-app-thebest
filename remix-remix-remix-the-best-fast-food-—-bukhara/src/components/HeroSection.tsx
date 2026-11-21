import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Star,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { HERO_SLIDES } from '../data/menu';
import { translate } from '../data/i18n';
import { Lang, RestaurantSettings } from '../types';
import { FoodImage } from './FoodImage';

interface HeroSectionProps {
  lang: Lang;
  settings: RestaurantSettings;
  isOpenNow: boolean;
  onReserveTable: () => void;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
const SLIDE_DURATION_MS = 6500;

export const HeroSection: React.FC<HeroSectionProps> = ({
  lang,
  settings,
  isOpenNow,
  onReserveTable,
}) => {
  const t = (k: string) => translate(lang, k);
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setSlideDir(1);
      setSlideIdx((prev) => (prev + 1) % HERO_SLIDES.length);
    }, SLIDE_DURATION_MS);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const goToSlide = (nextIdx: number) => {
    setSlideDir(nextIdx >= slideIdx ? 1 : -1);
    setSlideIdx(nextIdx);
  };

  const stepSlide = (delta: 1 | -1) => {
    setSlideDir(delta);
    setSlideIdx((prev) => (prev + delta + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const currentSlide = HERO_SLIDES[slideIdx];
  const compactFree = new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(settings.freeThreshold);

  return (
    <section
      id="top"
      className="relative overflow-hidden light-hero-bg -mt-[84px] sm:-mt-[90px] pt-[108px] sm:pt-[122px] border-b border-[#191919]/12"
    >
      {/* Clean Split Warm-Ivory & Soft-Cream Backdrop with Subtle Daylight Depth */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Right-hand soft cream split plane with subtle hairline division */}
        <div className="hidden lg:block absolute top-0 right-0 bottom-0 w-[44.5%] bg-gradient-to-b from-[#F5EFE3]/92 via-[#EFE6D6]/88 to-[#E9DEC9]/92">
          <div className="absolute inset-y-0 left-0 w-px bg-[#C99B3B]/20" />
        </div>

        {/* Soft architectural daylight glow illuminating the culinary showcase side */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 52% 60% at 74% 38%, rgba(255, 253, 248, 0.72) 0%, transparent 75%)',
          }}
        />
      </div>

      {/* Main Two-Column Editorial Composition */}
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-12 sm:pb-14 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 xl:gap-14 items-center">
          {/* LEFT COLUMN: Editorial Headline, Actions & Metrics Ledger */}
          <div className="lg:col-span-6 max-w-[530px] z-10">
            {/* Clean Unboxed Brand Eyebrow & Open Hours */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, delay: 0.04, ease: EASE_OUT_EXPO }}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-4 text-xs"
            >
              <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase text-[#9E6A0C]">
                {t("BUKHARA'S FAVOURITE")}
              </span>
              <span aria-hidden="true" className="text-[#191919]/25">·</span>
              <span
                className={`font-medium ${
                  isOpenNow ? 'text-[#9E6A0C]' : 'text-[#5C5346]'
                }`}
              >
                {isOpenNow ? t('Open now') : t('Closed now')}
              </span>
              <span aria-hidden="true" className="text-[#191919]/25">·</span>
              <span className="font-mono text-[11px] text-[#5C5346] tabular-nums">
                {settings.open}–{settings.close}
              </span>
            </motion.div>

            {/* Editorial Display + Italic Serif Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.44, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="text-[#191919] select-none [text-wrap:balance]"
            >
              <span
                className="flex flex-wrap items-baseline gap-x-3.5 leading-[0.9] tracking-[-0.035em]"
                style={{ fontSize: 'clamp(3.15rem, 5.1vw, 4.85rem)' }}
              >
                <span className="font-display font-extrabold uppercase text-[#191919]">
                  THE
                </span>
                <span className="font-editorial font-bold italic text-[#DF9212] tracking-[-0.025em]">
                  BEST
                </span>
              </span>
              <span
                className="block font-display font-extrabold uppercase tracking-[-0.035em] leading-[0.95] text-[#191919] mt-2"
                style={{ fontSize: 'clamp(2.9rem, 4.8vw, 4.55rem)' }}
              >
                FAST FOOD
              </span>
            </motion.h1>

            {/* Editorial Lead Prose */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.14, ease: EASE_OUT_EXPO }}
              className="mt-5 max-w-[430px] text-base sm:text-[17.5px] text-[#3D362D] leading-[1.64] font-normal"
            >
              {t('Delicious dishes, refined service, and unforgettable flavor — only with')}{' '}
              <strong className="font-semibold text-[#191919]">The Best!</strong>
            </motion.p>

            {/* Primary & Secondary CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.2, ease: EASE_OUT_EXPO }}
              className="mt-7 flex flex-wrap items-center gap-3.5"
            >
              <motion.a
                href="#menu"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                className="group h-[52px] pl-6 pr-2.5 inline-flex items-center justify-center gap-3 rounded-full bg-[#E9A92F] hover:bg-[#DF9A1B] text-[#191919] text-sm sm:text-[15px] font-bold transition-colors duration-150 whitespace-nowrap shrink-0 shadow-[0_14px_28px_-8px_rgba(196,130,12,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF6EE]"
              >
                <UtensilsCrossed className="w-4 h-4 shrink-0" />
                <span>{t('Order Now')}</span>
                <span className="w-8 h-8 rounded-full bg-[#191919] text-[#FAF6EE] flex items-center justify-center transition-transform duration-150 group-hover:translate-x-0.5">
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </span>
              </motion.a>

              <motion.a
                href="#full-menu-catalog"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                className="group h-[52px] px-6 sm:px-7 inline-flex items-center justify-center gap-2.5 rounded-full bg-[#FAF6EE]/95 hover:bg-[#191919] text-[#191919] hover:text-[#FAF6EE] border border-[#191919]/18 hover:border-[#191919] text-sm sm:text-[15px] font-semibold transition-colors duration-150 whitespace-nowrap shrink-0 shadow-[0_4px_14px_rgba(25,20,12,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF6EE]"
              >
                <Play className="w-3.5 h-3.5 fill-current shrink-0 transition-transform duration-150 group-hover:scale-110" />
                <span>{t('View Menu')}</span>
              </motion.a>
            </motion.div>

            {/* 3-Column Hospitality & Kitchen Metrics Ledger */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.26, ease: EASE_OUT_EXPO }}
              className="mt-8 pt-6 border-t border-[#191919]/12 grid grid-cols-3 gap-4 sm:gap-6 divide-x divide-[#191919]/12"
            >
              <div>
                <div className="flex items-center gap-1.5 font-display font-extrabold text-lg sm:text-xl text-[#191919] tabular-nums">
                  <span>4.8</span>
                  <Star className="w-3.5 h-3.5 fill-[#E9A92F] text-[#E9A92F]" />
                </div>
                <div className="text-[11.5px] text-[#5C5346] leading-snug mt-0.5">
                  {t('Trusted by 10,000+ customers')}
                </div>
              </div>

              <div className="pl-4 sm:pl-6">
                <div className="font-mono font-bold text-lg sm:text-xl text-[#B67A0E] tabular-nums">
                  {settings.etaMin}–{settings.etaMax}m
                </div>
                <div className="text-[11.5px] text-[#5C5346] leading-snug mt-0.5">
                  {t('Fast Delivery')}
                </div>
              </div>

              <div className="pl-4 sm:pl-6">
                <div className="font-display font-extrabold text-lg sm:text-xl text-[#191919] tabular-nums">
                  100%
                </div>
                <div className="text-[11.5px] text-[#5C5346] leading-snug mt-0.5">
                  {t('Freshly Made')}
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN: Monolithic Arched Culinary Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.48, delay: 0.1, ease: EASE_OUT_EXPO }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className="lg:col-span-6 relative"
          >
            <div className="group/arch relative mx-auto lg:ml-auto lg:mr-0 max-w-[492px] rounded-t-[260px] rounded-b-[20px] overflow-hidden bg-[#FAF6EE] border border-[#C99B3B]/32 shadow-[0_28px_64px_-22px_rgba(32,22,10,0.18)]">
              {/* Edge-to-Edge Arched Photography Viewport */}
              <div className="relative aspect-[1/1] w-full overflow-hidden bg-[#EAE0CE]">
                <AnimatePresence mode="wait" initial={false} custom={slideDir}>
                  <motion.div
                    key={currentSlide.id}
                    initial={{ opacity: 0, scale: 1.02, x: slideDir * 12 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.99, x: slideDir * -10 }}
                    transition={{ duration: 0.42, ease: EASE_OUT_EXPO }}
                    className="w-full h-full"
                  >
                    <FoodImage
                      src={currentSlide.img}
                      alt={t(currentSlide.title)}
                      priority
                      className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover/arch:scale-[1.02]"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Integrated Architectural Plinth Base */}
              <div className="bg-[#FAF6EE] border-t border-[#191919]/10">
                {/* Auto-Progress Hairline */}
                {!isPaused ? (
                  <motion.div
                    key={`progress-${slideIdx}`}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: SLIDE_DURATION_MS / 1000, ease: 'linear' }}
                    aria-hidden="true"
                    className="h-[2px] w-full origin-left bg-gradient-to-r from-[#E9A92F] via-[#DF9212] to-[#E9A92F]"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-[2px] w-full bg-[#E9A92F]/35"
                  />
                )}

                <div className="px-4 py-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-[#9E6A0C] tabular-nums">
                      0{slideIdx + 1} / 0{HERO_SLIDES.length}
                    </div>

                    <div className="overflow-hidden mt-0.5">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={currentSlide.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                          className="font-display font-bold text-sm sm:text-[15.5px] text-[#191919] truncate"
                        >
                          {t(currentSlide.title)}
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Carousel Switcher Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 pr-1.5">
                      {HERO_SLIDES.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => goToSlide(idx)}
                          aria-label={`Show slide ${idx + 1}`}
                          className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919] ${
                            idx === slideIdx
                              ? 'w-5 bg-[#E9A92F]'
                              : 'w-1.5 bg-[#191919]/20 hover:bg-[#191919]/50'
                          }`}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => stepSlide(-1)}
                      aria-label="Previous slide"
                      className="w-9 h-9 rounded-full border border-[#191919]/15 bg-white hover:bg-[#191919] hover:text-[#FAF6EE] text-[#191919] flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stepSlide(1)}
                      aria-label="Next slide"
                      className="w-9 h-9 rounded-full bg-[#191919] hover:bg-[#E9A92F] text-[#FAF6EE] hover:text-[#191919] flex items-center justify-center transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Hospitality 3-Column Bottom Concierge Bar */}
      <div className="relative z-10 border-t border-[#191919]/12 bg-[#EFE7D8]/94 backdrop-blur-md">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 sm:divide-x sm:divide-[#191919]/12">
          {/* Open Daily */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.3, ease: EASE_OUT_EXPO }}
            className="flex items-center sm:justify-center gap-3.5 sm:px-4"
          >
            <div className="w-10 h-10 rounded-full border border-[#C99B3B]/45 bg-[#FAF6EE] flex items-center justify-center text-[#B67A0E] shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-[#191919]">{t('Open Daily')}</div>
              <div className="text-xs font-mono text-[#5C5346] tabular-nums mt-0.5">
                {settings.open} – {settings.close}
              </div>
            </div>
          </motion.div>

          {/* Free Delivery */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.36, ease: EASE_OUT_EXPO }}
            className="flex items-center sm:justify-center gap-3.5 sm:px-4"
          >
            <div className="w-10 h-10 rounded-full border border-[#C99B3B]/45 bg-[#FAF6EE] flex items-center justify-center text-[#B67A0E] shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-[#191919]">{t('Free Delivery')}</div>
              <div className="text-xs text-[#5C5346] mt-0.5">
                {t('in Bukhara')} ·{' '}
                <span className="font-mono text-[#B67A0E] font-semibold tabular-nums">
                  {compactFree}+
                </span>
              </div>
            </div>
          </motion.div>

          {/* Reserve a Table */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.42, ease: EASE_OUT_EXPO }}
            className="flex items-center sm:justify-center sm:px-4"
          >
            <button
              type="button"
              onClick={onReserveTable}
              className="flex items-center gap-3.5 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#191919] rounded-full pr-2"
            >
              <div className="w-10 h-10 rounded-full border border-[#C99B3B]/45 bg-[#FAF6EE] group-hover:bg-[#E9A92F] group-hover:border-[#E9A92F] group-hover:text-[#191919] flex items-center justify-center text-[#B67A0E] transition-colors duration-150 shrink-0">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-bold text-[#191919] group-hover:text-[#9E6A0C] transition-colors duration-150">
                  {t('Reserve a Table')}
                </div>
                <div className="text-xs text-[#5C5346] mt-0.5">
                  {t('for Your Occasion')}
                </div>
              </div>
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
