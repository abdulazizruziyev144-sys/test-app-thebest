import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Compass,
  ExternalLink,
  Flame,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import { STORY_IMAGE } from '../data/menu';
import { translate } from '../data/i18n';
import { Lang, RestaurantSettings, Review } from '../types';
import { BrandLogo } from './BrandLogo';
import { BukharaStoreMap } from './BukharaStoreMap';
import { FoodImage } from './FoodImage';
import { LocaleSwitcher } from './LocaleSwitcher';

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface ReviewsAndVisitProps {
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  reviews: Review[];
  settings: RestaurantSettings;
  onSubmitReview: (payload: {
    name: string;
    category: Review['category'];
    rating: number;
    text: string;
  }) => Promise<void>;
}

const REVIEW_CATS: Array<{ id: Review['category']; label: string }> = [
  { id: 'combos', label: 'Combos' },
  { id: 'fast-food', label: 'Fast food' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
];

const WHY_CHOOSE_PILLARS = [
  {
    num: '01',
    icon: ShieldCheck,
    title: '100% Halal & Certified Beef',
    desc: 'Only fresh, chilled local beef and hand-picked farm vegetables delivered every morning.',
  },
  {
    num: '02',
    icon: Flame,
    title: '260°C Flame-Seared Precision',
    desc: 'High-heat flat-top searing locks in juices while creating an unmistakable caramelized crust.',
  },
  {
    num: '03',
    icon: Sparkles,
    title: 'Hand-Rolled Lavash & Brioche',
    desc: 'Warm toasted brioche buns and thin artisan flatbread rolled fresh for every single order.',
  },
  {
    num: '04',
    icon: Truck,
    title: 'Swift Dispatch Across Bukhara',
    desc: 'Insulated thermal packaging keeps burgers hot and fries crisp from our kitchen to your door.',
  },
];

export const ReviewsAndVisit: React.FC<ReviewsAndVisitProps> = ({
  lang,
  onChangeLang,
  reviews,
  settings,
  onSubmitReview,
}) => {
  const t = (k: string) => translate(lang, k);
  const [filterCat, setFilterCat] = useState<'all' | Review['category']>('all');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Review['category'] | ''>('');
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [resolvedAddress, setResolvedAddress] = useState('THE BEST, Bukhara, Uzbekistan');
  const [storeCoords, setStoreCoords] = useState<{ lat: number; lng: number }>({
    lat: 39.7559636,
    lng: 64.4261603,
  });
  const [groundingQuery, setGroundingQuery] = useState('');
  const [groundingBusy, setGroundingBusy] = useState(false);
  const [groundingError, setGroundingError] = useState('');
  const [groundingResult, setGroundingResult] = useState<{
    text: string;
    places: Array<{
      title: string;
      uri: string;
      reviewSnippets: Array<{ text: string; uri?: string }>;
    }>;
  } | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const runMapsGrounding = async (queryText: string) => {
    const clean = queryText.trim();
    if (clean.length < 3) return;
    setGroundingBusy(true);
    setGroundingError('');
    try {
      const coords = userCoords || storeCoords;
      const res = await fetch('/api/maps/grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: clean,
          lat: coords.lat,
          lng: coords.lng,
          lang,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not retrieve live Google Maps information.');
      }
      setGroundingResult({
        text: String(data.text || ''),
        places: Array.isArray(data.places) ? data.places : [],
      });
    } catch (err) {
      setGroundingError(err instanceof Error ? err.message : 'Maps grounding failed.');
    } finally {
      setGroundingBusy(false);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGroundingError('Geolocation is not supported in this browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGroundingError('');
      },
      () => {
        setGroundingError('Location permission was denied. Using THE BEST, Bukhara instead.');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const visibleReviews = useMemo(() => {
    return reviews
      .filter((r) => filterCat === 'all' || r.category === filterCat)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [reviews, filterCat]);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setSubmitting(true);
    setReviewMsg(null);
    try {
      await onSubmitReview({
        name: name.trim(),
        category,
        rating: Number(rating),
        text: text.trim(),
      });
      setName('');
      setCategory('');
      setRating('5');
      setText('');
      setReviewMsg({ type: 'ok', text: 'Thank you! Your review was submitted for moderation.' });
    } catch (err) {
      setReviewMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not submit review.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Why Choose Us */}
      <section className="py-20 bg-[#FAFAFA] border-b border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-12"
          >
            <div>
              <div className="inline-flex items-center gap-2.5 text-[11px] font-mono font-bold tracking-[0.22em] uppercase text-[#111111] mb-2">
                <span className="h-[2px] w-7 bg-[#F2B01E]" aria-hidden="true" />
                <span>THE BEST · BUKHARA STANDARD</span>
              </div>
              <h2 className="font-display font-extrabold italic text-3xl sm:text-5xl text-[#111111] tracking-tight">
                {t('Why choose us')}
              </h2>
            </div>
            <p className="text-sm sm:text-base text-neutral-600 max-w-md">
              {t('Crafted in Bukhara for true connoisseurs of taste.')}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY_CHOOSE_PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.num}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.38, delay: idx * 0.055, ease: EASE_OUT_EXPO }}
                  whileHover={{ y: -3, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
                  className="bg-white border border-neutral-200 hover:border-[#F2B01E] rounded-[24px] p-6 flex flex-col justify-between gap-5 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.05)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-[#E5A210] shadow-2xs">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-bold text-[#9E7000]">
                      {pillar.num}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-[#111111] leading-snug">
                      {t(pillar.title)}
                    </h3>
                    <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                      {t(pillar.desc)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Our Story (About Us) */}
      <section id="story" className="py-20 bg-white border-b border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.44, ease: EASE_OUT_EXPO }}
            className="lg:col-span-6 aspect-[4/3] rounded-[26px] overflow-hidden border border-neutral-200 bg-[#FAFAFA] shadow-[0_14px_36px_rgba(0,0,0,0.06)]"
          >
            <FoodImage src={STORY_IMAGE} alt="THE BEST FAST FOOD bright kitchen in Bukhara" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{ duration: 0.44, delay: 0.08, ease: EASE_OUT_EXPO }}
            className="lg:col-span-6 space-y-5"
          >
            <div className="inline-flex items-center gap-2.5 text-[11px] font-mono font-bold tracking-[0.22em] uppercase text-[#111111]">
              <span className="h-[2px] w-7 bg-[#F2B01E]" aria-hidden="true" />
              <span>{t('Our story')} · Bukhara</span>
            </div>
            <h2 className="font-display font-extrabold italic text-3xl sm:text-5xl text-[#111111] tracking-tight leading-tight">
              {t('Local heart. Street soul.')}
            </h2>
            <p className="text-base text-neutral-600 leading-relaxed">
              THE BEST FAST FOOD is a Bukhara neighbourhood kitchen built around fast, generous food. We toast every brioche bun, sear patties crisp on the flat top, roll every lavash to order, and keep our sauces bold.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-wider text-neutral-600">
              <span className="text-[#9E7000] font-bold">{t('100% Halal')}</span>
              <span aria-hidden="true" className="text-neutral-300">·</span>
              <span>{t('Fresh Daily')}</span>
              <span aria-hidden="true" className="text-neutral-300">·</span>
              <span>{t('Made in Bukhara')}</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Guest Reviews */}
      <section id="reviews" className="py-20 bg-[#FAFAFA] border-b border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-10"
          >
            <div>
              <div className="inline-flex items-center gap-2.5 text-[11px] font-mono font-bold tracking-[0.22em] uppercase text-[#111111] mb-2">
                <span className="h-[2px] w-7 bg-[#F2B01E]" aria-hidden="true" />
                <span>{t('From the table')}</span>
              </div>
              <h2 className="font-display font-extrabold italic text-3xl sm:text-5xl text-[#111111] tracking-tight">
                {t('Good food. Real opinions.')}
              </h2>
            </div>
            <p className="text-sm sm:text-base text-neutral-600 max-w-md">
              Verified guest ratings across every menu category in Bukhara.
            </p>
          </motion.div>

          {/* 4 Category Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {REVIEW_CATS.map((cat, idx) => {
              const matching = reviews.filter((r) => r.category === cat.id);
              const avg = matching.length
                ? matching.reduce((s, r) => s + r.rating, 0) / matching.length
                : 0;
              return (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.36, delay: idx * 0.05, ease: EASE_OUT_EXPO }}
                  className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                >
                  <div className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500">
                    {t(cat.label)}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-display font-extrabold text-2xl text-[#111111] tabular-nums">
                      {matching.length ? avg.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-neutral-500 tabular-nums">
                      {matching.length ? `/ 5 · ${matching.length} reviews` : 'No reviews yet'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-0.5 text-[#F2B01E]">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < Math.round(avg) ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-neutral-200'
                        }`}
                      />
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Filter + Reviews Grid + Submission Form */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterCat('all')}
                  className={`h-9 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    filterCat === 'all'
                      ? 'bg-[#F2B01E] text-[#111111] font-bold shadow-2xs'
                      : 'bg-white border border-neutral-200 text-neutral-600 hover:text-[#111111] hover:border-[#F2B01E]'
                  }`}
                >
                  {t('All')}
                </button>
                {REVIEW_CATS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setFilterCat(c.id)}
                    className={`h-9 px-4 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                      filterCat === c.id
                        ? 'bg-[#F2B01E] text-[#111111] font-bold shadow-2xs'
                        : 'bg-white border border-neutral-200 text-neutral-600 hover:text-[#111111] hover:border-[#F2B01E]'
                    }`}
                  >
                    {t(c.label)}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {visibleReviews.map((r, idx) => (
                  <motion.article
                    key={`${filterCat}-${r.id}`}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.08 }}
                    transition={{ duration: 0.35, delay: (idx % 2) * 0.05, ease: EASE_OUT_EXPO }}
                    className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-[0_4px_16px_rgba(0,0,0,0.04)]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-semibold text-sm text-[#111111]">{r.name}</div>
                          <div className="text-xs text-neutral-500 flex items-center gap-1.5">
                            <span>{t(REVIEW_CATS.find((c) => c.id === r.category)?.label || r.category)}</span>
                            <span aria-hidden="true">·</span>
                            <time dateTime={r.createdAt}>
                              {new Date(r.createdAt).toLocaleDateString()}
                            </time>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 text-[#F2B01E] shrink-0">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`w-3.5 h-3.5 ${
                                idx < r.rating ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-neutral-200'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-neutral-600 leading-relaxed">{r.text}</p>
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>

            {/* Leave a Review Form */}
            <motion.form
              onSubmit={handleReviewSubmit}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.4, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="lg:col-span-5 bg-white border border-neutral-200 rounded-[24px] p-6 space-y-4 h-fit shadow-[0_6px_22px_rgba(0,0,0,0.05)]"
            >
              <div>
                <h3 className="font-display font-bold text-xl text-[#111111]">
                  {t('Leave a review')}
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Reviews appear after quick owner moderation.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#111111]">Your name</span>
                  <input
                    required
                    minLength={2}
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jasur A."
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-xs font-semibold text-[#111111]">Category</span>
                    <select
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Review['category'])}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                    >
                      <option value="">Choose…</option>
                      {REVIEW_CATS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {t(c.label)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-[#111111]">Rating</span>
                    <select
                      required
                      value={rating}
                      onChange={(e) => setRating(e.target.value)}
                      className="mt-1 w-full h-10 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                    >
                      <option value="5">5 — Loved it</option>
                      <option value="4">4 — Really good</option>
                      <option value="3">3 — Good</option>
                      <option value="2">2 — Fair</option>
                      <option value="1">1 — Needs work</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold text-[#111111]">Your review</span>
                  <textarea
                    required
                    minLength={10}
                    maxLength={500}
                    rows={3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What stood out on your order?"
                    className="mt-1 w-full p-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
                  />
                </label>
              </div>

              {reviewMsg && (
                <p
                  className={`text-xs font-semibold ${
                    reviewMsg.type === 'ok' ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {reviewMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] disabled:opacity-50 text-[#111111] text-sm font-bold transition-colors cursor-pointer"
              >
                {submitting ? 'Submitting…' : t('Post review')}
              </button>
            </motion.form>
          </div>
        </div>
      </section>

      {/* Visit & Contact Section */}
      <section id="visit" className="py-20 bg-white">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div>
              <div className="inline-flex items-center gap-2.5 text-[11px] font-mono font-bold tracking-[0.22em] uppercase text-[#111111] mb-2">
                <span className="h-[2px] w-7 bg-[#F2B01E]" aria-hidden="true" />
                <span>{t('Contact')}</span>
              </div>
              <h2 className="font-display font-extrabold italic text-3xl sm:text-4xl text-[#111111] tracking-tight">
                {t('Find us in Bukhara')}
              </h2>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500">
                Location & Hours
              </div>
              <p className="font-semibold text-[#111111] flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#E5A210] shrink-0" />
                <span>{resolvedAddress}</span>
              </p>
              <p className="text-neutral-600 tabular-nums">
                Daily · {settings.open}–{settings.close} (Delivery until 05:00)
              </p>
            </div>

            <div className="space-y-1.5 text-sm">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-500">
                Direct Line & Map
              </div>
              <p>
                <a
                  href="tel:+998652228989"
                  className="font-semibold text-[#111111] hover:text-[#9E7000] inline-flex items-center gap-1.5 tabular-nums transition-colors"
                >
                  <Phone className="w-4 h-4 text-[#E5A210]" />
                  <span>+998 (65) 222-89-89 · Short code 1087</span>
                </a>
              </p>
              <p>
                <a
                  href="https://maps.app.goo.gl/oXXdrwXF1V3RUzyn7"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-[#9E7000] hover:underline inline-flex items-center gap-1"
                >
                  <span>{t('Open in Maps ↗')}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.42, ease: EASE_OUT_EXPO }}
            className="rounded-[24px] overflow-hidden border border-neutral-200 bg-[#FAFAFA] shadow-xs"
          >
            <BukharaStoreMap
              lang={lang}
              onAddressResolved={(addr, coords) => {
                setResolvedAddress(addr);
                if (coords) setStoreCoords(coords);
              }}
            />
          </motion.div>

          {/* Live Bukhara Neighborhood & Delivery Guide (Gemini Maps Grounding) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.42, delay: 0.06, ease: EASE_OUT_EXPO }}
            className="rounded-[24px] border border-neutral-200 bg-white p-5 sm:p-6 space-y-4 shadow-[0_6px_22px_rgba(0,0,0,0.04)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-mono font-bold tracking-widest uppercase text-[#9E7000] flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>Google Maps Grounding</span>
                </p>
                <h3 className="font-display font-bold text-xl text-[#111111] mt-0.5">
                  Explore Nearby Spots in Bukhara
                </h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Ask for up-to-date nearby landmarks, parking, or walking directions around THE BEST in Bukhara.
                </p>
              </div>
              <button
                type="button"
                onClick={handleUseMyLocation}
                className={`h-9 px-3.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  userCoords
                    ? 'border-[#F2B01E] bg-white ring-2 ring-[#F2B01E]/30 text-[#111111]'
                    : 'border-neutral-200 bg-white text-[#111111] hover:border-[#F2B01E] hover:bg-[#FAFAFA]'
                }`}
              >
                <LocateFixed className="w-3.5 h-3.5 text-[#E5A210]" />
                <span>{userCoords ? 'Using your location' : 'Use my location'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                'Landmarks and attractions near THE BEST in Bukhara',
                'Where can I park near THE BEST in Bukhara?',
                'Popular cafes and shops near THE BEST in Bukhara',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={groundingBusy}
                  onClick={() => {
                    setGroundingQuery(preset);
                    runMapsGrounding(preset);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border border-neutral-200 bg-white hover:border-[#F2B01E] hover:bg-[#FAFAFA] text-xs font-medium text-neutral-600 hover:text-[#111111] transition-colors cursor-pointer disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runMapsGrounding(groundingQuery);
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  value={groundingQuery}
                  onChange={(e) => setGroundingQuery(e.target.value)}
                  maxLength={300}
                  placeholder="Ask about nearby landmarks, parking, or walking routes in Bukhara…"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
                />
              </div>
              <button
                type="submit"
                disabled={groundingBusy || groundingQuery.trim().length < 3}
                className="h-10 px-5 rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] disabled:opacity-50 text-[#111111] text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap transition-colors"
              >
                {groundingBusy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching Maps…</span>
                  </>
                ) : (
                  <span>Ask Maps Guide</span>
                )}
              </button>
            </form>

            {groundingError && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {groundingError}
              </p>
            )}

            {groundingResult && (
              <div className="rounded-2xl bg-[#FAFAFA] border border-neutral-200 p-4 space-y-3">
                <div className="text-sm text-[#111111] whitespace-pre-line leading-relaxed">
                  {groundingResult.text}
                </div>

                {groundingResult.places.length > 0 && (
                  <div className="pt-3 border-t border-neutral-200 space-y-2">
                    <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-neutral-500">
                      Verified Google Maps Sources
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {groundingResult.places.map((pl, idx) => (
                        <div
                          key={`${pl.uri}-${idx}`}
                          className="rounded-xl bg-white border border-neutral-200 p-2.5 space-y-1"
                        >
                          <a
                            href={pl.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[#9E7000] hover:underline inline-flex items-center gap-1"
                          >
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-[#E5A210]" />
                            <span>{pl.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {pl.reviewSnippets.slice(0, 1).map((sn, sIdx) => (
                            <p key={sIdx} className="text-[11px] text-neutral-600 line-clamp-2">
                              “{sn.text}”
                              {sn.uri && (
                                <a
                                  href={sn.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-[#9E7000] hover:underline"
                                >
                                  Review ↗
                                </a>
                              )}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Clean Off-White & Golden Editorial Footer */}
      <footer className="bg-[#FAFAFA] text-[#111111] py-12 border-t border-neutral-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <BrandLogo variant="light" showSubtitle size="md" />
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-neutral-600">
            <a href="#top" className="hover:text-[#111111] transition-colors">
              {t('Home')}
            </a>
            <a href="#menu" className="hover:text-[#111111] transition-colors">
              {t('Menu')}
            </a>
            <a href="#combo-builder" className="hover:text-[#111111] transition-colors">
              {t('Combo Builder')}
            </a>
            <a href="#story" className="hover:text-[#111111] transition-colors">
              {t('About')}
            </a>
            <a href="#visit" className="hover:text-[#111111] transition-colors">
              {t('Contact')}
            </a>
            <LocaleSwitcher lang={lang} onChangeLang={onChangeLang} variant="light" />
            <span className="text-neutral-500">© 2026 THE BEST FAST FOOD · {t('Bukhara')}</span>
          </div>
        </div>
      </footer>
    </>
  );
};
