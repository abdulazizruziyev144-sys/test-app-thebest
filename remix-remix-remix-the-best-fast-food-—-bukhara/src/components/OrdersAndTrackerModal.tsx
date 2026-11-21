import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Bell, CalendarClock, Check, Clock, Download, MessageSquare, Printer, RotateCcw, Truck, X } from 'lucide-react';
import { translate } from '../data/i18n';
import {
  formatMoney,
  formatScheduledTime,
  normalizeLiveStatus,
  ORDER_STATUS_LABELS,
} from '../lib/calculations';
import { subscribeOrderStatus } from '../lib/firebase';
import { downloadOrderReceipt, PAYMENT_METHOD_LABELS, printOrderTicket } from '../lib/printReceipt';
import type { Lang, Order, OrderNotification, OrderStatus, RestaurantSettings } from '../types';
import { SpendingTrendsChart } from './SpendingTrendsChart';

interface OrdersAndTrackerModalProps {
  open: boolean;
  lang: Lang;
  orders: Order[];
  liveStatuses: Record<string, OrderStatus>;
  liveKitchenNotes?: Record<string, string>;
  notifications: OrderNotification[];
  settings: RestaurantSettings;
  initialTrackOrderId: string | null;
  onClose: () => void;
  onReorder: (order: Order) => void;
  onMarkNotificationsRead: () => void;
  onLiveStatusUpdate: (orderId: string, status: OrderStatus, kitchenNote?: string) => void;
}

const STEPS: Array<{ key: OrderStatus; label: string }> = [
  { key: 'received', label: 'Qabul qilindi' },
  { key: 'preparing', label: 'Tayyorlanmoqda' },
  { key: 'ready', label: 'Tayyor' },
  { key: 'on_the_way', label: 'Yo’lda' },
  { key: 'delivered', label: 'Yetkazildi' },
];

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

function getCountdownInfo(
  order: Order,
  status: OrderStatus,
  settings: RestaurantSettings,
  nowMs: number
) {
  const etaMin = Math.max(1, Number(settings.etaMin) || 25);
  const etaMax = Math.max(etaMin, Number(settings.etaMax) || 35);
  const parsedCreated = Date.parse(order.createdAt);
  const createdMs = Number.isFinite(parsedCreated) ? parsedCreated : nowMs;
  const targetMinMs = createdMs + etaMin * 60_000;
  const targetMaxMs = createdMs + etaMax * 60_000;

  const remainingMinMs = Math.max(0, targetMinMs - nowMs);
  const remainingMaxMs = Math.max(0, targetMaxMs - nowMs);
  const totalSpanMs = Math.max(1, targetMaxMs - createdMs);
  const elapsedPct = Math.min(100, Math.max(0, Math.round(((nowMs - createdMs) / totalSpanMs) * 100)));

  const formatTime = (ms: number) =>
    new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return {
    etaMin,
    etaMax,
    remainingMinMs,
    remainingMaxMs,
    elapsedPct: status === 'ready' || status === 'delivered' ? 100 : elapsedPct,
    readyWindowLabel: `${formatTime(targetMinMs)}–${formatTime(targetMaxMs)}`,
  };
}

