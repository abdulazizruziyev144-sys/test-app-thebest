import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Flame, Heart, X } from 'lucide-react';
import { ADDON_NUTRITION, SAUCE_NUTRITION, SAUCE_OPTIONS } from '../data/menu';
import { translate } from '../data/i18n';
import { formatMoney } from '../lib/calculations';
import { CartOptions, Lang, MenuItem } from '../types';
import { FoodImage } from './FoodImage';

interface CustomizeModalProps {
  lang: Lang;
  item: MenuItem | null;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
  onAdd: (item: MenuItem, options: CartOptions) => void;
}

export const CustomizeModal: React.FC<CustomizeModalProps> = ({
  lang,
  item,
  isFavorite,
  onToggleFavorite,
  onClose,
  onAdd,
}) => {
  const t = (k: string) => translate(lang, k);
  const [cheese, setCheese] = useState(false);
  const [meat, setMeat] = useState(false);
  const [spice, setSpice] = useState<'Mild' | 'Medium' | 'Hot'>('Medium');
  const [sauce, setSauce] = useState<string>('The Best');

  useEffect(() => {
    setCheese(false);
    setMeat(false);
    setSpice('Medium');
    setSauce('The Best');
  }, [item?.id]);

  const isDrink = item?.cat === 'drinks';

  const {
    calculatedCalories,
    extraCalories,
    calculatedMacros,
    extraMacros,
    macroShares,
    calculatedAllergens,
  } = useMemo(() => {
    const zeroMacros = { protein: 0, carbs: 0, fat: 0 };
    if (!item) {
      return {
        calculatedCalories: 0,
        extraCalories: 0,
        calculatedMacros: zeroMacros,
        extraMacros: zeroMacros,
        macroShares: { protein: 0, carbs: 0, fat: 0 },
        calculatedAllergens: [] as string[],
      };
    }
    const baseCalories = item.calories ?? 0;
    const baseMacros = item.macros ?? zeroMacros;
    const baseAllergens = item.allergens ?? [];

    const computeShares = (m: { protein: number; carbs: number; fat: number }) => {
      const pKcal = m.protein * 4;
      const cKcal = m.carbs * 4;
      const fKcal = m.fat * 9;
      const totalKcal = pKcal + cKcal + fKcal;
      if (totalKcal <= 0) return { protein: 0, carbs: 0, fat: 0 };
      const p = Math.round((pKcal / totalKcal) * 100);
      const c = Math.round((cKcal / totalKcal) * 100);
      const f = Math.max(0, 100 - p - c);
      return { protein: p, carbs: c, fat: f };
    };

    if (isDrink) {
      return {
        calculatedCalories: baseCalories,
        extraCalories: 0,
        calculatedMacros: baseMacros,
        extraMacros: zeroMacros,
        macroShares: computeShares(baseMacros),
        calculatedAllergens: baseAllergens,
      };
    }

    const sauceMeta = SAUCE_NUTRITION[sauce] ?? { calories: 0, macros: zeroMacros, allergens: [] };
    const addonCal =
      (cheese ? ADDON_NUTRITION.cheese.calories : 0) +
      (meat ? ADDON_NUTRITION.meat.calories : 0) +
      sauceMeta.calories;

    const addedMacros = {
      protein:
        (cheese ? ADDON_NUTRITION.cheese.macros.protein : 0) +
        (meat ? ADDON_NUTRITION.meat.macros.protein : 0) +
        sauceMeta.macros.protein,
      carbs:
        (cheese ? ADDON_NUTRITION.cheese.macros.carbs : 0) +
        (meat ? ADDON_NUTRITION.meat.macros.carbs : 0) +
        sauceMeta.macros.carbs,
      fat:
        (cheese ? ADDON_NUTRITION.cheese.macros.fat : 0) +
        (meat ? ADDON_NUTRITION.meat.macros.fat : 0) +
        sauceMeta.macros.fat,
    };

    const totalMacros = {
      protein: baseMacros.protein + addedMacros.protein,
      carbs: baseMacros.carbs + addedMacros.carbs,
      fat: baseMacros.fat + addedMacros.fat,
    };

    const mergedAllergens = Array.from(
      new Set([
        ...baseAllergens,
        ...(cheese ? ADDON_NUTRITION.cheese.allergens : []),
        ...(meat ? ADDON_NUTRITION.meat.allergens : []),
        ...sauceMeta.allergens,
      ])
    );

    return {
      calculatedCalories: baseCalories + addonCal,
      extraCalories: addonCal,
      calculatedMacros: totalMacros,
      extraMacros: addedMacros,
      macroShares: computeShares(totalMacros),
      calculatedAllergens: mergedAllergens,
    };
  }, [item, isDrink, cheese, meat, sauce]);

  if (!item) return null;

  const total = item.price + (cheese ? 7000 : 0) + (meat ? 12000 : 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(item, isDrink ? {} : { cheese, meat, spice, sauce });
    setCheese(false);
    setMeat(false);
    setSpice('Medium');
    setSauce('The Best');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizeTitle"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-[#111111]">
        <div className="px-5 py-4 border-b border-neutral-200 bg-[#FAFAFA] flex items-center justify-between">
          <h2 id="customizeTitle" className="font-display font-extrabold italic text-lg text-[#111111] tracking-tight">
            {t('Make it yours')}
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(item.id)}
              aria-label="Toggle favorite"
              className="w-9 h-9 rounded-lg border border-neutral-200 bg-white flex items-center justify-center hover:border-[#F2B01E] transition-colors cursor-pointer"
            >
              <Heart
                className={`w-4 h-4 ${isFavorite ? 'fill-[#F2B01E] text-[#F2B01E]' : 'text-neutral-500'}`}
              />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close customization"
              className="w-9 h-9 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:text-[#111111] hover:border-[#F2B01E] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto bg-white">
            <div className="flex items-center gap-4">
              <div className="w-24 h-20 rounded-xl overflow-hidden border border-neutral-200 shrink-0 bg-[#FAFAFA]">
                <FoodImage src={item.img} alt={t(item.name)} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-[#111111]">{t(item.name)}</h3>
                <p className="text-xs text-neutral-600 mt-0.5">{t(item.desc)}</p>
                <div className="mt-1.5 font-mono text-sm font-bold text-[#9E7000] tabular-nums">
                  {formatMoney(item.price)}
                </div>
              </div>
            </div>

            {/* Dynamic Nutrition Information (Calories, Macros & Allergens) */}
            <section
              aria-label={t('Nutrition information')}
              className="rounded-xl bg-white border border-neutral-200 px-3.5 py-3 space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-600">
                  <Flame className="w-3.5 h-3.5 text-[#E5A210]" />
                  {t('Nutrition information')}
                </span>
                <span className="font-mono text-xs font-bold text-[#111111] tabular-nums">
                  {calculatedCalories} kcal
                  {extraCalories > 0 && (
                    <span className="ml-1.5 font-normal text-neutral-500">
                      ({item.calories} + {extraCalories})
                    </span>
                  )}
                </span>
              </div>

              {/* Macro-nutrient breakdown */}
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      key: 'protein',
                      label: t('Protein'),
                      value: calculatedMacros.protein,
                      extra: extraMacros.protein,
                      dotClass: 'bg-[#F2B01E]',
                    },
                    {
                      key: 'carbs',
                      label: t('Carbs'),
                      value: calculatedMacros.carbs,
                      extra: extraMacros.carbs,
                      dotClass: 'bg-[#E5A210]',
                    },
                    {
                      key: 'fat',
                      label: t('Fat'),
                      value: calculatedMacros.fat,
                      extra: extraMacros.fat,
                      dotClass: 'bg-neutral-500',
                    },
                  ].map((macro) => (
                    <div
                      key={macro.key}
                      className="rounded-lg bg-[#FAFAFA] border border-neutral-200 px-2.5 py-2"
                    >
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-600">
                        <span className={`w-1.5 h-1.5 rounded-full ${macro.dotClass}`} />
                        <span>{macro.label}</span>
                      </div>
                      <div className="mt-0.5 font-mono text-sm font-bold text-[#111111] tabular-nums">
                        {macro.value}g
                        {macro.extra > 0 && (
                          <span className="ml-1 text-[10px] font-normal text-[#9E7000]">
                            +{macro.extra}g
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Proportional macro energy bar */}
                {calculatedCalories > 0 && (
                  <div
                    className="h-1.5 w-full rounded-full bg-neutral-200 overflow-hidden flex"
                    aria-hidden="true"
                  >
                    <div
                      className="h-full bg-[#F2B01E] transition-all duration-300"
                      style={{ width: `${macroShares.protein}%` }}
                    />
                    <div
                      className="h-full bg-[#E5A210]/75 transition-all duration-300"
                      style={{ width: `${macroShares.carbs}%` }}
                    />
                    <div
                      className="h-full bg-neutral-400 transition-all duration-300"
                      style={{ width: `${macroShares.fat}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-neutral-200 flex items-start justify-between gap-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider text-neutral-600 shrink-0">
                  <AlertCircle className="w-3.5 h-3.5 text-[#E5A210]" />
                  {t('Allergens')}
                </span>
                <span className="text-right font-medium text-[#111111]">
                  {calculatedAllergens.length > 0
                    ? calculatedAllergens.map((a) => t(a)).join(' · ')
                    : t('No major allergens')}
                </span>
              </div>
            </section>

            {!isDrink ? (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    {t('Add-ons')}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <label
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        cheese
                          ? 'bg-[#FAFAFA] border-[#F2B01E] ring-2 ring-[#F2B01E]/25'
                          : 'bg-white border-neutral-200 hover:border-[#F2B01E]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[#111111]">
                        <input
                          type="checkbox"
                          checked={cheese}
                          onChange={(e) => setCheese(e.target.checked)}
                          className="accent-[#F2B01E] w-4 h-4"
                        />
                        <span>
                          {t('Extra cheese')}
                          <span className="block text-[11px] font-mono text-neutral-500 tabular-nums">
                            +{ADDON_NUTRITION.cheese.calories} kcal
                          </span>
                        </span>
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#9E7000] tabular-nums">+7,000</span>
                    </label>
                    <label
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        meat
                          ? 'bg-[#FAFAFA] border-[#F2B01E] ring-2 ring-[#F2B01E]/25'
                          : 'bg-white border-neutral-200 hover:border-[#F2B01E]'
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[#111111]">
                        <input
                          type="checkbox"
                          checked={meat}
                          onChange={(e) => setMeat(e.target.checked)}
                          className="accent-[#F2B01E] w-4 h-4"
                        />
                        <span>
                          {t('Extra meat')}
                          <span className="block text-[11px] font-mono text-neutral-500 tabular-nums">
                            +{ADDON_NUTRITION.meat.calories} kcal
                          </span>
                        </span>
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#9E7000] tabular-nums">+12,000</span>
                    </label>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    {t('Spice level')}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Mild', 'Medium', 'Hot'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setSpice(level)}
                        className={`h-10 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          spice === level
                            ? 'bg-[#F2B01E] text-[#111111] border-[#F2B01E] font-bold'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#F2B01E] hover:text-[#111111]'
                        }`}
                      >
                        {t(level)}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {t('Sauce')}
                  </span>
                  <select
                    value={sauce}
                    onChange={(e) => setSauce(e.target.value)}
                    className="mt-1.5 w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                  >
                    {SAUCE_OPTIONS.map((opt) => {
                      const cal = SAUCE_NUTRITION[opt]?.calories ?? 0;
                      return (
                        <option key={opt} value={opt}>
                          {opt} (+{cal} kcal)
                        </option>
                      );
                    })}
                  </select>
                </label>
              </div>
            ) : (
              <p className="text-sm text-neutral-600 bg-[#FAFAFA] border border-neutral-200 rounded-lg p-3.5">
                {t('Served chilled. No customizations needed.')}
              </p>
            )}
          </div>

          <div className="px-5 py-4 border-t border-neutral-200 bg-[#FAFAFA] flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-neutral-500">{t('Total')}</div>
              <div className="font-display font-extrabold text-xl text-[#9E7000] tabular-nums">
                {formatMoney(total)}
              </div>
            </div>
            <button
              type="submit"
              className="h-11 px-6 rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-sm font-bold transition-colors cursor-pointer shadow-xs"
            >
              {t('Add to order')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
