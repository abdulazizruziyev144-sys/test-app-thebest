import React, { useEffect, useState } from 'react';
import { Banknote, CalendarClock, CheckCircle2, Clock, CreditCard, Download, Smartphone, X } from 'lucide-react';
import { translate } from '../data/i18n';
import { CartCalculation, formatMoney, formatScheduledTime } from '../lib/calculations';
import { downloadOrderReceipt } from '../lib/printReceipt';
import { DeliveryPinPicker } from './DeliveryPinPicker';
import type {
  DeliveryCoords,
  FulfillmentMode,
  Lang,
  Order,
  OrderCustomer,
  PaymentMethod,
  RestaurantSettings,
  RewardsProfile,
  UserProfile,
} from '../types';

interface CheckoutModalProps {
  open: boolean;
  lang: Lang;
  mode: FulfillmentMode;
  dineInTable: string;
  calc: CartCalculation;
  settings: RestaurantSettings;
  rewardsProfile: RewardsProfile | null;
  userProfile?: UserProfile | null;
  submitting: boolean;
  errorMsg: string;
  onClose: () => void;
  onSubmitOrder: (
    customer: OrderCustomer,
    orderNotes: {
      deliveryInstructions: string;
      dietaryNotes: string;
      scheduledDeliveryTime?: string;
      paymentMethod: PaymentMethod;
      deliveryCoords?: DeliveryCoords;
    }
  ) => void;
}