export const OrdersAndTrackerModal: React.FC<OrdersAndTrackerModalProps> = ({
  open,
  lang,
  orders,
  liveStatuses,
  liveKitchenNotes = {},
  notifications,
  settings,
  initialTrackOrderId,
  onClose,
  onReorder,
  onMarkNotificationsRead,
  onLiveStatusUpdate,
}) => {
  const t = (k: string) => translate(lang, k);
  const [trackedId, setTrackedId] = useState<string | null>(initialTrackOrderId);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [poppedOrderId, setPoppedOrderId] = useState<string | null>(null);
  const reorderTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setTrackedId(initialTrackOrderId);
  }, [initialTrackOrderId]);

  useEffect(() => {
    if (open) {
      onMarkNotificationsRead();
      setNowMs(Date.now());
    } else {
      setPoppedOrderId(null);
      if (reorderTimerRef.current !== null) {
        window.clearTimeout(reorderTimerRef.current);
        reorderTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (reorderTimerRef.current !== null) {
        window.clearTimeout(reorderTimerRef.current);
      }
    };
  }, []);

  const handleAnimatedReorder = (order: Order) => {
    setPoppedOrderId(order.id);
    if (reorderTimerRef.current !== null) {
      window.clearTimeout(reorderTimerRef.current);
    }
    reorderTimerRef.current = window.setTimeout(() => {
      setPoppedOrderId(null);
      reorderTimerRef.current = null;
      onReorder(order);
    }, 180);
  };

  // 1-second live countdown ticker while modal is open
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  // Live Firestore subscription when tracking an order
  useEffect(() => {
    if (!open || !trackedId) return;
    if (!/^[a-zA-Z0-9_-]{20,128}$/.test(trackedId)) return;
    const unsub = subscribeOrderStatus(trackedId, (id, rawStatus, exists, kitchenNote) => {
      if (exists && rawStatus) {
        onLiveStatusUpdate(id, normalizeLiveStatus(rawStatus), kitchenNote);
      }
    });
    return () => unsub();
  }, [open, trackedId]);

  if (!open) return null;

  const trackedOrder = trackedId ? orders.find((o) => o.id === trackedId) || null : null;
  const trackedStatus: OrderStatus = trackedOrder
    ? liveStatuses[trackedOrder.id] ?? normalizeLiveStatus(trackedOrder.status)
    : 'received';
  const trackedKitchenNote = trackedOrder
    ? liveKitchenNotes[trackedOrder.id] ?? trackedOrder.kitchenNote
    : undefined;

  const stepIndex = STEPS.findIndex((s) => s.key === trackedStatus);
  const countdown = trackedOrder
    ? getCountdownInfo(trackedOrder, trackedStatus, settings, nowMs)
    : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#191919]/35 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ordersTitle"
    >
      <div className="bg-[#FAF8F3] border border-[#191919]/12 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl text-[#191919]">
        <div className="px-5 py-4 border-b border-[#191919]/10 bg-[#F2EDE3] flex items-center justify-between">
          <div>
            <h2 id="ordersTitle" className="font-display font-extrabold text-xl text-[#191919] tracking-tight">
              {trackedOrder ? t('Order status') : t('Your orders')}
            </h2>
            <p className="text-xs text-[#5C5346] mt-0.5">
              Live status updates & one-click reorder
            </p>
          </div>
          <div className="flex items-center gap-2">
            {trackedOrder && (
              <button
                type="button"
                onClick={() => setTrackedId(null)}
                className="h-9 px-3 rounded-lg border border-[#191919]/14 bg-white text-xs font-semibold text-[#191919] hover:border-[#E9A92F] transition-colors cursor-pointer"
              >
                {t('All Orders')} ({orders.length})
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close orders"
              className="w-9 h-9 rounded-lg border border-[#191919]/14 bg-white text-[#5C5346] hover:text-[#191919] hover:border-[#E9A92F] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Live Order Tracker View */}
          {trackedOrder && countdown ? (
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-white border border-[#191919]/10 shadow-xs space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-xs text-[#5C5346]">{t('Order Reference')}</div>
                    <div className="font-mono text-sm font-bold text-[#B67A0E] break-all">
                      {trackedOrder.id}
                    </div>
                    <div className="text-xs text-[#5C5346] mt-1">
                      {trackedOrder.scheduledDeliveryTime ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#191919]">
                          <CalendarClock className="w-3.5 h-3.5 text-[#D8961D]" />
                          {t('Scheduled for')}:{' '}
                          <span className="font-mono tabular-nums text-[#B67A0E]">
                            {formatScheduledTime(trackedOrder.scheduledDeliveryTime)}
                          </span>
                        </span>
                      ) : (
                        <>
                          {t('Ready window')}:{' '}
                          <span className="font-mono tabular-nums text-[#191919] font-semibold">
                            {countdown.readyWindowLabel}
                          </span>{' '}
                          ({countdown.etaMin}–{countdown.etaMax} min)
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-[#5C5346] flex items-center justify-end gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#D8961D]" />
                      <span>{t('Estimated time remaining')}</span>
                    </div>
                    {trackedStatus === 'declined' ? (
                      <div className="font-display font-bold text-lg text-red-600">
                        {t('Order declined')}
                      </div>
                    ) : trackedStatus === 'delivered' ? (
                      <div className="font-display font-bold text-xl text-emerald-700 tabular-nums">
                        {t('Delivered')}
                      </div>
                    ) : trackedStatus === 'ready' ? (
                      <div className="font-display font-bold text-xl text-emerald-700 tabular-nums">
                        {t('Ready now')}
                      </div>
                    ) : (
                      <div>
                        <div className="font-mono font-bold text-2xl text-[#B67A0E] tabular-nums tracking-tight">
                          {countdown.remainingMaxMs > 0
                            ? formatCountdown(countdown.remainingMaxMs)
                            : '00:00'}
                        </div>
                        <div className="text-[11px] font-medium text-[#5C5346] tabular-nums">
                          {countdown.remainingMinMs > 0
                            ? `${t('Earliest in')} ${formatCountdown(countdown.remainingMinMs)}`
                            : countdown.remainingMaxMs > 0
                              ? t('Ready now')
                              : t('Order ready any moment')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {trackedStatus !== 'declined' && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[#FAF8F3] border border-[#191919]/10 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          trackedStatus === 'delivered' || trackedStatus === 'ready'
                            ? 'bg-emerald-600'
                            : 'bg-[#E9A92F]'
                        }`}
                        style={{ width: `${countdown.elapsedPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {trackedStatus === 'declined' ? (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm font-semibold text-red-700">
                    Order Declined ({ORDER_STATUS_LABELS.declined}). Please contact +998 (65) 222-89-89.
                  </div>
                ) : (
                  <div className="space-y-4 pt-3">
                    {/* Dot-Based Visual Progress Stepper */}
                    <div
                      className="relative"
                      role="list"
                      aria-label="Order progress"
                    >
                      <div className="flex items-start justify-between">
                        {STEPS.map((st, idx) => {
                          const isDelivered = trackedStatus === 'delivered';
                          const isCompleted = idx < stepIndex || (isDelivered && idx === stepIndex);
                          const isCurrent = idx === stepIndex && !isDelivered;
                          const isLineFilled = idx < stepIndex;
                          const accentBg = isDelivered ? 'bg-emerald-600 text-white' : 'bg-[#E9A92F] text-[#191919]';
                          const accentRing = isDelivered
                            ? 'ring-emerald-600/25'
                            : 'ring-[#E9A92F]/35';
                          const accentText = isDelivered ? 'text-emerald-700' : 'text-[#B67A0E]';

                          return (
                            <React.Fragment key={st.key}>
                              <div
                                role="listitem"
                                aria-current={idx === stepIndex ? 'step' : undefined}
                                className="flex flex-col items-center text-center min-w-0 flex-1 relative z-10"
                              >
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                                    isCompleted
                                      ? `${accentBg} shadow-xs`
                                      : isCurrent
                                        ? `${accentBg} ring-4 ${accentRing} shadow-sm`
                                        : 'bg-[#FAF8F3] border-2 border-[#191919]/18 text-[#5C5346]'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <Check className="w-3.5 h-3.5 stroke-[2.75]" />
                                  ) : isCurrent ? (
                                    <span className={`w-2.5 h-2.5 rounded-full ${isDelivered ? 'bg-white' : 'bg-[#191919]'}`} />
                                  ) : (
                                    <span className="w-2 h-2 rounded-full bg-[#5C5346]/30" />
                                  )}
                                </div>
                                <span
                                  className={`mt-2 text-[11px] leading-tight px-0.5 ${
                                    idx === stepIndex
                                      ? `${accentText} font-bold`
                                      : isCompleted
                                        ? 'text-[#191919] font-semibold'
                                        : 'text-[#5C5346]/75 font-medium'
                                  }`}
                                >
                                  {t(st.label)}
                                </span>
                              </div>

                              {idx < STEPS.length - 1 && (
                                <div
                                  aria-hidden="true"
                                  className="flex-1 h-0.5 mt-3.5 -mx-3 sm:-mx-5 bg-[#191919]/12 relative overflow-hidden rounded-full"
                                >
                                  <div
                                    className={`h-full transition-all duration-500 ${
                                      isLineFilled
                                        ? `${isDelivered ? 'bg-emerald-600' : 'bg-[#E9A92F]'} w-full`
                                        : 'w-0'
                                    }`}
                                  />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-[#191919] flex items-center gap-2 pt-1">
                      <Truck className="w-4 h-4 text-[#D8961D]" />
                      <span>{t('Current status')}: {t(ORDER_STATUS_LABELS[trackedStatus])}</span>
                    </div>

                    {trackedKitchenNote && (
                      <div className="p-3 rounded-xl bg-[#E9A92F]/15 border border-[#E9A92F]/45 text-xs font-semibold text-[#191919] flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#D8961D] shrink-0" />
                        <span>Kitchen update: {trackedKitchenNote}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border border-[#191919]/10 bg-white rounded-xl p-5 shadow-xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#5C5346]">
                    {t('Order Items')}
                    {trackedOrder.paymentMethod && (
                      <span className="ml-2 text-[#B67A0E] normal-case">
                        · {PAYMENT_METHOD_LABELS[trackedOrder.paymentMethod]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => printOrderTicket(trackedOrder, 'customer')}
                      className="h-7 px-2.5 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] hover:border-[#E9A92F] text-[11px] font-semibold text-[#191919] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Printer className="w-3 h-3 text-[#D8961D]" />
                      <span>Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadOrderReceipt(trackedOrder)}
                      className="h-7 px-2.5 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] hover:border-[#E9A92F] text-[11px] font-semibold text-[#191919] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-[#D8961D]" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
                {trackedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[#5C5346]">
                      <strong className="font-mono tabular-nums text-[#191919]">{item.qty}×</strong> {t(item.name)}
                    </span>
                    <span className="font-mono text-[#191919] tabular-nums">
                      {formatMoney(item.unit * item.qty)}
                    </span>
                  </div>
                ))}
                <div className="pt-3 border-t border-[#191919]/10 flex justify-between font-bold text-[#191919]">
                  <span>{t('Total')}</span>
                  <span className="font-mono tabular-nums text-[#B67A0E]">
                    {formatMoney(trackedOrder.totals.total)}
                  </span>
                </div>

                {(trackedOrder.deliveryInstructions ||
                  trackedOrder.dietaryNotes ||
                  trackedOrder.customer?.note) && (
                  <div className="pt-3 border-t border-[#191919]/10 space-y-1.5 text-xs text-[#5C5346]">
                    {trackedOrder.deliveryInstructions && (
                      <div>
                        <span className="font-semibold text-[#191919]">{t('Delivery instructions')}:</span>{' '}
                        {trackedOrder.deliveryInstructions}
                      </div>
                    )}
                    {trackedOrder.dietaryNotes && (
                      <div>
                        <span className="font-semibold text-[#191919]">{t('Dietary notes')}:</span>{' '}
                        {trackedOrder.dietaryNotes}
                      </div>
                    )}
                    {!trackedOrder.deliveryInstructions &&
                      !trackedOrder.dietaryNotes &&
                      trackedOrder.customer?.note && (
                        <div>
                          <span className="font-semibold text-[#191919]">Note:</span>{' '}
                          {trackedOrder.customer.note}
                        </div>
                      )}
                  </div>
                )}
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.96 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => handleAnimatedReorder(trackedOrder)}
                className="h-10 w-full rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t('Reorder')}</span>
              </motion.button>
            </div>
          ) : (
            <>
              {/* Recent Notifications Feed */}
              {notifications.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#5C5346] flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-[#D8961D]" />
                    <span>{t('Live Updates')}</span>
                  </div>
                  <div className="space-y-2">
                    {notifications.slice(0, 4).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setTrackedId(n.orderId)}
                        className="w-full text-left p-3 rounded-xl bg-white border border-[#191919]/10 hover:border-[#E9A92F] flex items-center justify-between gap-3 transition-colors cursor-pointer shadow-xs"
                      >
                        <div className="text-xs text-[#191919]">
                          <strong>{n.message}</strong>
                          <span className="text-[#5C5346] block mt-0.5 font-mono">
                            {n.orderId.slice(0, 12)}… · {new Date(n.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Spending Trends Chart (Last 5 Orders) */}
              {orders.length > 0 && <SpendingTrendsChart lang={lang} orders={orders} />}

              {/* Orders History List */}
              {orders.length === 0 ? (
                <div className="py-12 text-center border border-[#191919]/10 rounded-xl bg-white">
                  <p className="text-sm text-[#5C5346]">{t('No orders placed yet on this device.')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {[...orders].reverse().map((order) => {
                    const st = liveStatuses[order.id] ?? normalizeLiveStatus(order.status);
                    const isActiveOrder = st !== 'delivered' && st !== 'declined' && st !== 'ready';
                    const orderCd = isActiveOrder
                      ? getCountdownInfo(order, st, settings, nowMs)
                      : null;
                    const isPopping = poppedOrderId === order.id;

                    return (
                      <div
                        key={order.id}
                        className="border border-[#191919]/10 rounded-xl p-4 space-y-3 bg-white shadow-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono text-xs font-bold text-[#B67A0E]">
                              {order.id}
                            </span>
                            <div className="text-xs text-[#5C5346] mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{order.mode} · {new Date(order.createdAt).toLocaleString()}</span>
                              {order.scheduledDeliveryTime ? (
                                <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#191919] tabular-nums">
                                  · <CalendarClock className="w-3 h-3 text-[#D8961D]" />
                                  {t('Scheduled')}: {formatScheduledTime(order.scheduledDeliveryTime)}
                                </span>
                              ) : (
                                orderCd && (
                                  <span className="font-mono font-semibold text-[#B67A0E] tabular-nums">
                                    · {orderCd.remainingMaxMs > 0 ? formatCountdown(orderCd.remainingMaxMs) : t('Order ready any moment')}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                              st === 'delivered'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : st === 'declined'
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-[#FAF8F3] text-[#B67A0E] border border-[#E9A92F]/45'
                            }`}
                          >
                            {t(ORDER_STATUS_LABELS[st])}
                          </span>
                        </div>

                        <p className="text-sm text-[#5C5346]">
                          {order.items.map((i) => `${i.qty}× ${t(i.name)}`).join(', ') ||
                            'Table reservation'}
                        </p>

                        {/* Compact Dot-Based Progress Stepper */}
                        {st !== 'declined' && (() => {
                          const cardStepIdx = STEPS.findIndex((s) => s.key === st);
                          const isDelivered = st === 'delivered';
                          const dotColor = isDelivered ? 'bg-emerald-600' : 'bg-[#E9A92F]';
                          const ringColor = isDelivered ? 'ring-emerald-600/25' : 'ring-[#E9A92F]/35';
                          return (
                            <div className="pt-1 flex items-center" aria-label={`Status: ${t(ORDER_STATUS_LABELS[st])}`}>
                              {STEPS.map((step, sIdx) => {
                                const done = sIdx < cardStepIdx || (isDelivered && sIdx === cardStepIdx);
                                const active = sIdx === cardStepIdx && !isDelivered;
                                return (
                                  <React.Fragment key={step.key}>
                                    <div
                                      title={t(step.label)}
                                      className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                                        done
                                          ? dotColor
                                          : active
                                            ? `${dotColor} ring-4 ${ringColor}`
                                            : 'bg-[#FAF8F3] border border-[#191919]/25'
                                      }`}
                                    />
                                    {sIdx < STEPS.length - 1 && (
                                      <div
                                        className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                                          sIdx < cardStepIdx ? dotColor : 'bg-[#191919]/12'
                                        }`}
                                      />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          );
                        })()}

                        <div className="pt-2 border-t border-[#191919]/10 flex items-center justify-between gap-3">
                          <span className="font-mono font-bold text-sm text-[#B67A0E] tabular-nums">
                            {formatMoney(order.totals?.total || 0)}
                          </span>

                          <div className="flex items-center gap-2">
                            {order.items.length > 0 && (
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.9 }}
                                animate={isPopping ? { scale: [1, 1.14, 0.96, 1] } : { scale: 1 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                onClick={() => handleAnimatedReorder(order)}
                                className="h-8 px-3 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] hover:border-[#E9A92F] text-xs font-semibold text-[#191919] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{t('Reorder')}</span>
                              </motion.button>
                            )}
                            <button
                              type="button"
                              onClick={() => setTrackedId(order.id)}
                              className="h-8 px-3 rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-xs font-bold transition-colors cursor-pointer"
                            >
                              {t('Track order')}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
