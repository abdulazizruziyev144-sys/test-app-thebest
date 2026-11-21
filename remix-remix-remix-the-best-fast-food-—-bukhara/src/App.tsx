import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { Heart, Home, ReceiptText, ShoppingBag, Star } from 'lucide-react';
import { useLocale } from './context/LocaleContext';
import { DEFAULT_SETTINGS } from './data/menu';
import {
  buildMenu,
  calculateCart,
  createOrderId,
  getActivePromosMap,
  isRestaurantOpen,
  normalizeLiveStatus,
  normalizePhone,
  ORDER_STATUS_LABELS,
  readStorage,
  sanitizeCart,
  sanitizeOrdersList,
  STORAGE_KEYS,
  writeStorage,
} from './lib/calculations';
import {
  fetchUserOrdersFromFirestore,
  loadUserProfile,
  saveOrderToFirestore,
  saveUserProfile,
  signInWithGoogle,
  signOutUser,
  subscribeAuthState,
  subscribeOrderStatus,
  testFirestoreConnection,
} from './lib/firebase';
import type {
  CartLine,
  CartOptions,
  CategoryId,
  DeliveryCoords,
  FulfillmentMode,
  MenuItem,
  Order,
  OrderCustomer,
  OrderNotification,
  OrderStatus,
  PaymentMethod,
  Promotion,
  RestaurantSettings,
  Review,
  RewardsProfile,
  UserProfile,
} from './types';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { ComboBuilder } from './components/ComboBuilder';
import { MenuSection } from './components/MenuSection';
import { PromotionsAndLoyalty } from './components/PromotionsAndLoyalty';
import { ReviewsAndVisit } from './components/ReviewsAndVisit';
import { CustomizeModal } from './components/CustomizeModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal, SuccessModal } from './components/CheckoutModal';
import { OrdersAndTrackerModal } from './components/OrdersAndTrackerModal';
import { RewardsModal } from './components/RewardsModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { QrScannerModal, parseTableQrPayload } from './components/QrScannerModal';
import { OfflineIndicator } from './components/PWAInstallButton';

function buildCartLineKey(
  item: Pick<MenuItem, 'id' | 'cat'>,
  options: CartOptions = {}
): string {
  if (item.cat === 'drinks') {
    return `${item.id}:0:0:Medium:The Best`;
  }
  return [
    item.id,
    options.cheese ? 1 : 0,
    options.meat ? 1 : 0,
    options.spice || 'Medium',
    options.sauce || 'The Best',
  ].join(':');
}