function getDefaultFutureSchedule(): { date: string; time: string } {
  const future = new Date(Date.now() + 60 * 60 * 1000);
  // Round up to next 15-minute slot
  const mins = future.getMinutes();
  const roundedMins = Math.ceil(mins / 15) * 15;
  future.setMinutes(roundedMins, 0, 0);

  const y = future.getFullYear();
  const m = String(future.getMonth() + 1).padStart(2, '0');
  const d = String(future.getDate()).padStart(2, '0');
  const hh = String(future.getHours()).padStart(2, '0');
  const mm = String(future.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

function getLocalTodayString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  open,
  lang,
  mode,
  dineInTable,
  calc,
  settings,
  rewardsProfile,
  userProfile,
  submitting,
  errorMsg,
  onClose,
  onSubmitOrder,
}) => {
  const t = (k: string) => translate(lang, k);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('19:00');
  const [guests, setGuests] = useState('2');
  const [table, setTable] = useState('Any');
  const [dineInTableInput, setDineInTableInput] = useState(dineInTable);
  const [scheduleOption, setScheduleOption] = useState<'asap' | 'scheduled'>('asap');
  const [scheduledDate, setScheduledDate] = useState(() => getDefaultFutureSchedule().date);
  const [scheduledTime, setScheduledTime] = useState(() => getDefaultFutureSchedule().time);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [dietaryNotes, setDietaryNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [deliveryCoords, setDeliveryCoords] = useState<DeliveryCoords | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      if (calc.lines.length === 0) {
        setDeliveryInstructions('');
        setDietaryNotes('');
        setScheduleOption('asap');
        setDeliveryCoords(null);
      }
      return;
    }
    if (rewardsProfile) {
      setName(rewardsProfile.name);
      setPhone(rewardsProfile.phone);
    } else if (userProfile) {
      setName((prev) => prev || userProfile.displayName || '');
      setPhone((prev) => prev || userProfile.phone || '');
    }
    if (userProfile?.defaultAddress) {
      setAddress((prev) => prev || userProfile.defaultAddress);
    }
    if (dineInTable) {
      setDineInTableInput(dineInTable);
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
    if (!date) setDate(today);
    const futureDefaults = getDefaultFutureSchedule();
    setScheduledDate((prev) => prev || futureDefaults.date);
    setScheduledTime((prev) => prev || futureDefaults.time);
    setErrors({});
  }, [open, rewardsProfile, userProfile, dineInTable, calc.lines.length]);

  if (!open) return null;

  const isReservation = mode === 'reservation';
  const isDineIn = mode === 'dine-in';
  const canScheduleOrder = !isReservation;
  const minDateStr = getLocalTodayString();

  const modeNotices: Record<FulfillmentMode, string> = {
    delivery: `Delivery (${settings.etaMin}–${settings.etaMax} min) · Address required`,
    pickup: 'Pickup (15–20 min) · Ready at THE BEST counter',
    'dine-in': `Dine-in (Table #${dineInTableInput || '—'}) · Served directly to your table`,
    reservation: 'Table reservation · No prepayment required',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = 'Please enter your name.';
    if (phone.replace(/\D/g, '').length < 9) errs.phone = 'Enter a valid phone number.';
    if (mode === 'delivery' && address.trim().length < 5) {
      errs.address = 'Enter a complete delivery address.';
    }
    if (isDineIn && !dineInTableInput.trim()) {
      errs.dineInTable = 'Enter your table number.';
    }
    if (isReservation) {
      if (!date) errs.date = 'Choose a date.';
      if (!time) errs.time = 'Choose a time.';
    }

    let scheduledDeliveryTime: string | undefined;
    if (canScheduleOrder && scheduleOption === 'scheduled') {
      if (!scheduledDate) {
        errs.scheduledDate = 'Choose a date for your order.';
      }
      if (!scheduledTime) {
        errs.scheduledTime = 'Choose a time for your order.';
      }
      if (scheduledDate && scheduledTime) {
        const candidate = new Date(`${scheduledDate}T${scheduledTime}`);
        if (Number.isNaN(candidate.getTime())) {
          errs.scheduledTime = 'Enter a valid future time.';
        } else if (candidate.getTime() <= Date.now() + 5 * 60 * 1000) {
          errs.scheduledTime = 'Please pick a future time (at least 5 minutes from now).';
        } else {
          scheduledDeliveryTime = `${scheduledDate}T${scheduledTime}`;
        }
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const cleanDeliveryInstructions = deliveryInstructions.trim().slice(0, 115);
    const cleanDietaryNotes = dietaryNotes.trim().slice(0, 115);
    const combinedNote = [
      cleanDeliveryInstructions ? `Delivery: ${cleanDeliveryInstructions}` : '',
      cleanDietaryNotes ? `Dietary: ${cleanDietaryNotes}` : '',
    ]
      .filter(Boolean)
      .join(' | ')
      .slice(0, 240);

    onSubmitOrder(
      {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        date: scheduledDeliveryTime ? scheduledDate : date,
        time: scheduledDeliveryTime ? scheduledTime : time,
        guests,
        table: isDineIn ? `Dine-in #${dineInTableInput.trim()}` : table,
        note: combinedNote,
      },
      {
        deliveryInstructions: cleanDeliveryInstructions,
        dietaryNotes: cleanDietaryNotes,
        ...(scheduledDeliveryTime ? { scheduledDeliveryTime } : {}),
        paymentMethod,
        ...(mode === 'delivery' && deliveryCoords ? { deliveryCoords } : {}),
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkoutTitle"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-[#111111]">
        <div className="px-5 py-4 border-b border-neutral-200 bg-[#FAFAFA] flex items-center justify-between">
          <h2 id="checkoutTitle" className="font-display font-extrabold italic text-xl text-[#111111] tracking-tight">
            {t('Checkout')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="w-9 h-9 rounded-lg border border-neutral-200 bg-white text-neutral-600 hover:text-[#111111] hover:border-[#F2B01E] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto bg-white">
            <div className="p-3 rounded-lg bg-[#FAFAFA] border border-[#F2B01E] text-xs font-semibold text-[#111111]">
              {modeNotices[mode]}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Your name *</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  required
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
                />
                {errors.name && <span className="text-xs text-red-600 font-medium mt-0.5 block">{errors.name}</span>}
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">Phone *</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  readOnly={Boolean(rewardsProfile)}
                  placeholder="+998 90 123 45 67"
                  required
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E] read-only:bg-[#FAFAFA] read-only:text-neutral-600"
                />
                {errors.phone && (
                  <span className="text-xs text-red-600 font-medium mt-0.5 block">{errors.phone}</span>
                )}
              </label>
            </div>

            {mode === 'delivery' && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Delivery address *</span>
                  <textarea
                    rows={2}
                    maxLength={180}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, building, apartment, landmark in Bukhara…"
                    className="mt-1 w-full p-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
                  />
                  {errors.address && (
                    <span className="text-xs text-red-600 font-medium mt-0.5 block">{errors.address}</span>
                  )}
                </label>

                <DeliveryPinPicker
                  lang={lang}
                  value={deliveryCoords}
                  onChange={(coords, suggested) => {
                    setDeliveryCoords(coords);
                    if (suggested && (!address.trim() || address.startsWith('Bukhara Pin') || address.includes('Bukhara ('))) {
                      setAddress(suggested);
                    }
                  }}
                />
              </div>
            )}

            {isDineIn && (
              <label className="block">
                <span className="text-xs font-semibold text-neutral-600">{t('Table')} # *</span>
                <input
                  value={dineInTableInput}
                  onChange={(e) => setDineInTableInput(e.target.value)}
                  maxLength={10}
                  placeholder="e.g. 7"
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-neutral-200 text-sm font-mono text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
                />
                {errors.dineInTable && (
                  <span className="text-xs text-red-600 font-medium mt-0.5 block">{errors.dineInTable}</span>
                )}
              </label>
            )}

            {/* Order Timing: ASAP vs Schedule for later */}
            {canScheduleOrder && (
              <div className="space-y-2.5">
                <div className="text-xs font-semibold text-neutral-600 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-[#E5A210]" />
                  <span>{t('Order timing')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleOption('asap');
                      setErrors((prev) => {
                        const { scheduledDate: _d, scheduledTime: _t, ...rest } = prev;
                        return rest;
                      });
                    }}
                    className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      scheduleOption === 'asap'
                        ? 'bg-[#F2B01E] text-[#111111] border-[#F2B01E] font-bold'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#F2B01E] hover:text-[#111111]'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {t('ASAP')}{' '}
                      {mode === 'delivery'
                        ? `(${settings.etaMin}–${settings.etaMax}m)`
                        : mode === 'pickup'
                          ? '(15–20m)'
                          : ''}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScheduleOption('scheduled');
                      const defaults = getDefaultFutureSchedule();
                      setScheduledDate((prev) => prev || defaults.date);
                      setScheduledTime((prev) => prev || defaults.time);
                    }}
                    className={`h-10 px-3 rounded-lg border text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                      scheduleOption === 'scheduled'
                        ? 'bg-[#F2B01E] text-[#111111] border-[#F2B01E] font-bold'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-[#F2B01E] hover:text-[#111111]'
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('Schedule for later')}</span>
                  </button>
                </div>

                {scheduleOption === 'scheduled' && (
                  <div className="p-3 rounded-lg bg-[#FAFAFA] border border-neutral-200 space-y-2.5">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs font-semibold text-neutral-600">
                          {t('Scheduled date')} *
                        </span>
                        <input
                          type="date"
                          min={minDateStr}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                        />
                        {errors.scheduledDate && (
                          <span className="text-xs text-red-600 font-medium mt-0.5 block">
                            {errors.scheduledDate}
                          </span>
                        )}
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-neutral-600">
                          {t('Scheduled time')} *
                        </span>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm font-mono text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                        />
                        {errors.scheduledTime && (
                          <span className="text-xs text-red-600 font-medium mt-0.5 block">
                            {errors.scheduledTime}
                          </span>
                        )}
                      </label>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      Kitchen hours: {settings.open}–{settings.close} (Bukhara)
                    </p>
                  </div>
                )}
              </div>
            )}

            {isReservation && (
              <div className="grid grid-cols-2 gap-3.5">
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Date *</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                  />
                  {errors.date && (
                    <span className="text-xs text-red-600 font-medium mt-0.5 block">{errors.date}</span>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Time *</span>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                  />
                  {errors.time && (
                    <span className="text-xs text-red-600 font-medium mt-0.5 block">{errors.time}</span>
                  )}
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Guests</span>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                  >
                    {['2', '3', '4', '5', '6', '8'].map((g) => (
                      <option key={g} value={g}>
                        {g} guests
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Table preference</span>
                  <select
                    value={table}
                    onChange={(e) => setTable(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-neutral-200 bg-white text-sm text-[#111111] focus:outline-none focus:border-[#F2B01E]"
                  >
                    <option value="Any">No preference</option>
                    <option value="Inside">Inside</option>
                    <option value="Terrace">Terrace</option>
                  </select>
                </label>
              </div>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">
                {t('Special delivery instructions (optional)')}
              </span>
              <textarea
                rows={2}
                maxLength={115}
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                placeholder={
                  mode === 'delivery'
                    ? 'Gate code, floor/entrance, call on arrival, leave at door…'
                    : 'Arrival timing, pickup car details, or special handoff notes…'
                }
                className="mt-1 w-full p-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-neutral-600">
                {t('Dietary notes & allergies (optional)')}
              </span>
              <textarea
                rows={2}
                maxLength={115}
                value={dietaryNotes}
                onChange={(e) => setDietaryNotes(e.target.value)}
                placeholder="Allergies, dairy/nut sensitivity, no onions, extra napkins…"
                className="mt-1 w-full p-3 rounded-lg bg-white border border-neutral-200 text-sm text-[#111111] placeholder:text-neutral-400 focus:outline-none focus:border-[#F2B01E]"
              />
            </label>

            {/* Uzbekistan Local Payment Method Selector */}
            {!isReservation && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-600 block">
                  Payment method (Uzbekistan)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'cash' as const, label: 'Cash', sub: 'UZS on handoff', icon: Banknote },
                    { id: 'terminal' as const, label: 'Uzcard / Humo', sub: 'Card terminal', icon: CreditCard },
                    { id: 'click' as const, label: 'Click', sub: 'Instant transfer', icon: Smartphone },
                    { id: 'payme' as const, label: 'Payme', sub: 'Mobile wallet', icon: Smartphone },
                  ].map((pm) => {
                    const Icon = pm.icon;
                    const active = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        aria-pressed={active}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          active
                            ? 'bg-[#FAFAFA] border-[#F2B01E] ring-2 ring-[#F2B01E]/25 text-[#111111]'
                            : 'bg-white border-neutral-200 text-neutral-600 hover:border-[#F2B01E] hover:text-[#111111]'
                        }`}
                      >
                        <span
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            active ? 'bg-[#F2B01E] text-[#111111]' : 'bg-[#FAFAFA] border border-neutral-200 text-[#E5A210]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold leading-tight truncate text-[#111111]">
                            {pm.label}
                          </span>
                          <span className="block text-[10px] text-neutral-500 truncate">
                            {pm.sub}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {errorMsg && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {errorMsg}
              </p>
            )}
          </div>

          <div className="px-5 py-4 border-t border-neutral-200 bg-[#FAFAFA] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-600">{t('Total')}</span>
              <span className="font-display font-extrabold text-xl text-[#9E7000] tabular-nums">
                {formatMoney(calc.grandTotal)}
              </span>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-xl bg-[#F2B01E] hover:bg-[#E5A210] disabled:opacity-50 text-[#111111] text-sm font-bold transition-colors cursor-pointer shadow-xs"
            >
              {submitting
                ? 'Placing order…'
                : isReservation
                  ? t('Confirm reservation')
                  : t('Place order')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface SuccessModalProps {
  orderId: string | null;
  order?: Order | null;
  scheduledDeliveryTime?: string;
  lang: Lang;
  onTrack: (id: string) => void;
  onClose: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  orderId,
  order,
  scheduledDeliveryTime,
  lang,
  onTrack,
  onClose,
}) => {
  const t = (k: string) => translate(lang, k);
  if (!orderId) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-md p-6 text-center space-y-4 shadow-2xl text-[#111111]">
        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-7 h-7" />
        </div>
        <h2 className="font-display font-extrabold italic text-2xl text-[#111111] tracking-tight">Order accepted</h2>
        <div className="font-mono text-xs bg-[#FAFAFA] border border-neutral-200 rounded-lg py-2 px-3 text-[#9E7000] font-semibold break-all">
          {orderId}
        </div>
        {scheduledDeliveryTime && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAFAFA] border border-[#F2B01E] text-[#111111] text-xs font-semibold">
            <CalendarClock className="w-3.5 h-3.5 text-[#E5A210]" />
            <span>
              {t('Scheduled for')}:{' '}
              <span className="font-mono tabular-nums text-[#9E7000]">
                {formatScheduledTime(scheduledDeliveryTime)}
              </span>
            </span>
          </div>
        )}
        <p className="text-sm text-neutral-600">
          Your order is synced to our kitchen. Track live preparation updates anytime.
        </p>
        {order && (
          <button
            type="button"
            onClick={() => downloadOrderReceipt(order)}
            className="w-full h-9 rounded-lg border border-neutral-200 bg-white hover:border-[#F2B01E] text-[#9E7000] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Receipt</span>
          </button>
        )}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => onTrack(orderId)}
            className="flex-1 h-10 rounded-lg border border-neutral-200 bg-white text-[#111111] hover:border-[#F2B01E] text-sm font-semibold transition-colors cursor-pointer"
          >
            {t('Track order')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-lg bg-[#F2B01E] hover:bg-[#E5A210] text-[#111111] text-sm font-bold transition-colors cursor-pointer"
          >
            {t('Back to menu')}
          </button>
        </div>
      </div>
    </div>
  );
};
