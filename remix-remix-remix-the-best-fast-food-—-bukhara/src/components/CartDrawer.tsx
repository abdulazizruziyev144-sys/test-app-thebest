import React, { useEffect, useMemo, useState } from 'react';
import { Award, Minus, Plus, Sparkles, Tag, Trash2, X } from 'lucide-react';
import { translate } from '../data/i18n';
import { CartCalculation, discountForPoints, formatMoney } from '../lib/calculations';
import type { FulfillmentMode, Lang, MenuItem, RestaurantSettings, RewardsProfile } from '../types';
import { FoodImage } from './FoodImage';

interface CartDrawerProps {
  open: boolean;
  lang: Lang;
  mode: FulfillmentMode;
  dineInTable: string;
  calc: CartCalculation;
  menuItems: MenuItem[];
  codes: string[];
  settings: RestaurantSettings;
  rewardsProfile: RewardsProfile | null;
  redeemPointsAmount: number;
  onClose: () => void;
  onChangeMode: (mode: FulfillmentMode) => void;
  onOpenQrScanner: () => void;
  onUpdateQty: (key: string, delta: number) => void;
  onRemoveLine: (key: string) => void;
  onQuickAdd: (item: MenuItem) => void;
  onApplyPromo: (code: string) => { ok: boolean; error?: string };
  onRemovePromo: (code: string) => void;
  onChangeRedeemPoints: (pts: number) => void;
  onOpenRewards: () => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  lang,
  mode,
  dineInTable,
  calc,
  menuItems,
  codes,
  settings,
  rewardsProfile,
  redeemPointsAmount,
  onClose,
  onChangeMode,
  onOpenQrScanner,
  onUpdateQty,
  onRemoveLine,
  onQuickAdd,
  onApplyPromo,
  onRemovePromo,
  onChangeRedeemPoints,
  onOpenRewards,
  onCheckout,
}) => {
  const t = (k: string) => translate(lang, k);
  const [promoInput, setPromoInput] = useState('');
  const [promoErr, setPromoErr] = useState('');

  const upsellItems = useMemo(() => {
    if (calc.lines.length === 0) return [];
    const inCartIds = new Set(calc.lines.map((l) => l.id));
    const hasDrink = calc.lines.some((l) => l.item.cat === 'drinks');
    const candidates = menuItems.filter(
      (m) => m.available && !inCartIds.has(m.id) && (m.cat === 'drinks' || m.cat === 'snacks')
    );
    // Prioritize drinks first if customer has no drink yet
    candidates.sort((a, b) => {
      if (!hasDrink) {
        if (a.cat === 'drinks' && b.cat !== 'drinks') return -1;
        if (b.cat === 'drinks' && a.cat !== 'drinks') return 1;
      }
      return a.price - b.price;
    });
    return candidates.slice(0, 3);
  }, [calc.lines, menuItems]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const remainingForFree = Math.max(0, settings.freeThreshold - calc.merchandise);
  const freeProgress =
    settings.freeThreshold > 0
      ? Math.min(100, Math.round((calc.merchandise / settings.freeThreshold) * 100))
      : 100;

  const handlePromoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onApplyPromo(promoInput.trim().toUpperCase());
    if (!res.ok) {
      setPromoErr(res.error || 'Could not apply code.');
    } else {
      setPromoErr('');
      setPromoInput('');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Your order')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/25 backdrop-blur-sm"
    >
      <div className="bg-white text-[#111111] w-full max-w-md h-full flex flex-col border-l border-neutral-200 shadow-2xl">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-neutral-200 bg-[#FAFAFA] flex items-center justify-between">
          <h2 className="font-display font-extrabold italic text-xl text-[#111111]">{t('Your order')}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="w-9 h-9 rounded-xl border border-neutral-200 bg-white text-neutral-600 flex items-center justify-center hover:border-[#F2B01E] hover:text-[#111111] cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="px-5 pt-4 pb-3 border-b border-neutral-200 bg-[#FAFAFA]">
          <div className="grid grid-cols-4 gap-1 p-1 bg-white border border-neutral-200 rounded-xl">
            {(['delivery', 'pickup', 'dine-in', 'reservation'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChangeMode(m)}
                aria-pressed={mode === m}
                className={`h-8 px-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer truncate ${
                  mode === m
                    ? 'bg-[#F2B01E] text-[#111111] font-bold'
                    : 'text-neutral-600 hover:text-[#111111]'
                }`}
              >
                {t(
                  m === 'delivery'
                    ? 'Delivery'
                    : m === 'pickup'
                      ? 'Pickup'
                      : m === 'dine-in'
                        ? 'Dine-in'
                        : 'Reserve'
                )}
              </button>
            ))}
          </div>

          {mode === 'dine-in' && (
            <div className="mt-2.5 flex items-center justify-between gap-2 text-xs text-neutral-600">
              <span>
                {dineInTable ? (
                  <>
                    <strong className="text-[#9E7000]">
                      {t('Table')} #{dineInTable}
                    </strong>{' '}
                    · {t('Dine-in')}
                  </>
                ) : (
                  <span>{t('Dine-in')} · Scan table QR or confirm table at checkout</span>
                )}
              </span>
              <button
                type="button"
                onClick={onOpenQrScanner}
                className="text-xs font-semibold text-[#9E7000] hover:underline whitespace-nowrap cursor-pointer"
              >
                {dineInTable ? 'Change' : 'Scan QR'}
              </button>
            </div>
          )}

          {mode === 'delivery' && calc.lines.length > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-neutral-600 mb-1.5">
                {remainingForFree === 0 ? (
                  <span className="font-semibold text-emerald-700">{t('Free delivery unlocked!')}</span>
                ) : (
                  <span className="tabular-nums">
                    Add <strong className="text-[#111111]">{formatMoney(remainingForFree)}</strong> for free delivery
                  </span>
                )}
                <span className="font-mono tabular-nums text-neutral-500">{freeProgress}%</span>
              </div>
              <div className="h-1.5 bg-white border border-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#F2B01E] transition-all"
                  style={{ width: `${freeProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart Items + Promos + Rewards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
          {calc.lines.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <p className="text-sm text-neutral-600">
                {mode === 'reservation'
                  ? t('Reserve a table now, or add dishes to pre-order.')
                  : t('Your cart is empty. Pick something fresh from the menu.')}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-[#111111] hover:border-[#F2B01E] cursor-pointer transition-colors"
              >
                {t('Browse menu')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {calc.lines.map((line) => {
                const optionTags: string[] = [];
                if (line.options.cheese) optionTags.push(t('Extra cheese'));
                if (line.options.meat) optionTags.push(t('Extra meat'));
                if (line.options.spice && line.item.cat !== 'drinks' && !line.bundle) {
                  optionTags.push(t(line.options.spice));
                }
                if (line.options.sauce && line.item.cat !== 'drinks' && !line.bundle) {
                  optionTags.push(`${line.options.sauce} · ${t('Sauce')}`);
                }

                return (
                  <div
                    key={line.key}
                    className="flex gap-3.5 p-3 rounded-2xl border border-neutral-200 bg-white shadow-xs"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-neutral-200 shrink-0 bg-[#FAFAFA]">
                      <FoodImage src={line.item.img} alt={t(line.item.name)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#111111] truncate">
                          {t(line.item.name)}
                        </h3>
                        <button
                          type="button"
                          onClick={() => onRemoveLine(line.key)}
                          aria-label={`Remove ${line.item.name}`}
                          className="text-neutral-400 hover:text-red-600 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {line.bundle && (
                        <p className="text-xs text-neutral-600 mt-0.5 line-clamp-1">
                          {line.item.desc}
                        </p>
                      )}
                      {optionTags.length > 0 && (
                        <p className="text-xs text-neutral-600 mt-0.5">
                          {optionTags.join(' · ')}
                        </p>
                      )}

                      <div className="mt-2.5 flex items-center justify-between">
                        <div className="inline-flex items-center border border-neutral-200 bg-[#FAFAFA] rounded-xl">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(line.key, -1)}
                            aria-label="Decrease quantity"
                            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#111111] cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-mono font-semibold text-[#111111] tabular-nums">
                            {line.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(line.key, 1)}
                            aria-label="Increase quantity"
                            className="w-7 h-7 flex items-center justify-center text-neutral-600 hover:text-[#111111] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="font-mono text-sm font-semibold text-[#9E7000] tabular-nums">
                          {formatMoney(line.unit * line.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Smart Cart Upsell Strip */}
          {upsellItems.length > 0 && (
            <div className="pt-3 border-t border-neutral-200 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#9E7000]">
                <Sparkles className="w-3.5 h-3.5 text-[#E5A210]" />
                <span>Pairs great with your order</span>
              </div>
              <div className="space-y-2">
                {upsellItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-white border border-neutral-200"
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-neutral-200 bg-[#FAFAFA]">
                      <FoodImage src={item.img} alt={t(item.name)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#111111] truncate">
                        {t(item.name)}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-[#9E7000] tabular-nums">
                        {formatMoney(item.price)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onQuickAdd(item)}
                      className="h-8 px-2.5 rounded-lg bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Promo Code Input */}
          <form onSubmit={handlePromoSubmit} className="pt-3 border-t border-neutral-200 space-y-2">
            <label className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#E5A210]" />
              <span>{t('Promo code')}</span>
            </label>
            <div className="flex gap-2">
              <input
                value={promoInput}
                onChange={(e) => {
                  setPromoInput(e.target.value.toUpperCase());
                  if (promoErr) setPromoErr('');
                }}
                placeholder="WELCOME10, COMBO25, 1PLUS1…"
                className="flex-1 min-w-0 h-9 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-mono uppercase text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
              />
              <button
                type="submit"
                className="h-9 px-4 rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-xs font-bold cursor-pointer transition-colors"
              >
                {t('Apply')}
              </button>
            </div>
            {promoErr && <p className="text-xs text-red-600 font-medium">{promoErr}</p>}

            {codes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {codes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onRemovePromo(c)}
                    className="h-7 px-2.5 rounded-lg bg-[#FAFAFA] border border-[#F2B01E] text-xs font-mono font-semibold text-[#111111] inline-flex items-center gap-1.5 hover:bg-white cursor-pointer"
                  >
                    <span>{c}</span>
                    <X className="w-3 h-3 text-neutral-500" />
                  </button>
                ))}
              </div>
            )}
          </form>

          {/* Loyalty Rewards Redemption */}
          <div className="p-3.5 rounded-2xl bg-[#FAFAFA] border border-neutral-200 shadow-xs space-y-2.5">
            {rewardsProfile ? (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#111111] flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#E5A210]" />
                    <span>{rewardsProfile.name}</span>
                  </span>
                  <span className="font-mono font-bold text-[#9E7000] tabular-nums">
                    {rewardsProfile.points} pts
                  </span>
                </div>
                {calc.redeemablePoints >= 100 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[100, 250, 500]
                      .filter((tier) => tier <= calc.redeemablePoints)
                      .map((pts) => (
                        <button
                          key={pts}
                          type="button"
                          onClick={() =>
                            onChangeRedeemPoints(redeemPointsAmount === pts ? 0 : pts)
                          }
                          className={`h-8 px-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                            redeemPointsAmount === pts
                              ? 'bg-[#F2B01E] text-[#111111] border-[#F2B01E] font-bold'
                              : 'bg-white text-[#111111] border-neutral-200 hover:border-[#F2B01E]'
                          }`}
                        >
                          Use {pts} pts (-{formatMoney(discountForPoints(pts))})
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-600">
                    {rewardsProfile.points < 100
                      ? `Earn ${100 - rewardsProfile.points} more points to unlock 5,000 UZS off.`
                      : 'Add at least 5,000 UZS of eligible items to redeem points.'}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-600">{t('Sign in to earn & redeem reward points.')}</p>
                <button
                  type="button"
                  onClick={onOpenRewards}
                  className="text-xs font-semibold text-[#9E7000] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {t('Join / Sign in')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer Totals */}
        <div className="p-5 border-t border-neutral-200 bg-[#FAFAFA] space-y-3">
          <div className="space-y-1.5 text-xs text-neutral-600">
            <div className="flex justify-between">
              <span>{t('Subtotal')}</span>
              <span className="font-mono text-[#111111] tabular-nums">{formatMoney(calc.subtotal)}</span>
            </div>
            {calc.discounts.map((d) => (
              <div key={d.code} className="flex justify-between text-[#9E7000] font-semibold">
                <span>{d.code}</span>
                <span className="font-mono tabular-nums">-{formatMoney(d.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span>{t('Delivery fee')}</span>
              <span className="font-mono text-[#111111] tabular-nums">
                {calc.deliveryFee === 0 ? t('Free') : formatMoney(calc.deliveryFee)}
              </span>
            </div>
          </div>

          <div className="pt-2.5 border-t border-neutral-200 flex items-center justify-between">
            <span className="font-display font-bold text-base text-[#111111]">{t('Total')}</span>
            <span className="font-display font-extrabold text-xl text-[#9E7000] tabular-nums">
              {formatMoney(calc.grandTotal)}
            </span>
          </div>

          <button
            type="button"
            disabled={calc.lines.length === 0 && mode !== 'reservation'}
            onClick={onCheckout}
            className="h-11 w-full rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] disabled:bg-neutral-200 disabled:text-neutral-400 text-[#111111] text-sm font-bold transition-colors cursor-pointer disabled:cursor-not-allowed shadow-xs"
          >
            {t('Continue to checkout')}
          </button>
        </div>
      </div>
    </div>
  );
};
