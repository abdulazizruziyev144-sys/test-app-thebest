import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  ChefHat,
  Check,
  Clock,
  Download,
  LogOut,
  MessageSquare,
  Package,
  Printer,
  Settings as SettingsIcon,
  ShieldCheck,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../data/menu';
import { translate } from '../data/i18n';
import {
  formatMoney,
  formatScheduledTime,
  normalizeLiveStatus,
  ORDER_STATUS_LABELS,
} from '../lib/calculations';
import {
  fetchOrdersFromFirestore,
  getAdminSession,
  loginAdmin,
  loginAdminWithGoogle,
  signOutAdmin,
  updateOrderKitchenNoteInFirestore,
  updateOrderStatusInFirestore,
} from '../lib/firebase';
import { PAYMENT_METHOD_LABELS, printOrderTicket } from '../lib/printReceipt';
import {
  Lang,
  MenuItem,
  Order,
  OrderStatus,
  Promotion,
  RestaurantSettings,
  Review,
} from '../types';

interface AdminDashboardModalProps {
  open: boolean;
  lang: Lang;
  menuItems: MenuItem[];
  settings: RestaurantSettings;
  promos: Record<string, Promotion>;
  onClose: () => void;
  onUpdateMenuItem: (id: string, patch: { price?: number; desc?: string; available?: boolean }) => void;
  onSaveSettings: (next: RestaurantSettings) => void;
  onSaveServerMenu: (token: string, nextSettings?: RestaurantSettings) => Promise<void>;
  onToast: (msg: string) => void;
}

type AdminTab = 'kitchen' | 'analytics' | 'inventory' | 'promotions' | 'reviews' | 'settings';

function playKitchenChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch {
    // ignore audio restrictions
  }
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  open,
  lang,
  menuItems,
  settings,
  promos,
  onClose,
  onUpdateMenuItem,
  onSaveSettings,
  onSaveServerMenu,
  onToast,
}) => {
  const t = (k: string) => translate(lang, k);
  const [adminToken, setAdminToken] = useState<string>('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<AdminTab>('kitchen');
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [adminError, setAdminError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoRate, setNewPromoRate] = useState('15');
  const [settingsForm, setSettingsForm] = useState(settings);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  // Restore existing Firebase admin session when modal opens
  useEffect(() => {
    if (!open) return;
    getAdminSession().then((session) => {
      if (session) {
        setAdminToken(session.token);
      }
    });
  }, [open]);

  const loadAdminData = async (token: string) => {
    const errors: string[] = [];
    const [fsRes, apiRes, revRes] = await Promise.allSettled([
      fetchOrdersFromFirestore(),
      fetch('/api/orders', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch('/api/reviews?pending=1', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }).then(async (r) => {
        if (!r.ok) throw new Error(`Reviews HTTP ${r.status}`);
        return r.json();
      }),
    ]);

    const mergedMap = new Map<string, Order>();
    if (fsRes.status === 'fulfilled' && Array.isArray(fsRes.value)) {
      fsRes.value.forEach((o) => mergedMap.set(o.id, o));
    } else if (fsRes.status === 'rejected') {
      errors.push(`Firestore Orders: ${fsRes.reason?.message || 'Error'}`);
    }

    if (apiRes.status === 'fulfilled' && Array.isArray(apiRes.value)) {
      apiRes.value.forEach((o: Order) => {
        if (!mergedMap.has(o.id)) mergedMap.set(o.id, o);
      });
    }

    const mergedOrders = [...mergedMap.values()].sort(
      (a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
    );

    if (knownOrderIdsRef.current.size > 0) {
      const hasNew = mergedOrders.some(
        (o) => !knownOrderIdsRef.current.has(o.id) && normalizeLiveStatus(o.status) === 'received'
      );
      if (hasNew && soundEnabled) {
        playKitchenChime();
        onToast('New incoming kitchen order!');
      }
    }
    knownOrderIdsRef.current = new Set(mergedOrders.map((o) => o.id));
    setOrders(mergedOrders);

    if (revRes.status === 'fulfilled' && Array.isArray(revRes.value)) {
      setReviews(revRes.value);
    } else if (revRes.status === 'rejected') {
      errors.push(revRes.reason?.message || 'Could not load reviews.');
    }

    setAdminError(errors.join(' · '));
  };

  useEffect(() => {
    if (!open || !adminToken) return;
    loadAdminData(adminToken);
    const timer = window.setInterval(() => loadAdminData(adminToken), 5000);
    return () => window.clearInterval(timer);
  }, [open, adminToken, soundEnabled]);

  // Analytics calculations from real orders
  const analytics = useMemo(() => {
    const valid = orders.filter((o) => normalizeLiveStatus(o.status) !== 'declined');
    const totalRevenue = valid.reduce((s, o) => s + (o.totals?.total || 0), 0);
    const activeOrders = orders.filter((o) =>
      ['received', 'preparing', 'ready', 'on_the_way'].includes(normalizeLiveStatus(o.status))
    );
    const completedOrders = orders.filter((o) => normalizeLiveStatus(o.status) === 'delivered');
    const avgOrder = valid.length ? Math.round(totalRevenue / valid.length) : 0;

    // Top dishes
    const itemStats = new Map<string, { name: string; qty: number; rev: number }>();
    valid.forEach((o) => {
      (o.items || []).forEach((it) => {
        const cur = itemStats.get(it.name) || { name: it.name, qty: 0, rev: 0 };
        cur.qty += it.qty;
        cur.rev += it.qty * (it.unit || 0);
        itemStats.set(it.name, cur);
      });
    });
    const topDishes = [...itemStats.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);

    // Daily revenue (last 7 days)
    const dayMap = new Map<string, number>();
    valid.forEach((o) => {
      const day = (o.createdAt || '').slice(0, 10) || 'Today';
      dayMap.set(day, (dayMap.get(day) || 0) + (o.totals?.total || 0));
    });
    const dailyBars = [...dayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([day, rev]) => ({ day: day.slice(5), rev }));

    const modeCounts = {
      delivery: valid.filter((o) => o.mode === 'delivery').length,
      pickup: valid.filter((o) => o.mode === 'pickup').length,
      reservation: valid.filter((o) => o.mode === 'reservation').length,
    };

    return {
      totalRevenue,
      activeOrders,
      completedOrders,
      avgOrder,
      topDishes,
      dailyBars,
      modeCounts,
    };
  }, [orders]);

  if (!open) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await loginAdmin(adminEmail.trim(), adminPassword);
      setAdminToken(res.token);
      setAdminPassword('');
      onToast('Admin dashboard unlocked.');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleGoogleAdminLogin = async () => {
    setLoginError('');
    setLoggingIn(true);
    try {
      const res = await loginAdminWithGoogle();
      setAdminToken(res.token);
      onToast('Owner & Kitchen console unlocked.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google authentication failed.';
      if (!msg.includes('popup-closed-by-user')) {
        setLoginError(msg);
      }
    } finally {
      setLoggingIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    setAdminToken('');
    setOrders([]);
    onToast('Signed out.');
  };

  const handleStatusChange = async (orderId: string, nextStatus: OrderStatus) => {
    try {
      await updateOrderStatusInFirestore(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
      );
      onToast(`Order ${orderId.slice(0, 8)}… updated to ${ORDER_STATUS_LABELS[nextStatus]}.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleSendKitchenNote = async (orderId: string, note: string) => {
    try {
      await updateOrderKitchenNoteInFirestore(orderId, note);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, kitchenNote: note } : o))
      );
      onToast(`Kitchen note sent to #${orderId.slice(0, 8)}…`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not send kitchen note.');
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(orders, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'the-best-orders.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportCsv = () => {
    const header = 'ID,Mode,Status,Customer,Phone,Total_UZS,CreatedAt\n';
    const rows = orders
      .map(
        (o) =>
          `"${o.id}","${o.mode}","${o.status}","${(o.customer?.name || '').replace(/"/g, '""')}","${o.customer?.phone || ''}",${o.totals?.total || 0},"${o.createdAt}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'the-best-orders.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleReviewAction = async (id: string, action: 'approve' | 'delete') => {
    try {
      const res = await fetch('/api/reviews', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(action === 'delete' ? { id, remove: true } : { id, approved: true }),
      });
      if (!res.ok) throw new Error('Could not update review.');
      setReviews((prev) =>
        action === 'delete'
          ? prev.filter((r) => r.id !== id)
          : prev.map((r) => (r.id === id ? { ...r, approved: true } : r))
      );
      onToast(action === 'delete' ? 'Review removed.' : 'Review approved.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Review update failed.');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newPromoCode.trim().toUpperCase();
    const rate = Number(newPromoRate) / 100;
    if (!/^[A-Z0-9]{2,16}$/.test(code) || !(rate > 0 && rate <= 0.4) || promos[code]) {
      onToast('Use a unique alphanumeric code and discount 1–40%.');
      return;
    }
    const nextSettings: RestaurantSettings = {
      ...settings,
      customPromos: [...settings.customPromos, { code, rate }],
    };
    onSaveSettings(nextSettings);
    setNewPromoCode('');
    try {
      await onSaveServerMenu(adminToken, nextSettings);
      onToast(`Promo ${code} created.`);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Saved locally.');
    }
  };

  const handleTogglePromo = async (code: string, enabled: boolean) => {
    const promoOff = enabled
      ? settings.promoOff.filter((c) => c !== code)
      : [...new Set([...settings.promoOff, code])];
    const nextSettings = { ...settings, promoOff };
    onSaveSettings(nextSettings);
    try {
      await onSaveServerMenu(adminToken, nextSettings);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Saved locally.');
    }
  };

  const handleSaveRestaurantSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(settingsForm);
    try {
      await onSaveServerMenu(adminToken, settingsForm);
      onToast('Restaurant settings saved.');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Saved locally.');
    }
  };

  const maxDailyRev = Math.max(1, ...analytics.dailyBars.map((b) => b.rev));

  // Kitchen Display Columns
  const kdsIncoming = orders.filter((o) => normalizeLiveStatus(o.status) === 'received');
  const kdsPreparing = orders.filter((o) => normalizeLiveStatus(o.status) === 'preparing');
  const kdsReady = orders.filter((o) =>
    ['ready', 'on_the_way'].includes(normalizeLiveStatus(o.status))
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-[#191919]/35 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adminTitle"
    >
      <div className="bg-[#FAF8F3] border border-[#191919]/12 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl text-[#191919]">
        {/* Top Bar */}
        <div className="px-5 py-4 border-b border-[#191919]/10 bg-[#F2EDE3] text-[#191919] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#D8961D]" />
            <h2 id="adminTitle" className="font-display font-extrabold text-lg sm:text-xl tracking-tight">
              THE BEST · Operations & Kitchen Console
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {adminToken && (
              <>
                <button
                  type="button"
                  onClick={() => setSoundEnabled((s) => !s)}
                  title={soundEnabled ? 'Mute new order alerts' : 'Enable new order sound'}
                  className="h-9 px-3 rounded-lg bg-white border border-[#191919]/14 hover:border-[#E9A92F] text-xs font-semibold text-[#191919] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-[#D8961D]" /> : <VolumeX className="w-4 h-4 text-[#5C5346]" />}
                  <span className="hidden sm:inline">{soundEnabled ? 'Alerts On' : 'Muted'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="h-9 px-3 rounded-lg bg-white border border-[#191919]/14 hover:border-[#E9A92F] text-xs font-semibold text-[#191919] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-[#5C5346]" />
                  <span>{t('Sign out')}</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close admin"
              className="w-9 h-9 rounded-lg bg-white border border-[#191919]/14 hover:border-[#E9A92F] text-[#5C5346] hover:text-[#191919] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!adminToken ? (
          <div className="p-8 max-w-md mx-auto w-full my-8">
            <p className="text-xs font-bold uppercase tracking-widest text-[#B67A0E]">
              Restricted Area
            </p>
            <h3 className="font-display font-extrabold text-2xl text-[#191919] mt-1 tracking-tight">
              Owner & Kitchen Sign In
            </h3>
            <p className="text-sm text-[#5C5346] mt-1 mb-5">
              Sign in with an authorized Owner or Kitchen account to manage live orders, kitchen display, menu prices, and analytics. Regular customer accounts are not permitted.
            </p>

            <button
              type="button"
              disabled={loggingIn}
              onClick={handleGoogleAdminLogin}
              className="h-11 w-full rounded-xl bg-white hover:bg-[#F2EDE3] border border-[#191919]/14 hover:border-[#E9A92F] text-[#191919] text-sm font-semibold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                />
              </svg>
              <span>{loggingIn ? 'Verifying…' : 'Sign in with Google (Owner)'}</span>
            </button>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#191919]/12" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#5C5346]">
                or email & password
              </span>
              <div className="h-px flex-1 bg-[#191919]/12" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block">
                <span className="text-xs font-semibold text-[#5C5346]">Owner Email</span>
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="owner@example.com"
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-[#191919]/14 text-sm text-[#191919] placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#5C5346]">Password</span>
                <input
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-[#191919]/14 text-sm text-[#191919] placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
                />
              </label>
              {loginError && <p className="text-xs font-semibold text-red-600">{loginError}</p>}
              <button
                type="submit"
                disabled={loggingIn}
                className="h-11 w-full rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {loggingIn ? 'Unlocking…' : 'Unlock Console'}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="px-5 py-2.5 border-b border-[#191919]/10 bg-[#F2EDE3] flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'kitchen', label: 'Kitchen Display', icon: ChefHat, badge: analytics.activeOrders.length },
                { id: 'analytics', label: 'Sales & Orders', icon: BarChart3 },
                { id: 'inventory', label: t('Inventory'), icon: Package },
                { id: 'promotions', label: t('Promotions'), icon: Tag },
                { id: 'reviews', label: t('Reviews'), icon: Check, badge: reviews.filter((r) => !r.approved).length },
                { id: 'settings', label: t('Settings'), icon: SettingsIcon },
              ].map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id as AdminTab)}
                    className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#E9A92F] text-[#191919] font-bold'
                        : 'text-[#5C5346] hover:bg-white hover:text-[#191919]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                    {typeof item.badge === 'number' && item.badge > 0 && (
                      <span
                        className={`font-mono text-[10px] px-1.5 py-0.5 rounded tabular-nums ${
                          active ? 'bg-[#191919]/15 text-[#191919]' : 'bg-white border border-[#191919]/14 text-[#B67A0E]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {adminError && (
              <div className="px-5 py-2 bg-red-50 text-red-700 text-xs font-medium border-b border-red-200">
                {adminError}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-5 bg-[#FAF8F3]">
              {/* TAB 1: KITCHEN ORDER MANAGEMENT (KDS) */}
              {tab === 'kitchen' && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display font-bold text-xl text-[#191919]">
                        Live Kitchen Order Board
                      </h3>
                      <p className="text-xs text-[#5C5346]">
                        Advance tickets from Incoming → Preparing → Ready / On the Way. Customer trackers update in real time.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {[
                      { title: '01. Incoming Orders', list: kdsIncoming, accent: 'border-t-[#E9A92F]', stage: 'received' },
                      { title: '02. Preparing on Grill', list: kdsPreparing, accent: 'border-t-[#D8961D]', stage: 'preparing' },
                      { title: '03. Ready & Out for Delivery', list: kdsReady, accent: 'border-t-emerald-600', stage: 'ready' },
                    ].map((col) => (
                      <div
                        key={col.stage}
                        className={`bg-[#F2EDE3] border border-[#191919]/10 border-t-4 ${col.accent} rounded-xl p-4 space-y-3 min-h-[340px]`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-display font-bold text-sm text-[#191919]">
                            {col.title}
                          </h4>
                          <span className="font-mono text-xs font-bold text-[#B67A0E] tabular-nums">
                            {col.list.length}
                          </span>
                        </div>

                        {col.list.length === 0 ? (
                          <div className="py-12 text-center text-xs text-[#5C5346]/70">
                            No tickets in this stage
                          </div>
                        ) : (
                          col.list.map((order) => {
                            const minsAgo = Math.max(
                              0,
                              Math.round((Date.now() - Date.parse(order.createdAt)) / 60000)
                            );
                            const st = normalizeLiveStatus(order.status);
                            return (
                              <div
                                key={order.id}
                                className="bg-white border border-[#191919]/10 rounded-lg p-3.5 space-y-2.5 shadow-xs"
                              >
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-mono font-bold text-[#B67A0E]">
                                    #{order.id.slice(0, 10)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => printOrderTicket(order, 'kitchen')}
                                      title="Print thermal kitchen ticket"
                                      className="h-6 px-2 rounded bg-[#FAF8F3] border border-[#191919]/14 hover:border-[#E9A92F] text-[10px] font-semibold text-[#191919] inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Printer className="w-3 h-3 text-[#D8961D]" />
                                      <span>Print</span>
                                    </button>
                                    <span className="inline-flex items-center gap-1 font-mono text-[#5C5346] tabular-nums">
                                      <Clock className="w-3 h-3" />
                                      {minsAgo}m ago
                                    </span>
                                  </div>
                                </div>

                                <div className="text-xs font-semibold text-[#5C5346] uppercase tracking-wider">
                                  {order.mode}
                                  {order.customer?.table && order.customer.table !== 'Any'
                                    ? ` · ${order.customer.table}`
                                    : ''}{' '}
                                  · {order.customer?.name} · {order.customer?.phone}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                  <span className="px-2 py-0.5 rounded bg-[#FAF8F3] border border-[#191919]/10 font-semibold text-[#B67A0E]">
                                    {order.paymentMethod
                                      ? PAYMENT_METHOD_LABELS[order.paymentMethod]
                                      : PAYMENT_METHOD_LABELS.cash}
                                  </span>
                                  {order.deliveryCoords?.distanceKm && (
                                    <span className="px-2 py-0.5 rounded bg-[#FAF8F3] border border-[#191919]/10 font-mono text-[#5C5346]">
                                      {order.deliveryCoords.distanceKm} km (~{order.deliveryCoords.etaMinutes || 25}m)
                                    </span>
                                  )}
                                </div>

                                {order.scheduledDeliveryTime && (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[#E9A92F]/15 text-[#191919] border border-[#E9A92F]/45 text-[11px] font-semibold">
                                    <CalendarClock className="w-3.5 h-3.5 text-[#D8961D]" />
                                    <span className="font-mono tabular-nums">
                                      Scheduled: {formatScheduledTime(order.scheduledDeliveryTime)}
                                    </span>
                                  </div>
                                )}

                                <ul className="space-y-1.5 border-y border-[#191919]/10 py-2">
                                  {order.items.map((it, idx) => {
                                    const mods: string[] = [];
                                    if (it.options?.cheese) mods.push('+Cheese');
                                    if (it.options?.meat) mods.push('+Meat');
                                    if (it.options?.spice) mods.push(it.options.spice);
                                    if (it.options?.sauce) mods.push(it.options.sauce);
                                    return (
                                      <li key={idx} className="text-xs text-[#191919]">
                                        <span className="font-mono font-bold text-[#B67A0E] mr-1.5 tabular-nums">
                                          {it.qty}×
                                        </span>
                                        <span className="font-semibold">{it.name}</span>
                                        {mods.length > 0 && (
                                          <span className="block text-[11px] text-[#5C5346] pl-5">
                                            {mods.join(' · ')}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>

                                {(order.deliveryInstructions || order.dietaryNotes || order.customer?.note) && (
                                  <div className="text-xs bg-[#FAF8F3] border border-[#191919]/10 text-[#191919] p-2 rounded space-y-1 font-medium">
                                    {order.deliveryInstructions && (
                                      <p>
                                        <strong className="text-[#B67A0E]">Delivery:</strong> {order.deliveryInstructions}
                                      </p>
                                    )}
                                    {order.dietaryNotes && (
                                      <p>
                                        <strong className="text-[#B67A0E]">Dietary:</strong> {order.dietaryNotes}
                                      </p>
                                    )}
                                    {!order.deliveryInstructions &&
                                      !order.dietaryNotes &&
                                      order.customer?.note && <p>Note: {order.customer.note}</p>}
                                  </div>
                                )}

                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {st === 'received' && (
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange(order.id, 'preparing')}
                                      className="flex-1 h-8 px-2.5 rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Start Preparing
                                    </button>
                                  )}
                                  {st === 'preparing' && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleStatusChange(
                                          order.id,
                                          order.mode === 'delivery' ? 'on_the_way' : 'ready'
                                        )
                                      }
                                      className="flex-1 h-8 px-2.5 rounded-lg bg-[#FAF8F3] border border-[#E9A92F] hover:bg-[#E9A92F] text-[#B67A0E] hover:text-[#191919] text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      {order.mode === 'delivery' ? 'Send Courier' : 'Mark Ready'}
                                    </button>
                                  )}
                                  {(st === 'ready' || st === 'on_the_way') && (
                                    <button
                                      type="button"
                                      onClick={() => handleStatusChange(order.id, 'delivered')}
                                      className="flex-1 h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Mark Delivered
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleStatusChange(order.id, 'declined')}
                                    className="h-8 px-2.5 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] hover:border-red-400 text-xs font-medium text-[#5C5346] hover:text-red-600 transition-colors cursor-pointer"
                                  >
                                    Decline
                                  </button>
                                </div>
                                {/* Live Quick Kitchen Notes */}
                                <div className="pt-1 space-y-1.5">
                                  {order.kitchenNote && (
                                    <div className="text-[11px] bg-[#E9A92F]/15 border border-[#E9A92F]/45 text-[#191919] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                                      <MessageSquare className="w-3 h-3 text-[#D8961D] shrink-0" />
                                      <span>{order.kitchenNote}</span>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-1">
                                    {[
                                      'Fresh on the grill',
                                      'Extra sauce packed',
                                      'Courier picked up',
                                      'Arriving in 5 min',
                                    ].map((preset) => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleSendKitchenNote(order.id, preset)}
                                        className="h-6 px-2 rounded-md bg-[#FAF8F3] border border-[#191919]/12 hover:border-[#E9A92F] text-[10px] font-medium text-[#5C5346] hover:text-[#191919] transition-colors cursor-pointer"
                                      >
                                        + {preset}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 2: SALES ANALYTICS & ORDERS */}
              {tab === 'analytics' && (
                <div className="space-y-6">
                  {/* KPI Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl border border-[#191919]/10 bg-white shadow-xs">
                      <div className="text-xs text-[#5C5346]">Total Revenue</div>
                      <div className="font-display font-extrabold text-2xl text-[#191919] mt-1 tabular-nums">
                        {formatMoney(analytics.totalRevenue)}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-[#191919]/10 bg-white shadow-xs">
                      <div className="text-xs text-[#5C5346]">Active Orders</div>
                      <div className="font-display font-extrabold text-2xl text-[#B67A0E] mt-1 tabular-nums">
                        {analytics.activeOrders.length}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-[#191919]/10 bg-white shadow-xs">
                      <div className="text-xs text-[#5C5346]">Completed Orders</div>
                      <div className="font-display font-extrabold text-2xl text-[#191919] mt-1 tabular-nums">
                        {analytics.completedOrders.length}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-[#191919]/10 bg-white shadow-xs">
                      <div className="text-xs text-[#5C5346]">Avg Order Value</div>
                      <div className="font-display font-extrabold text-2xl text-[#B67A0E] mt-1 tabular-nums">
                        {formatMoney(analytics.avgOrder)}
                      </div>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-7 border border-[#191919]/10 bg-white rounded-xl p-5 shadow-xs">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-display font-bold text-base text-[#191919]">
                          Revenue Trend (Recent Days)
                        </h4>
                        <span className="text-xs text-[#5C5346] font-mono">UZS</span>
                      </div>
                      {analytics.dailyBars.length === 0 ? (
                        <p className="text-xs text-[#5C5346]/70 py-12 text-center">
                          No order revenue data recorded yet.
                        </p>
                      ) : (
                        <div className="flex items-end gap-3 h-44 pt-4">
                          {analytics.dailyBars.map((b) => {
                            const hPct = Math.max(8, Math.round((b.rev / maxDailyRev) * 100));
                            return (
                              <div key={b.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                                <span className="font-mono text-[10px] text-[#5C5346] tabular-nums">
                                  {Math.round(b.rev / 1000)}K
                                </span>
                                <div
                                  className="w-full max-w-[44px] bg-[#E9A92F] rounded-t-md transition-all"
                                  style={{ height: `${hPct}%` }}
                                />
                                <span className="font-mono text-[11px] text-[#5C5346]">{b.day}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="lg:col-span-5 border border-[#191919]/10 bg-white rounded-xl p-5 shadow-xs space-y-4">
                      <h4 className="font-display font-bold text-base text-[#191919]">
                        Top Selling Dishes
                      </h4>
                      {analytics.topDishes.length === 0 ? (
                        <p className="text-xs text-[#5C5346]/70 py-8 text-center">No items sold yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {analytics.topDishes.map((d) => (
                            <div key={d.name} className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-[#5C5346] truncate pr-2">
                                {d.name}
                              </span>
                              <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                                <span className="text-[#5C5346]">{d.qty} sold</span>
                                <span className="font-bold text-[#B67A0E]">{formatMoney(d.rev)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Orders Table & Export */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-display font-bold text-base text-[#191919]">
                        Latest Orders ({orders.length})
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleExportCsv}
                          className="h-9 px-3 rounded-lg border border-[#191919]/14 bg-white hover:border-[#E9A92F] text-xs font-semibold text-[#191919] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#D8961D]" />
                          <span>Export CSV</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportJson}
                          className="h-9 px-3 rounded-lg border border-[#191919]/14 bg-white hover:border-[#E9A92F] text-xs font-semibold text-[#191919] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-[#D8961D]" />
                          <span>Export JSON</span>
                        </button>
                      </div>
                    </div>

                    <div className="border border-[#191919]/10 rounded-xl overflow-x-auto bg-white shadow-xs">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F2EDE3] border-b border-[#191919]/10 text-[#5C5346]">
                          <tr>
                            <th className="p-3 font-semibold">Order ID</th>
                            <th className="p-3 font-semibold">Customer</th>
                            <th className="p-3 font-semibold">Items</th>
                            <th className="p-3 font-semibold">Total</th>
                            <th className="p-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#191919]/10">
                          {orders.slice(0, 25).map((o) => (
                            <tr key={o.id}>
                              <td className="p-3 font-mono font-semibold text-[#B67A0E]">
                                {o.id.slice(0, 12)}…
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-[#191919]">{o.customer?.name}</div>
                                <div className="text-[#5C5346]">
                                  {o.mode} · {o.customer?.phone}
                                </div>
                                {o.scheduledDeliveryTime && (
                                  <div className="text-[11px] font-mono text-[#B67A0E] font-semibold tabular-nums mt-0.5">
                                    Scheduled: {formatScheduledTime(o.scheduledDeliveryTime)}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-[#5C5346] max-w-xs truncate">
                                {o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                              </td>
                              <td className="p-3 font-mono font-bold text-[#B67A0E] tabular-nums">
                                {formatMoney(o.totals?.total || 0)}
                              </td>
                              <td className="p-3">
                                <select
                                  value={normalizeLiveStatus(o.status)}
                                  onChange={(e) =>
                                    handleStatusChange(o.id, e.target.value as OrderStatus)
                                  }
                                  className="h-8 px-2 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] text-xs font-medium text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                                >
                                  <option value="received">Qabul qilindi (received)</option>
                                  <option value="preparing">Tayyorlanmoqda (preparing)</option>
                                  <option value="ready">Tayyor (ready)</option>
                                  <option value="on_the_way">Yo’lda (on_the_way)</option>
                                  <option value="delivered">Yetkazildi (delivered)</option>
                                  <option value="declined">Rad etildi (declined)</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: INVENTORY */}
              {tab === 'inventory' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-bold text-lg text-[#191919]">
                        Menu & Inventory
                      </h3>
                      <p className="text-xs text-[#5C5346]">
                        Price, description, and stock toggles update the storefront immediately.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveServerMenu(adminToken).then(() => onToast('Menu synced to server.'))
                      }
                      className="h-9 px-4 rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-xs font-bold transition-colors cursor-pointer"
                    >
                      Sync Changes
                    </button>
                  </div>

                  <div className="border border-[#191919]/10 rounded-xl overflow-x-auto bg-white shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F2EDE3] border-b border-[#191919]/10 text-[#5C5346]">
                        <tr>
                          <th className="p-3 font-semibold">Item</th>
                          <th className="p-3 font-semibold">Original Price (UZS)</th>
                          <th className="p-3 font-semibold">Description</th>
                          <th className="p-3 font-semibold">Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#191919]/10">
                        {menuItems.map((m) => (
                          <tr key={m.id}>
                            <td className="p-3">
                              <div className="font-semibold text-[#191919]">{m.name}</div>
                              <div className="text-[#5C5346]">{m.cat}</div>
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min={0}
                                step={1000}
                                value={m.originalPrice}
                                onChange={(e) =>
                                  onUpdateMenuItem(m.id, { price: Number(e.target.value) })
                                }
                                className="h-9 w-28 px-2.5 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 font-mono text-[#191919] tabular-nums focus:outline-none focus:border-[#E9A92F]"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                value={m.desc}
                                maxLength={180}
                                onChange={(e) => onUpdateMenuItem(m.id, { desc: e.target.value })}
                                className="h-9 w-full min-w-[220px] px-2.5 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={m.available}
                                onChange={(e) =>
                                  onUpdateMenuItem(m.id, { available: e.target.checked })
                                }
                                className="w-4 h-4 accent-[#E9A92F] cursor-pointer"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: PROMOTIONS */}
              {tab === 'promotions' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-7 space-y-3">
                    <h3 className="font-display font-bold text-lg text-[#191919]">
                      Active & Scheduled Promotions
                    </h3>
                    <div className="divide-y divide-[#191919]/10 border border-[#191919]/10 rounded-xl bg-white shadow-xs">
                      {Object.entries(promos).map(([code, p]) => {
                        const isEnabled = !settings.promoOff.includes(code);
                        return (
                          <div key={code} className="p-4 flex items-center justify-between gap-4">
                            <div>
                              <div className="font-mono font-bold text-sm text-[#B67A0E]">
                                {code}
                              </div>
                              <div className="text-xs text-[#5C5346]">
                                {p.label} · {p.type}
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => handleTogglePromo(code, e.target.checked)}
                              className="w-4 h-4 accent-[#E9A92F] cursor-pointer"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <form
                    onSubmit={handleCreatePromo}
                    className="lg:col-span-5 border border-[#191919]/10 rounded-xl p-5 bg-white shadow-xs space-y-4 h-fit"
                  >
                    <h3 className="font-display font-bold text-lg text-[#191919]">
                      Add Percentage Code
                    </h3>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">Promo Code</span>
                      <input
                        required
                        maxLength={16}
                        pattern="[A-Za-z0-9]+"
                        value={newPromoCode}
                        onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                        placeholder="BUKHARA20"
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] font-mono uppercase text-sm text-[#191919] placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">Discount % (1–40)</span>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        required
                        value={newPromoRate}
                        onChange={(e) => setNewPromoRate(e.target.value)}
                        className="mt-1 w-full h-10 px-3 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] font-mono text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <button
                      type="submit"
                      className="h-10 w-full rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-sm font-bold transition-colors cursor-pointer"
                    >
                      Create Promotion
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 5: REVIEWS MODERATION */}
              {tab === 'reviews' && (
                <div className="space-y-4">
                  <h3 className="font-display font-bold text-lg text-[#191919]">
                    Review Moderation ({reviews.length})
                  </h3>
                  <div className="space-y-3">
                    {reviews.map((r) => (
                      <div
                        key={r.id}
                        className="border border-[#191919]/10 bg-white rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <strong className="text-sm text-[#191919]">{r.name}</strong>
                            <span className="text-[#5C5346]/50">·</span>
                            <span className="text-[#5C5346]">{r.category}</span>
                            <span className="text-[#5C5346]/50">·</span>
                            <span className="text-[#B67A0E] font-bold">{r.rating}/5 ★</span>
                            <span className="text-[#5C5346]/50">·</span>
                            <span
                              className={`font-semibold ${
                                r.approved ? 'text-emerald-700' : 'text-[#B67A0E]'
                              }`}
                            >
                              {r.approved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                          <p className="text-sm text-[#5C5346] mt-1">{r.text}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!r.approved && (
                            <button
                              type="button"
                              onClick={() => handleReviewAction(r.id, 'approve')}
                              className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleReviewAction(r.id, 'delete')}
                            className="h-8 px-3 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] hover:border-red-400 text-xs font-semibold text-[#5C5346] hover:text-red-600 inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: RESTAURANT SETTINGS */}
              {tab === 'settings' && (
                <form onSubmit={handleSaveRestaurantSettings} className="max-w-2xl space-y-5 bg-white border border-[#191919]/10 rounded-xl p-6 shadow-xs">
                  <h3 className="font-display font-bold text-lg text-[#191919]">
                    Restaurant Parameters
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">Opening time</span>
                      <input
                        type="time"
                        required
                        value={settingsForm.open}
                        onChange={(e) => setSettingsForm({ ...settingsForm, open: e.target.value })}
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">Closing time</span>
                      <input
                        type="time"
                        required
                        value={settingsForm.close}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, close: e.target.value })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">
                        Delivery fee (UZS)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        required
                        value={settingsForm.deliveryFee}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, deliveryFee: Number(e.target.value) })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 font-mono text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">
                        Free delivery from (UZS)
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        required
                        value={settingsForm.freeThreshold}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            freeThreshold: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 font-mono text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">
                        ETA minimum (min)
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={120}
                        required
                        value={settingsForm.etaMin}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, etaMin: Number(e.target.value) })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 font-mono text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">
                        ETA maximum (min)
                      </span>
                      <input
                        type="number"
                        min={5}
                        max={180}
                        required
                        value={settingsForm.etaMax}
                        onChange={(e) =>
                          setSettingsForm({ ...settingsForm, etaMax: Number(e.target.value) })
                        }
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-[#FAF8F3] border border-[#191919]/14 font-mono text-sm text-[#191919] focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="h-10 px-5 rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-sm font-bold transition-colors cursor-pointer"
                    >
                      Save Settings
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const reset = {
                          ...DEFAULT_SETTINGS,
                          promoOff: settings.promoOff,
                          customPromos: settings.customPromos,
                        };
                        setSettingsForm(reset);
                        onSaveSettings(reset);
                        onToast('Settings reset to defaults.');
                      }}
                      className="h-10 px-5 rounded-lg border border-[#191919]/14 bg-[#FAF8F3] text-sm font-semibold text-[#5C5346] hover:text-[#191919] hover:border-[#E9A92F] transition-colors cursor-pointer"
                    >
                      Reset Defaults
                    </button>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
