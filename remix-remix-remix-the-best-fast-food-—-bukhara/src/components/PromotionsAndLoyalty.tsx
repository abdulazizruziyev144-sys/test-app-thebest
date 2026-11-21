import React from 'react';
import { motion } from 'motion/react';
import { Award, Check, Copy, Sparkles } from 'lucide-react';
import { translate } from '../data/i18n';
import { getLoyaltyTier } from '../lib/calculations';
import { Lang, Promotion, RewardsProfile } from '../types';

interface PromotionsAndLoyaltyProps {
  lang: Lang;
  promos: Record<string, Promotion>;
  promoOff: string[];
  appliedCodes: string[];
  rewardsProfile: RewardsProfile | null;
  onApplyPromo: (code: string) => void;
  onOpenRewards: () => void;
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const PromotionsAndLoyalty: React.FC<PromotionsAndLoyaltyProps> = ({
  lang,
  promos,
  promoOff,
  appliedCodes,
  rewardsProfile,
  onApplyPromo,
  onOpenRewards,
}) => {
  const t = (k: string) => translate(lang, k);
  const activePromos = Object.entries(promos).filter(([code]) => !promoOff.includes(code));
  const tier = getLoyaltyTier(rewardsProfile?.points || 0);

  return (
    <section className="py-20 bg-white border-b border-neutral-200">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 space-y-12">
        {/* Promotions Grid */}
        <div>
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
                <span>{t('Special offers')}</span>
              </div>
              <h2 className="font-display font-extrabold italic text-3xl sm:text-5xl text-[#111111] tracking-tight">
                {t('More flavour. Less sum.')}
              </h2>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {activePromos.map(([code, promo], idx) => {
              const applied = appliedCodes.includes(code);
              return (
                <motion.div
                  key={code}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.12 }}
                  transition={{ duration: 0.38, delay: idx * 0.055, ease: EASE_OUT_EXPO }}
                  whileHover={{ y: -2, transition: { duration: 0.16, ease: EASE_OUT_EXPO } }}
                  className="bg-white border border-neutral-200 hover:border-[#F2B01E] shadow-[0_8px_24px_rgba(0,0,0,0.05)] rounded-[22px] p-5 flex flex-col justify-between gap-4 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-mono font-bold text-base text-[#111111] tracking-wide">
                        {code}
                      </span>
                      <span className="text-xs font-mono font-semibold text-[#9E7000] uppercase">
                        {promo.type}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-600">{t(promo.label)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onApplyPromo(code)}
                    className={`h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      applied
                        ? 'bg-[#F2B01E] text-[#111111]'
                        : 'bg-white border border-neutral-200 text-[#111111] hover:bg-[#F2B01E] hover:border-[#F2B01E]'
                    }`}
                  >
                    {applied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('Applied in Cart')}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>
                          {t('Apply')} {code}
                        </span>
                      </>
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Loyalty Rewards Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.42, ease: EASE_OUT_EXPO }}
          className="bg-[#FAFAFA] border border-neutral-200 text-[#111111] shadow-[0_10px_28px_rgba(0,0,0,0.05)] rounded-[28px] p-6 sm:p-9 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center"
        >
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest uppercase text-[#111111]">
              <Award className="w-4 h-4 text-[#E5A210]" />
              <span>{t('The Best Rewards')}</span>
            </div>
            <h3 className="font-display font-extrabold italic text-2xl sm:text-4xl text-[#111111] tracking-tight">
              {t('Every order brings a little extra.')}
            </h3>
            <p className="text-sm sm:text-base text-neutral-600 max-w-xl leading-relaxed">
              Earn 1 point per 1,000 UZS spent. Unlock Silver (250 pts) & Gold (750 pts) status for up to 1.5× points, birthday treats, and 5,000–30,000 UZS instant order discounts.
            </p>
          </div>

          <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-5 space-y-4 shadow-xs">
            {rewardsProfile ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-neutral-600">{rewardsProfile.name}</div>
                    <div className="font-display font-extrabold text-2xl text-[#111111] tabular-nums">
                      {rewardsProfile.points} pts
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-neutral-600">Tier</div>
                    <div className="font-display font-bold text-base text-[#9E7000] inline-flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#F2B01E]" />
                      <span>{tier.name}</span>
                    </div>
                  </div>
                </div>
                {tier.nextTier && (
                  <div>
                    <div className="flex justify-between text-[11px] text-neutral-600 mb-1.5 tabular-nums">
                      <span>
                        {tier.progressPercent}% to {tier.nextTier}
                      </span>
                      <span>{tier.pointsToNext} pts left</span>
                    </div>
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden border border-neutral-200">
                      <div
                        className="h-full bg-[#F2B01E] transition-all"
                        style={{ width: `${tier.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={onOpenRewards}
                  className="h-10 w-full rounded-xl bg-[#F2B01E] text-[#111111] hover:bg-[#E5A210] text-xs font-bold transition-colors cursor-pointer"
                >
                  Manage Rewards & Vouchers
                </button>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-[#111111]">Join in 10 seconds</div>
                  <div className="text-xs text-neutral-600 mt-0.5">
                    Verify your Uzbekistan phone number to start earning.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenRewards}
                  className="h-10 px-5 rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t('Join / Sign in')}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};
