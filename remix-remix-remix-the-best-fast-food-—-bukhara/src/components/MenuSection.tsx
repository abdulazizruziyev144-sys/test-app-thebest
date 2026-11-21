import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronRight, Crown, Heart, Plus, SlidersHorizontal } from 'lucide-react';
import { CATEGORIES, DIET_FILTERS } from '../data/menu';
import { translate } from '../data/i18n';
import { formatMoney } from '../lib/calculations';
import { CategoryId, DietFilter, Lang, MenuItem } from '../types';
import { FoodImage } from './FoodImage';
import { MenuSearchBar } from './MenuSearchBar';

interface MenuSectionProps {
  lang: Lang;
  menuItems: MenuItem[];
  favorites: string[];
  activeCategory: CategoryId;
  onChangeCategory: (cat: CategoryId) => void;
  onToggleFavorite: (id: string) => void;
  onCustomize: (item: MenuItem) => void;
  onQuickAdd: (item: MenuItem) => void;
}

type SortOption = 'featured' | 'price-low' | 'price-high' | 'name';

const FEATURED_SHOWCASE_IDS = ['f3', 'c1', 'f1', 's1'] as const;
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const MenuSection: React.FC<MenuSectionProps> = ({
  lang,
  menuItems,
  favorites,
  activeCategory,
  onChangeCategory,
  onToggleFavorite,
  onCustomize,
  onQuickAdd,
}) => {
  const t = (k: string) => translate(lang, k);
  const [diet, setDiet] = useState<DietFilter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('featured');

  const signatureShowcase = useMemo(() => {
    const picked = FEATURED_SHOWCASE_IDS.map((id) => menuItems.find((m) => m.id === id)).filter(
      Boolean
    ) as MenuItem[];
    return picked.length > 0 ? picked : menuItems.slice(0, 4);
  }, [menuItems]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = menuItems.filter((item) => {
      if (activeCategory === 'favorites') {
        if (!favorites.includes(item.id)) return false;
      } else if (activeCategory !== 'all' && item.cat !== activeCategory) {
        return false;
      }

      if (diet !== 'all' && !item.dietary.includes(diet)) {
        return false;
      }

      if (q) {
        const haystack = [
          item.name,
          item.desc,
          t(item.name),
          t(item.desc),
          item.cat,
          item.tag || '',
          ...item.dietary,
          ...item.allergens,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === 'price-low') sorted.sort((a, b) => a.price - b.price);
    else if (sort === 'price-high') sorted.sort((a, b) => b.price - a.price);
    else if (sort === 'name') {
      sorted.sort((a, b) => t(a.name).localeCompare(t(b.name)));
    }
    return sorted;
  }, [menuItems, activeCategory, favorites, diet, query, sort, lang]);

  return (
    <section id="menu" className="py-16 sm:py-20 bg-white">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
        {/* Top Featured Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
        >
          <div>
            <div className="inline-flex items-center gap-2.5 text-[11px] font-mono font-bold tracking-[0.22em] uppercase text-[#111111] mb-2">
              <span className="h-[2px] w-7 bg-[#F2B01E]" aria-hidden="true" />
              <span>{t('OUR MENU')}</span>
            </div>
            <h2 className="font-display font-extrabold italic text-3xl sm:text-5xl text-[#111111] tracking-tight">
              {t('Eng Mashhur Taomlar')}
            </h2>
            <p className="text-sm sm:text-base text-neutral-600 mt-1.5">
              {t('Choose your favorite dishes and order')}
            </p>
          </div>

          <a
            href="#full-menu-catalog"
            onClick={() => {
              onChangeCategory('all');
              setDiet('all');
            }}
            className="self-start sm:self-auto h-10 px-5 rounded-full border border-neutral-200 bg-white hover:bg-[#FAFAFA] hover:border-[#F2B01E] text-[#111111] text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
          >
            <span>{t('All menu')}</span>
            <ChevronRight className="w-4 h-4 text-[#E5A210]" />
          </a>
        </motion.div>

        {/* Signature 4-Card Showcase Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {signatureShowcase.map((item, idx) => (
            <motion.article
              key={`featured-${item.id}`}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{ duration: 0.38, delay: idx * 0.06, ease: EASE_OUT_EXPO }}
              whileHover={{ y: -4, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
              className={`group relative rounded-[20px] bg-white border border-neutral-200 hover:border-[#F2B01E] overflow-hidden flex flex-col transition-[border-color,box-shadow] duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_14px_32px_rgba(0,0,0,0.08)] ${
                !item.available ? 'opacity-55' : ''
              }`}
            >
              <button
                type="button"
                disabled={!item.available}
                onClick={() => onCustomize(item)}
                className="relative aspect-[16/10] w-full bg-[#FAFAFA] overflow-hidden block text-left cursor-pointer disabled:cursor-not-allowed"
              >
                <FoodImage
                  src={item.img}
                  alt={t(item.name)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                />
                {idx === 0 && (
                  <span className="absolute top-3 right-3 h-6 px-2.5 rounded-full bg-[#F2B01E] text-[#111111] text-[11px] font-bold inline-flex items-center gap-1 shadow-sm">
                    <Crown className="w-3 h-3" />
                    <span>{t('Popular dish')}</span>
                  </span>
                )}
              </button>

              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between bg-white">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#111111] leading-snug group-hover:text-[#9E7000] transition-colors">
                    {t(item.name)}
                  </h3>
                  <p className="text-xs text-neutral-600 mt-1 line-clamp-1">
                    {t(item.desc)}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="font-display font-extrabold text-lg text-[#111111] tabular-nums">
                    {formatMoney(item.price)}
                  </span>

                  <button
                    type="button"
                    disabled={!item.available}
                    onClick={() => onQuickAdd(item)}
                    aria-label={`Quick add ${item.name}`}
                    className="w-10 h-10 rounded-full bg-[#F2B01E] hover:bg-[#E5A210] disabled:bg-neutral-100 disabled:text-neutral-400 text-[#111111] inline-flex items-center justify-center transition-transform duration-150 hover:scale-105 cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-[0_4px_14px_rgba(242,176,30,0.28)]"
                  >
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Full Interactive Menu Catalog & Controls */}
        <div id="full-menu-catalog" className="pt-10 border-t border-neutral-200">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
            className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"
          >
            <div>
              <p className="text-xs font-mono font-bold tracking-widest uppercase text-[#9E7000] mb-1">
                {t('The good stuff')}
              </p>
              <h3 className="font-display font-extrabold italic text-2xl sm:text-3xl text-[#111111] tracking-tight">
                {t('All menu')}
              </h3>
            </div>

            <label className="relative self-start sm:self-auto">
              <span className="sr-only">Sort menu</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort menu"
                className="h-10 px-3.5 pr-8 text-sm bg-white border border-neutral-200 rounded-xl text-[#111111] font-medium focus:outline-none focus:border-[#F2B01E] cursor-pointer shadow-2xs"
              >
                <option value="featured">{t('Featured')}</option>
                <option value="price-low">{t('Price: low to high')}</option>
                <option value="price-high">{t('Price: high to low')}</option>
                <option value="name">{t('Name: A to Z')}</option>
              </select>
            </label>
          </motion.div>

          <div className="mb-6">
            <MenuSearchBar
              value={query}
              onChange={setQuery}
              placeholder={t('Search the menu…')}
              resultCount={filteredItems.length}
              totalCount={menuItems.length}
              clearLabel={t('Clear search')}
              itemsLabel={t('items')}
              lang={lang}
            />
          </div>
        </div>

        {/* Category Tabs & Dietary Filter Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
          className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3.5 pb-6 border-b border-neutral-200 mb-10"
        >
          <div className="flex items-center gap-2 min-w-0 max-w-full overflow-x-auto pb-1 xl:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATEGORIES.map((c) => {
              const active = activeCategory === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChangeCategory(c.id)}
                  aria-pressed={active}
                  className={`h-10 px-3.5 sm:px-4 text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#F2B01E] text-[#111111] font-bold shadow-[0_4px_12px_rgba(242,176,30,0.24)]'
                      : 'bg-white border border-neutral-200 text-neutral-700 hover:border-[#F2B01E] hover:text-[#111111]'
                  }`}
                >
                  {c.id === 'favorites' && (
                    <Heart
                      className={`w-3.5 h-3.5 shrink-0 ${
                        active ? 'fill-[#111111] text-[#111111]' : 'text-[#E5A210]'
                      }`}
                    />
                  )}
                  <span>{t(c.label)}</span>
                  {c.id === 'favorites' && favorites.length > 0 && (
                    <span className="font-mono text-xs opacity-80 tabular-nums">
                      ({favorites.length})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 min-w-0 max-w-full overflow-x-auto pb-1 xl:pb-0 shrink-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {DIET_FILTERS.map((df) => {
              const active = diet === df.id;
              return (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setDiet(df.id)}
                  aria-pressed={active}
                  className={`h-9 px-3 text-xs font-semibold rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#F2B01E] text-[#111111] bg-white ring-2 ring-[#F2B01E]/35 font-bold'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:border-[#F2B01E] hover:text-[#111111]'
                  }`}
                >
                  {t(df.label)}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* 3-Column Light Editorial Product Grid */}
        {filteredItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="py-16 text-center border border-neutral-200 rounded-[24px] bg-[#FAFAFA]"
          >
            <h3 className="font-display font-bold text-xl text-[#111111]">
              {t('No dishes found')}
            </h3>
            <p className="text-sm text-neutral-600 mt-1">{t('Try another search or category.')}</p>
            <button
              type="button"
              onClick={() => {
                onChangeCategory('all');
                setDiet('all');
                setQuery('');
              }}
              className="mt-4 h-10 px-5 text-sm font-bold text-[#111111] bg-[#F2B01E] hover:bg-[#E5A210] rounded-xl transition-colors cursor-pointer"
            >
              {t('Clear filters')}
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredItems.map((item, idx) => {
              const isFav = favorites.includes(item.id);
              return (
                <motion.article
                  key={`${activeCategory}-${diet}-${item.id}`}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.04 }}
                  transition={{
                    duration: 0.36,
                    delay: (idx % 3) * 0.055,
                    ease: EASE_OUT_EXPO,
                  }}
                  whileHover={{ y: -4, transition: { duration: 0.18, ease: EASE_OUT_EXPO } }}
                  className={`group flex flex-col bg-white border border-neutral-200 hover:border-[#F2B01E] rounded-[24px] overflow-hidden transition-[border-color,box-shadow] duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.05)] hover:shadow-[0_16px_34px_rgba(0,0,0,0.08)] ${
                    !item.available ? 'opacity-55' : ''
                  }`}
                >
                  {/* 4:3 Product Photo */}
                  <div className="relative aspect-[4/3] bg-[#FAFAFA] overflow-hidden">
                    <FoodImage
                      src={item.img}
                      alt={t(item.name)}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />

                    {/* Favorite button */}
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(item.id)}
                      aria-label={isFav ? `Remove ${item.name} from favorites` : `Save ${item.name} to favorites`}
                      className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-white/95 hover:bg-white border border-neutral-200 flex items-center justify-center transition-colors cursor-pointer backdrop-blur-sm shadow-xs"
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          isFav ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-neutral-500'
                        }`}
                      />
                    </button>

                    {!item.available && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="px-3.5 py-1.5 bg-white border border-neutral-200 text-[#111111] text-xs font-semibold rounded-xl shadow-sm">
                          {t('Sold out today')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between bg-white min-w-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs text-neutral-500 mb-1.5">
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0">
                          <span className="uppercase tracking-wider font-medium">
                            {t(
                              item.cat === 'fast-food'
                                ? 'Fast food'
                                : item.cat.charAt(0).toUpperCase() + item.cat.slice(1)
                            )}
                          </span>
                          {item.tag && (
                            <>
                              <span aria-hidden="true" className="text-neutral-300">·</span>
                              <span className="font-semibold text-[#9E7000]">{t(item.tag)}</span>
                            </>
                          )}
                          {item.bogo && (
                            <>
                              <span aria-hidden="true" className="text-neutral-300">·</span>
                              <span className="font-semibold text-[#111111]">1+1</span>
                            </>
                          )}
                        </div>
                        <span className="font-mono text-[11px] text-[#9E7000] font-bold tabular-nums shrink-0">
                          {item.discountRate}% {t('OFF')}
                        </span>
                      </div>

                      <h3 className="font-display font-bold text-lg text-[#111111] leading-snug group-hover:text-[#9E7000] transition-colors">
                        {t(item.name)}
                      </h3>
                      <p className="text-sm text-neutral-600 mt-1.5 line-clamp-2 leading-relaxed">
                        {t(item.desc)}
                      </p>
                    </div>

                    {/* Price & Actions */}
                    <div className="mt-5 pt-4 border-t border-neutral-200 flex flex-wrap items-center justify-between gap-x-2 gap-y-2.5">
                      <div className="flex flex-col min-w-0">
                        <del className="text-xs text-neutral-400 font-mono tabular-nums whitespace-nowrap">
                          {formatMoney(item.originalPrice)}
                        </del>
                        <span className="font-display font-extrabold text-base sm:text-lg text-[#111111] tabular-nums whitespace-nowrap">
                          {formatMoney(item.price)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
                        <button
                          type="button"
                          disabled={!item.available}
                          onClick={() => onCustomize(item)}
                          title={t('Customize +')}
                          className="h-9 px-2.5 sm:px-3 inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:border-[#F2B01E] hover:bg-[#FAFAFA] text-xs font-semibold text-[#111111] disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap shrink-0 shadow-2xs"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0 text-[#E5A210]" />
                          <span>{item.cat === 'drinks' ? t('Quick add') : t('Customize +')}</span>
                        </button>

                        <button
                          type="button"
                          disabled={!item.available}
                          onClick={() => onQuickAdd(item)}
                          aria-label={`Quick add ${item.name}`}
                          className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] disabled:bg-neutral-100 disabled:text-neutral-400 text-[#111111] transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0 shadow-2xs"
                        >
                          <Plus className="w-4 h-4 stroke-[2.25]" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
