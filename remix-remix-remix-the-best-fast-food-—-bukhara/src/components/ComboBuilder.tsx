import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Plus } from 'lucide-react';
import { translate } from '../data/i18n';
import { formatMoney } from '../lib/calculations';
import { Lang, MenuItem } from '../types';
import { FoodImage } from './FoodImage';

interface ComboBuilderProps {
  lang: Lang;
  menuItems: MenuItem[];
  onAddCombo: (bundle: [string, string, string]) => void;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const ComboBuilder: React.FC<ComboBuilderProps> = ({ lang, menuItems, onAddCombo }) => {
  const t = (k: string) => translate(lang, k);

  const mains = useMemo(() => menuItems.filter((m) => m.cat === 'fast-food' && m.available), [menuItems]);
  const sides = useMemo(() => menuItems.filter((m) => m.cat === 'snacks' && m.available), [menuItems]);
  const drinks = useMemo(() => menuItems.filter((m) => m.cat === 'drinks' && m.available), [menuItems]);

  const [mainId, setMainId] = useState('');
  const [sideId, setSideId] = useState('');
  const [drinkId, setDrinkId] = useState('');

  const main = mains.find((m) => m.id === mainId) || null;
  const side = sides.find((s) => s.id === sideId) || null;
  const drink = drinks.find((d) => d.id === drinkId) || null;

  const isComplete = Boolean(main && side && drink);
  const individualTotal = (main?.price || 0) + (side?.price || 0) + (drink?.price || 0);
  const comboPrice = Math.round(individualTotal * 0.9);
  const savings = individualTotal - comboPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!main || !side || !drink) return;
    onAddCombo([main.id, side.id, drink.id]);
    setMainId('');
    setSideId('');
    setDrinkId('');
  };

  return (
    <section id="combo-builder" className="py-20 bg-[#FAFAFA] border-y border-neutral-200">
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
              <span>{t('MAKE IT A COMBO')}</span>
            </div>
            <h2 className="font-display font-extrabold italic text-3xl sm:text-5xl text-[#111111] tracking-tight">
              {t('Build your own combo')}
            </h2>
          </div>
          <p className="text-sm sm:text-base text-neutral-600 max-w-md">
            {t('Choose a main, a side, and a drink. Save 10% on your combo.')}
          </p>
        </motion.div>

        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.12 }}
          transition={{ duration: 0.42, delay: 0.06, ease: EASE_OUT_EXPO }}
          className="bg-white border border-neutral-200 rounded-[26px] p-6 sm:p-8 shadow-[0_8px_28px_rgba(0,0,0,0.05)] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
        >
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Step 1: Main */}
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#111111]">01. {t('Choose a main')}</span>
              <select
                value={mainId}
                onChange={(e) => setMainId(e.target.value)}
                required
                className="h-11 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E] cursor-pointer shadow-2xs"
              >
                <option value="">{t('Select a main')}</option>
                {mains.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.name)} — {formatMoney(item.price)}
                  </option>
                ))}
              </select>
              {main && (
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-neutral-200 bg-[#FAFAFA]">
                  <FoodImage src={main.img} alt={t(main.name)} />
                </div>
              )}
            </label>

            {/* Step 2: Side */}
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#111111]">02. {t('Choose a side')}</span>
              <select
                value={sideId}
                onChange={(e) => setSideId(e.target.value)}
                required
                className="h-11 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E] cursor-pointer shadow-2xs"
              >
                <option value="">{t('Select a side')}</option>
                {sides.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.name)} — {formatMoney(item.price)}
                  </option>
                ))}
              </select>
              {side && (
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-neutral-200 bg-[#FAFAFA]">
                  <FoodImage src={side.img} alt={t(side.name)} />
                </div>
              )}
            </label>

            {/* Step 3: Drink */}
            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#111111]">03. {t('Choose a drink')}</span>
              <select
                value={drinkId}
                onChange={(e) => setDrinkId(e.target.value)}
                required
                className="h-11 px-3 rounded-xl border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E] cursor-pointer shadow-2xs"
              >
                <option value="">{t('Select a drink')}</option>
                {drinks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.name)} — {formatMoney(item.price)}
                  </option>
                ))}
              </select>
              {drink && (
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-neutral-200 bg-[#FAFAFA]">
                  <FoodImage src={drink.img} alt={t(drink.name)} />
                </div>
              )}
            </label>
          </div>

          {/* Summary Box */}
          <div className="lg:col-span-4 bg-[#FAFAFA] border border-neutral-200 rounded-2xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-neutral-600">
                <span>{t('Individual price')}</span>
                <del className="font-mono tabular-nums">
                  {isComplete ? formatMoney(individualTotal) : '—'}
                </del>
              </div>
              <div className="flex items-center justify-between text-[#9E7000] font-semibold">
                <span>{t('You save')} (10%)</span>
                <span className="font-mono tabular-nums">
                  {isComplete ? `-${formatMoney(savings)}` : '—'}
                </span>
              </div>
              <div className="pt-2.5 border-t border-neutral-200 flex items-center justify-between text-[#111111] font-bold text-base">
                <span>{t('Combo price')}</span>
                <span className="font-mono text-lg text-[#111111] tabular-nums">
                  {isComplete ? formatMoney(comboPrice) : '—'}
                </span>
              </div>
            </div>

            {isComplete && main && side && drink && (
              <p className="text-xs text-neutral-600 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#E5A210] shrink-0" />
                <span className="truncate">
                  {t(main.name)} · {t(side.name)} · {t(drink.name)}
                </span>
              </p>
            )}

            <button
              type="submit"
              disabled={!isComplete}
              className="h-11 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] disabled:bg-neutral-100 disabled:text-neutral-400 text-[#111111] text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t('Add combo to cart')}</span>
            </button>
          </div>
        </motion.form>
      </div>
    </section>
  );
};