export default function App() {
  const { lang, setLang, t } = useLocale();
  const [prices, setPrices] = useState<Record<string, number>>(() =>
    readStorage(STORAGE_KEYS.prices, {})
  );
  const [content, setContent] = useState<Record<string, string>>(() =>
    readStorage(STORAGE_KEYS.content, {})
  );
  const [availability, setAvailability] = useState<Record<string, boolean>>(() =>
    readStorage(STORAGE_KEYS.availability, {})
  );
  const [settings, setSettings] = useState<RestaurantSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readStorage<Partial<RestaurantSettings>>(STORAGE_KEYS.settings, {}),
  }));
  const [serverPromos, setServerPromos] = useState<Record<string, Promotion> | null>(null);

  const [cart, setCart] = useState<CartLine[]>(() =>
    sanitizeCart(readStorage(STORAGE_KEYS.cart, []))
  );
  const [mode, setMode] = useState<FulfillmentMode>('delivery');
  const [codes, setCodes] = useState<string[]>([]);
  const [redeemPointsAmount, setRedeemPointsAmount] = useState<number>(0);

  const [favorites, setFavorites] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.favorites, [])
  );
  const [activeCategory, setActiveCategory] = useState<CategoryId>('all');

  const [orders, setOrders] = useState<Order[]>(() =>
    sanitizeOrdersList(readStorage(STORAGE_KEYS.orders, []))
  );
  const [liveStatuses, setLiveStatuses] = useState<Record<string, OrderStatus>>({});
  const [liveKitchenNotes, setLiveKitchenNotes] = useState<Record<string, string>>({});
  const [notifications, setNotifications] = useState<OrderNotification[]>(() =>
    readStorage<OrderNotification[]>(STORAGE_KEYS.notifications, [])
  );

  const [rewardsProfile, setRewardsProfile] = useState<RewardsProfile | null>(() =>
    readStorage<RewardsProfile | null>(STORAGE_KEYS.rewards, null)
  );
  const [reviews, setReviews] = useState<Review[]>([]);

  // Modals & Drawers
  const [customizingItem, setCustomizingItem] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState<string | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [dineInTable, setDineInTable] = useState('');
  const [toastMsg, setToastMsg] = useState<string>('');
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const toastTimerRef = useRef<number | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const initialQrHandledRef = useRef(false);
  const liveStatusesRef = useRef<Record<string, OrderStatus>>(liveStatuses);
  liveStatusesRef.current = liveStatuses;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg('');
      toastTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const handleActivateDineIn = useCallback(
    (tableNumber: string) => {
      const cleanTable = tableNumber.trim().slice(0, 10);
      if (!cleanTable) return;
      setMode('dine-in');
      setDineInTable(cleanTable);
      setActiveCategory('all');
      setQrScannerOpen(false);
      showToast(`${t('Dine-in')} · ${t('Table')} #${cleanTable}`);
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = window.setTimeout(() => {
        document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
        scrollTimerRef.current = null;
      }, 120);
    },
    [showToast, t]
  );

  // Detect table QR query param once on mount (e.g. ?table=7)
  useEffect(() => {
    if (initialQrHandledRef.current) return;
    initialQrHandledRef.current = true;
    const parsed = parseTableQrPayload(window.location.href);
    if (parsed) {
      handleActivateDineIn(parsed);
    }
  }, [handleActivateDineIn]);

  // Persist cart, favorites, orders, rewards, notifications
  useEffect(() => {
    writeStorage(STORAGE_KEYS.cart, cart);
  }, [cart]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.favorites, favorites);
  }, [favorites]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.orders, orders);
  }, [orders]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.rewards, rewardsProfile);
  }, [rewardsProfile]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.notifications, notifications);
  }, [notifications]);

  // Listen for Google Maps Platform Demo Key quota errors
  useEffect(() => {
    const onQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Subscribe to Firebase Google Auth state & hydrate user profile, favorites, and orders from Firestore
  useEffect(() => {
    let active = true;
    const unsub = subscribeAuthState(async (fbUser) => {
      if (!active) return;
      if (!fbUser) {
        setUserProfile(null);
        return;
      }
      try {
        const existing = await loadUserProfile(fbUser.uid);
        if (!active) return;
        const mergedFavs = Array.from(
          new Set([...(existing?.favorites || []), ...readStorage<string[]>(STORAGE_KEYS.favorites, [])])
        ).slice(0, 50);

        const hydrated: UserProfile = {
          uid: fbUser.uid,
          displayName: existing?.displayName || fbUser.displayName || '',
          email: existing?.email || fbUser.email || '',
          photoURL: existing?.photoURL || fbUser.photoURL || '',
          phone: existing?.phone || '',
          defaultAddress: existing?.defaultAddress || '',
          favorites: mergedFavs,
          updatedAt: new Date().toISOString(),
        };
        setUserProfile(hydrated);
        setFavorites(mergedFavs);
        await saveUserProfile(hydrated).catch(() => {});

        const cloudOrders = await fetchUserOrdersFromFirestore(fbUser.uid).catch(() => []);
        if (!active) return;
        if (cloudOrders.length > 0) {
          setOrders((prev) => {
            const byId = new Map<string, Order>();
            prev.forEach((o) => byId.set(o.id, o));
            cloudOrders.forEach((o) => byId.set(o.id, o));
            return [...byId.values()]
              .sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''))
              .slice(-100);
          });
        }
      } catch (err) {
        console.warn('User profile sync notice:', err);
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  // Initial Firestore connectivity test + Server Menu & Reviews load
  useEffect(() => {
    const controller = new AbortController();
    testFirestoreConnection();

    fetch('/api/menu', { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || !Array.isArray(data.items)) return;
        const p: Record<string, number> = {};
        const c: Record<string, string> = {};
        const a: Record<string, boolean> = {};
        data.items.forEach((it: { id: string; price: number; desc: string; available: boolean }) => {
          p[it.id] = it.price;
          c[it.id] = it.desc;
          a[it.id] = it.available;
        });
        setPrices(p);
        setContent(c);
        setAvailability(a);
        writeStorage(STORAGE_KEYS.prices, p);
        writeStorage(STORAGE_KEYS.content, c);
        writeStorage(STORAGE_KEYS.availability, a);

        if (data.promos) setServerPromos(data.promos);
        setSettings((prev) => {
          const next = {
            ...prev,
            open: data.open ?? prev.open,
            close: data.close ?? prev.close,
            deliveryFee: data.deliveryFee ?? prev.deliveryFee,
            freeThreshold: data.freeThreshold ?? prev.freeThreshold,
            etaMin: data.etaMin ?? prev.etaMin,
            etaMax: data.etaMax ?? prev.etaMax,
            promoOff: data.promoOff ?? prev.promoOff,
            customPromos: data.customPromos ?? prev.customPromos,
          };
          writeStorage(STORAGE_KEYS.settings, next);
          return next;
        });
      })
      .catch(() => {});

    fetch('/api/reviews', { cache: 'no-store', signal: controller.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (Array.isArray(rows)) setReviews(rows);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  const activeOrderIds = useMemo(
    () =>
      orders
        .filter((o) => {
          const st = liveStatuses[o.id] ?? o.status;
          return (
            /^[a-zA-Z0-9_-]{20,128}$/.test(o.id) &&
            !['delivered', 'declined'].includes(st)
          );
        })
        .map((o) => o.id),
    [orders, liveStatuses]
  );

  const activeOrderIdsKey = activeOrderIds.join(',');

  // Subscribe to live status updates for active orders placed by this browser
  useEffect(() => {
    const ids = activeOrderIdsKey ? activeOrderIdsKey.split(',') : [];
    const unsubs = ids.map((orderId) =>
      subscribeOrderStatus(orderId, (id, rawStatus, exists, kitchenNote) => {
        if (!exists || !rawStatus) return;
        if (typeof kitchenNote === 'string') {
          setLiveKitchenNotes((prev) => (prev[id] === kitchenNote ? prev : { ...prev, [id]: kitchenNote }));
        }
        const next = normalizeLiveStatus(rawStatus);
        const prevStatus = liveStatusesRef.current[id];
        if (prevStatus === next) return;

        liveStatusesRef.current = { ...liveStatusesRef.current, [id]: next };
        setLiveStatuses((prev) => (prev[id] === next ? prev : { ...prev, [id]: next }));

        if (prevStatus) {
          const label = ORDER_STATUS_LABELS[next] || next;
          showToast(`Order #${id.slice(0, 8)}… is now ${label}`);
          setNotifications((nPrev) => [
            {
              id: `${id}-${next}-${Date.now()}`,
              orderId: id,
              status: next,
              message: `Order status updated: ${label}`,
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...nPrev.slice(0, 19),
          ]);
        }
      })
    );

    return () => {
      unsubs.forEach((u) => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }, [activeOrderIdsKey, showToast]);

  const menuItems = useMemo(
    () => buildMenu(prices, content, availability),
    [prices, content, availability]
  );

  const promosMap = useMemo(
    () => getActivePromosMap(settings, serverPromos),
    [settings, serverPromos]
  );

  const calc = useMemo(
    () =>
      calculateCart(
        cart,
        menuItems,
        mode,
        codes,
        settings,
        serverPromos,
        rewardsProfile,
        redeemPointsAmount
      ),
    [cart, menuItems, mode, codes, settings, serverPromos, rewardsProfile, redeemPointsAmount]
  );

  const cartCount = useMemo(() => cart.reduce((s, l) => s + l.qty, 0), [cart]);
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );
  const openNow = useMemo(() => isRestaurantOpen(settings), [settings]);

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      const user = await signInWithGoogle();
      showToast(`Signed in as ${user.displayName || user.email || 'Guest'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      if (!msg.includes('popup-closed-by-user')) {
        showToast('Could not complete Google sign-in.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await signOutUser();
      setUserProfile(null);
      showToast('Signed out.');
    } catch {
      showToast('Sign-out failed.');
    }
  };

  const handleToggleFavorite = useCallback(
    (id: string) => {
      const exists = favorites.includes(id);
      const next = exists ? favorites.filter((f) => f !== id) : [...favorites, id];
      setFavorites(next);
      showToast(exists ? 'Removed from favorites.' : 'Saved to favorites.');
      if (userProfile) {
        const updatedProfile: UserProfile = {
          ...userProfile,
          favorites: next.slice(0, 50),
          updatedAt: new Date().toISOString(),
        };
        setUserProfile(updatedProfile);
        saveUserProfile(updatedProfile).catch(() => {});
      }
    },
    [favorites, showToast, userProfile]
  );

  const handleSelectFavorites = useCallback(() => {
    setActiveCategory('favorites');
    document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleOpenOrders = useCallback(() => {
    setTrackOrderId(null);
    setOrdersOpen(true);
  }, []);

  const handleOpenCart = useCallback(() => setCartOpen(true), []);
  const handleCloseCart = useCallback(() => setCartOpen(false), []);
  const handleOpenQrFromCart = useCallback(() => {
    setCartOpen(false);
    setQrScannerOpen(true);
  }, []);
  const handleProceedToCheckout = useCallback(() => {
    setCartOpen(false);
    setCheckoutError('');
    setCheckoutOpen(true);
  }, []);

  const handleAddItem = (item: MenuItem, options: CartOptions, openDrawer = true) => {
    if (!item.available) return;
    const spice = options.spice || 'Medium';
    const sauce = options.sauce || 'The Best';
    const key = buildCartLineKey(item, { ...options, spice, sauce });

    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      }
      return [
        ...prev,
        {
          key,
          id: item.id,
          qty: 1,
          options:
            item.cat === 'drinks'
              ? {}
              : { cheese: Boolean(options.cheese), meat: Boolean(options.meat), spice, sauce },
        },
      ];
    });
    setCustomizingItem(null);
    showToast(`${t(item.name)} added to cart.`);
    if (openDrawer) setCartOpen(true);
  };

  const handleAddCombo = (bundle: [string, string, string]) => {
    const key = `combo:${bundle.join(':')}`;
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, qty: Math.min(99, l.qty + 1) } : l));
      }
      return [...prev, { key, id: 'combo', qty: 1, options: {}, bundle }];
    });
    showToast('Custom combo added to cart!');
    setCartOpen(true);
  };

  const handleUpdateQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0 && l.qty < 100)
    );
  };

  const handleRemoveLine = (key: string) => {
    setCart((prev) => prev.filter((l) => l.key !== key));
  };

  const handleApplyPromo = (code: string): { ok: boolean; error?: string } => {
    if (!code) return { ok: false, error: 'Enter a promo code.' };
    if (!promosMap[code] || settings.promoOff.includes(code)) {
      return { ok: false, error: 'That promotion is not active.' };
    }
    if (codes.includes(code)) {
      return { ok: false, error: 'Promotion already applied.' };
    }
    if (codes.length >= 2) {
      return { ok: false, error: 'Maximum 2 promo codes per order.' };
    }
    setCodes((prev) => [...prev, code]);
    showToast(`Promo ${code} applied!`);
    return { ok: true };
  };

  const handleSubmitOrder = async (
    customer: OrderCustomer,
    orderNotes?: {
      deliveryInstructions?: string;
      dietaryNotes?: string;
      scheduledDeliveryTime?: string;
      paymentMethod?: PaymentMethod;
      deliveryCoords?: DeliveryCoords;
    }
  ) => {
    if (calc.lines.some((l) => !l.item.available)) {
      setCheckoutError('An item in your cart just sold out. Please remove it.');
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      const id = createOrderId();
      const acctPhone =
        rewardsProfile &&
        normalizePhone(customer.phone) === normalizePhone(rewardsProfile.phone)
          ? normalizePhone(customer.phone)
          : '';

      const cleanScheduledDeliveryTime = orderNotes?.scheduledDeliveryTime?.trim().slice(0, 40) || undefined;

      const newOrder: Order = {
        id,
        ...(userProfile?.uid ? { userId: userProfile.uid } : {}),
        source: 'website',
        mode,
        status: 'received',
        createdAt: new Date().toISOString(),
        eta: orderNotes?.deliveryCoords?.etaMinutes
          ? {
              min: Math.max(15, orderNotes.deliveryCoords.etaMinutes - 5),
              max: orderNotes.deliveryCoords.etaMinutes + 5,
            }
          : { min: settings.etaMin, max: settings.etaMax },
        ...(cleanScheduledDeliveryTime ? { scheduledDeliveryTime: cleanScheduledDeliveryTime } : {}),
        ...(orderNotes?.paymentMethod ? { paymentMethod: orderNotes.paymentMethod } : {}),
        ...(orderNotes?.deliveryCoords ? { deliveryCoords: orderNotes.deliveryCoords } : {}),
        customer,
        deliveryInstructions: (orderNotes?.deliveryInstructions || '').trim().slice(0, 300),
        dietaryNotes: (orderNotes?.dietaryNotes || '').trim().slice(0, 300),
        items: calc.lines.map((l) => ({
          id: l.id,
          name: l.item.name,
          qty: l.qty,
          unit: l.unit,
          options: l.options,
          ...(l.bundle ? { bundle: l.bundle } : {}),
        })),
        codes: [...codes],
        rewards: {
          phone: acctPhone,
          pointsRedeemed: acctPhone ? calc.pointsRedeemed : 0,
          pointsEarned: acctPhone ? Math.floor(calc.merchandise / 1000) : 0,
        },
        totals: {
          subtotal: Math.round(calc.subtotal),
          discount: Math.round(calc.discountTotal),
          delivery: Math.round(calc.deliveryFee),
          total: Math.round(calc.grandTotal),
        },
      };

      try {
        await saveOrderToFirestore(newOrder);
      } catch (fsErr) {
        console.error('Firestore order sync warning:', fsErr);
        showToast('Saved locally; cloud sync queued.');
      }

      if (userProfile) {
        const updatedProfile: UserProfile = {
          ...userProfile,
          displayName: customer.name || userProfile.displayName,
          phone: customer.phone || userProfile.phone,
          defaultAddress: customer.address || userProfile.defaultAddress,
          updatedAt: new Date().toISOString(),
        };
        setUserProfile(updatedProfile);
        saveUserProfile(updatedProfile).catch(() => {});
      }

      fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder),
      }).catch(() => {});

      if (acctPhone && rewardsProfile) {
        setRewardsProfile((prev) =>
          prev
            ? {
                ...prev,
                points: Math.max(
                  0,
                  prev.points - newOrder.rewards.pointsRedeemed + newOrder.rewards.pointsEarned
                ),
              }
            : prev
        );
      }

      setOrders((prev) => [...prev, newOrder]);
      setLiveStatuses((prev) => ({ ...prev, [newOrder.id]: 'received' }));
      setCart([]);
      setCodes([]);
      setRedeemPointsAmount(0);
      setCheckoutOpen(false);
      setSuccessOrderId(newOrder.id);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Could not complete order.');
    } finally {
      setCheckoutBusy(false);
    }
  };

  const handleReorder = (order: Order) => {
    const nextLines: CartLine[] = [];
    let skipped = 0;

    for (const item of order.items) {
      if (item.bundle && item.bundle.length === 3) {
        const b = item.bundle as [string, string, string];
        const allOk = b.every((bid) => menuItems.find((m) => m.id === bid)?.available);
        if (allOk) {
          nextLines.push({
            key: `combo:${b.join(':')}`,
            id: 'combo',
            qty: item.qty,
            options: {},
            bundle: b,
          });
        } else {
          skipped++;
        }
      } else {
        const found = menuItems.find((m) => m.id === item.id);
        if (found && found.available) {
          const opts = item.options || {};
          nextLines.push({
            key: buildCartLineKey(found, opts),
            id: found.id,
            qty: item.qty,
            options: opts,
          });
        } else {
          skipped++;
        }
      }
    }

    if (nextLines.length === 0) {
      showToast('Those items are currently sold out.');
      return;
    }

    setCart((prev) => {
      const merged = [...prev];
      for (const nl of nextLines) {
        const idx = merged.findIndex((m) => m.key === nl.key);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], qty: Math.min(99, merged[idx].qty + nl.qty) };
        } else {
          merged.push(nl);
        }
      }
      return merged;
    });

    setOrdersOpen(false);
    setCartOpen(true);
    showToast(
      skipped > 0
        ? `Added available items (${skipped} sold out).`
        : 'Order items added to your cart!'
    );
  };

  const handleUpdateMenuItem = (
    id: string,
    patch: { price?: number; desc?: string; available?: boolean }
  ) => {
    if (typeof patch.price === 'number') {
      setPrices((prev) => {
        const next = { ...prev, [id]: Math.max(0, patch.price!) };
        writeStorage(STORAGE_KEYS.prices, next);
        return next;
      });
    }
    if (typeof patch.desc === 'string') {
      setContent((prev) => {
        const next = { ...prev, [id]: patch.desc!.slice(0, 180) };
        writeStorage(STORAGE_KEYS.content, next);
        return next;
      });
    }
    if (typeof patch.available === 'boolean') {
      setAvailability((prev) => {
        const next = { ...prev, [id]: patch.available! };
        writeStorage(STORAGE_KEYS.availability, next);
        return next;
      });
    }
  };

  const handleSaveServerMenu = async (token: string, nextSettings = settings) => {
    const payload = {
      items: menuItems.map((it) => ({
        id: it.id,
        name: it.name,
        desc: it.desc,
        price: it.originalPrice,
        discountRate: it.discountRate,
        available: it.available,
      })),
      promos: promosMap,
      promoOff: nextSettings.promoOff,
      customPromos: nextSettings.customPromos,
      open: nextSettings.open,
      close: nextSettings.close,
      deliveryFee: nextSettings.deliveryFee,
      freeThreshold: nextSettings.freeThreshold,
      etaMin: nextSettings.etaMin,
      etaMax: nextSettings.etaMax,
    };
    const res = await fetch('/api/menu', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Could not sync menu to server.');
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen flex flex-col bg-white text-[#111111] pb-16 md:pb-0">
      {gmpQuotaExceeded && (
        <div className="bg-[#FAFAFA] border-b border-neutral-200 text-[#111111] px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-[#9E7000] hover:text-[#111111]"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <Header
        lang={lang}
        onChangeLang={setLang}
        mode={mode}
        dineInTable={dineInTable}
        cartCount={cartCount}
        favoritesCount={favorites.length}
        unreadNotifications={unreadNotifications}
        userProfile={userProfile}
        authBusy={authBusy}
        onSignInGoogle={handleGoogleSignIn}
        onSignOutGoogle={handleGoogleSignOut}
        onOpenQrScanner={() => setQrScannerOpen(true)}
        onOpenCart={handleOpenCart}
        onOpenOrders={handleOpenOrders}
        onOpenRewards={() => setRewardsOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
        onReserveTable={() => {
          setMode('reservation');
          setCartOpen(true);
        }}
        onSelectFavorites={handleSelectFavorites}
      />

      <main className="flex-1">
        <HeroSection
          lang={lang}
          settings={settings}
          isOpenNow={openNow}
          onReserveTable={() => {
            setMode('reservation');
            setCartOpen(true);
          }}
        />

        <MenuSection
          lang={lang}
          menuItems={menuItems}
          favorites={favorites}
          activeCategory={activeCategory}
          onChangeCategory={setActiveCategory}
          onToggleFavorite={handleToggleFavorite}
          onCustomize={(item) => setCustomizingItem(item)}
          onQuickAdd={(item) => handleAddItem(item, {}, false)}
        />

        <ComboBuilder lang={lang} menuItems={menuItems} onAddCombo={handleAddCombo} />

        <PromotionsAndLoyalty
          lang={lang}
          promos={promosMap}
          promoOff={settings.promoOff}
          appliedCodes={codes}
          rewardsProfile={rewardsProfile}
          onApplyPromo={(code) => {
            const res = handleApplyPromo(code);
            if (res.ok) setCartOpen(true);
          }}
          onOpenRewards={() => setRewardsOpen(true)}
        />

        <ReviewsAndVisit
          lang={lang}
          onChangeLang={setLang}
          reviews={reviews}
          settings={settings}
          onSubmitReview={async (payload) => {
            const res = await fetch('/api/reviews', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Could not submit review.');
          }}
        />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-xl border-t border-neutral-200 grid grid-cols-5 h-15 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(0,0,0,0.06)]"
      >
        <a
          href="#menu"
          className="min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-neutral-600 hover:text-[#111111] leading-tight"
        >
          <Home className="w-4 h-4 shrink-0" />
          <span className="max-w-full truncate">{t('Menu')}</span>
        </a>
        <button
          type="button"
          onClick={handleSelectFavorites}
          className="min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-neutral-600 hover:text-[#111111] cursor-pointer leading-tight"
        >
          <Heart className="w-4 h-4 shrink-0" />
          <span className="max-w-full truncate">{t('Favorites')}</span>
        </button>
        <a
          href="#reviews"
          className="min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-neutral-600 hover:text-[#111111] leading-tight"
        >
          <Star className="w-4 h-4 shrink-0" />
          <span className="max-w-full truncate">{t('Reviews')}</span>
        </a>
        <button
          type="button"
          onClick={handleOpenOrders}
          className="min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-medium text-neutral-600 hover:text-[#111111] cursor-pointer leading-tight"
        >
          <ReceiptText className="w-4 h-4 shrink-0" />
          <span className="max-w-full truncate">{t('Orders')}</span>
        </button>
        <button
          type="button"
          onClick={handleOpenCart}
          className="min-w-0 px-1 flex flex-col items-center justify-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-[#9E7000] cursor-pointer leading-tight"
        >
          <span className="relative inline-flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 shrink-0" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#F2B01E] text-[#111111] text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
                {cartCount}
              </span>
            )}
          </span>
          <span className="max-w-full truncate">{t('Cart')}</span>
        </button>
      </nav>

      {/* Modals & Drawers */}
      <CustomizeModal
        lang={lang}
        item={customizingItem}
        isFavorite={customizingItem ? favorites.includes(customizingItem.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onClose={() => setCustomizingItem(null)}
        onAdd={(item, opts) => handleAddItem(item, opts, true)}
      />

      <CartDrawer
        open={cartOpen}
        lang={lang}
        mode={mode}
        dineInTable={dineInTable}
        calc={calc}
        menuItems={menuItems}
        codes={codes}
        settings={settings}
        rewardsProfile={rewardsProfile}
        redeemPointsAmount={redeemPointsAmount}
        onClose={handleCloseCart}
        onChangeMode={setMode}
        onOpenQrScanner={handleOpenQrFromCart}
        onUpdateQty={handleUpdateQty}
        onRemoveLine={handleRemoveLine}
        onQuickAdd={(item) => handleAddItem(item, {}, false)}
        onApplyPromo={handleApplyPromo}
        onRemovePromo={(c) => setCodes((prev) => prev.filter((x) => x !== c))}
        onChangeRedeemPoints={setRedeemPointsAmount}
        onOpenRewards={() => setRewardsOpen(true)}
        onCheckout={handleProceedToCheckout}
      />

      <CheckoutModal
        open={checkoutOpen}
        lang={lang}
        mode={mode}
        dineInTable={dineInTable}
        calc={calc}
        settings={settings}
        rewardsProfile={rewardsProfile}
        userProfile={userProfile}
        submitting={checkoutBusy}
        errorMsg={checkoutError}
        onClose={() => setCheckoutOpen(false)}
        onSubmitOrder={handleSubmitOrder}
      />

      <SuccessModal
        orderId={successOrderId}
        order={successOrderId ? orders.find((o) => o.id === successOrderId) || null : null}
        scheduledDeliveryTime={
          successOrderId
            ? orders.find((o) => o.id === successOrderId)?.scheduledDeliveryTime
            : undefined
        }
        lang={lang}
        onTrack={(id) => {
          setSuccessOrderId(null);
          setTrackOrderId(id);
          setOrdersOpen(true);
        }}
        onClose={() => setSuccessOrderId(null)}
      />

      <OrdersAndTrackerModal
        open={ordersOpen}
        lang={lang}
        orders={orders}
        liveStatuses={liveStatuses}
        liveKitchenNotes={liveKitchenNotes}
        notifications={notifications}
        settings={settings}
        initialTrackOrderId={trackOrderId}
        onClose={() => setOrdersOpen(false)}
        onReorder={handleReorder}
        onMarkNotificationsRead={() =>
          setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
        }
        onLiveStatusUpdate={(id, st, note) => {
          setLiveStatuses((prev) => ({ ...prev, [id]: st }));
          if (typeof note === 'string') {
            setLiveKitchenNotes((prev) => ({ ...prev, [id]: note }));
          }
        }}
      />

      <RewardsModal
        open={rewardsOpen}
        lang={lang}
        profile={rewardsProfile}
        onClose={() => setRewardsOpen(false)}
        onSignedIn={(p) => {
          setRewardsProfile(p);
          showToast('Rewards account verified.');
        }}
        onSignOut={() => {
          setRewardsProfile(null);
          setRedeemPointsAmount(0);
          showToast('Signed out of Rewards.');
        }}
      />

      <AdminDashboardModal
        open={adminOpen}
        lang={lang}
        menuItems={menuItems}
        settings={settings}
        promos={promosMap}
        onClose={() => setAdminOpen(false)}
        onUpdateMenuItem={handleUpdateMenuItem}
        onSaveSettings={(next) => {
          setSettings(next);
          writeStorage(STORAGE_KEYS.settings, next);
        }}
        onSaveServerMenu={handleSaveServerMenu}
        onToast={showToast}
      />

      <QrScannerModal
        open={qrScannerOpen}
        lang={lang}
        onClose={() => setQrScannerOpen(false)}
        onTableDetected={handleActivateDineIn}
      />

      <OfflineIndicator />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-18 md:bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-white text-[#111111] text-xs font-semibold shadow-[0_12px_32px_rgba(0,0,0,0.12)] whitespace-nowrap border border-[#F2B01E]"
        >
          {toastMsg}
        </div>
      )}
      </div>
    </MotionConfig>
  );
}
