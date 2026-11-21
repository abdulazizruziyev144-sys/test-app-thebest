import { BASE_MENU, DEFAULT_PROMOS, ITEM_DISCOUNTS, SAUCE_OPTIONS } from '../data/menu';
import {
  CartLine,
  FulfillmentMode,
  LoyaltyTierInfo,
  MenuItem,
  Order,
  OrderStatus,
  Promotion,
  RestaurantSettings,
  RewardsProfile,
} from '../types';

export const STORAGE_KEYS = {
  prices: 'thebest-menu-prices',
  content: 'thebest-menu-content',
  availability: 'thebest-menu-availability',
  settings: 'thebest-admin-settings',
  cart: 'thebest-cart',
  orders: 'thebest-orders',
  favorites: 'thebest-favorites',
  rewards: 'thebest-rewards',
  lang: 'thebest-lang',
  notifications: 'thebest-notifications',
} as const;

const LEGACY_KEYS: Record<string, string> = {
  'thebest-menu-prices': 'verve-menu-prices',
  'thebest-menu-content': 'verve-menu-content',
  'thebest-menu-availability': 'verve-menu-availability',
  'thebest-admin-settings': 'verve-admin-settings',
  'thebest-cart': 'verve-cart',
  'thebest-orders': 'verve-orders',
};

export function readStorage<T>(key: string, fallback: T): T {
  try {
    let raw = localStorage.getItem(key);
    if (!raw && LEGACY_KEYS[key]) {
      raw = localStorage.getItem(LEGACY_KEYS[key]);
      if (raw) {
        localStorage.setItem(key, raw);
      }
    }
    if (!raw) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    return parsed ?? structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

export function writeStorage<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function formatMoney(n: number): string {
  return `${new Intl.NumberFormat('en-US').format(Math.max(0, Math.round(Number(n) || 0)))} UZS`;
}

export function formatScheduledTime(scheduledDeliveryTime?: string): string {
  if (!scheduledDeliveryTime) return '';
  const raw = scheduledDeliveryTime.trim();
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return raw.replace('T', ' ');
}

export function validNum(v: unknown, min: number, max: number, fallback: number): number {
  const num = Number(v);
  return Number.isFinite(num) && num >= min && num <= max ? num : fallback;
}

export function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(0, 15);
}

export function normalizeLiveStatus(raw: unknown): OrderStatus {
  if (!raw || typeof raw !== 'string') return 'received';
  if (raw === 'preparing') return 'preparing';
  if (raw === 'ready') return 'ready';
  if (raw === 'on_the_way' || raw === 'out_for_delivery') return 'on_the_way';
  if (raw === 'delivered') return 'delivered';
  if (raw === 'declined' || raw === 'cancelled') return 'declined';
  return 'received';
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Qabul qilindi',
  preparing: 'Tayyorlanmoqda',
  ready: 'Tayyor',
  on_the_way: 'Yo’lda',
  delivered: 'Yetkazildi',
  declined: 'Rad etildi',
};

export function buildMenu(
  prices: Record<string, number>,
  content: Record<string, string>,
  availability: Record<string, boolean>
): MenuItem[] {
  return BASE_MENU.map((m) => {
    const originalPrice = validNum(prices[m.id], 0, 1e8, m.price);
    const discountRate = ITEM_DISCOUNTS[m.id] ?? 0;
    const price = Math.round(originalPrice * (1 - discountRate / 100));
    const desc =
      typeof content[m.id] === 'string' && content[m.id].trim()
        ? content[m.id].trim().slice(0, 180)
        : m.desc;
    return {
      ...m,
      originalPrice,
      discountRate,
      price,
      desc,
      available: availability[m.id] !== false,
    };
  });
}

export function buildComboItem(bundle: [string, string, string], menuItems: MenuItem[]): MenuItem | null {
  const components = bundle.map((id) => menuItems.find((item) => item.id === id));
  if (
    components.some((c) => !c) ||
    components[0]?.cat !== 'fast-food' ||
    components[1]?.cat !== 'snacks' ||
    components[2]?.cat !== 'drinks'
  ) {
    return null;
  }
  const [main, side, drink] = components as [MenuItem, MenuItem, MenuItem];
  const individual = main.price + side.price + drink.price;
  const price = Math.round(individual * 0.9);
  return {
    id: 'combo',
    cat: 'combos',
    name: 'Build your own combo',
    desc: `${main.name} · ${side.name} · ${drink.name}`,
    img: main.img,
    price,
    originalPrice: individual,
    discountRate: 10,
    available: main.available && side.available && drink.available,
    bogo: false,
    dietary: [],
    prepMinutes: Math.max(main.prepMinutes ?? 10, side.prepMinutes ?? 6),
    calories: main.calories + side.calories + drink.calories,
    macros: {
      protein: (main.macros?.protein ?? 0) + (side.macros?.protein ?? 0) + (drink.macros?.protein ?? 0),
      carbs: (main.macros?.carbs ?? 0) + (side.macros?.carbs ?? 0) + (drink.macros?.carbs ?? 0),
      fat: (main.macros?.fat ?? 0) + (side.macros?.fat ?? 0) + (drink.macros?.fat ?? 0),
    },
    allergens: Array.from(new Set([...main.allergens, ...side.allergens, ...drink.allergens])),
  };
}

export function sanitizeCart(cart: unknown): CartLine[] {
  if (!Array.isArray(cart)) return [];
  return cart
    .filter((line): line is CartLine => {
      if (!line || !Number.isInteger(line.qty) || line.qty <= 0 || line.qty >= 100) return false;
      if (line.bundle) {
        if (!Array.isArray(line.bundle) || line.bundle.length !== 3) return false;
        const [main, side, drink] = line.bundle.map((id: string) => BASE_MENU.find((m) => m.id === id));
        return main?.cat === 'fast-food' && side?.cat === 'snacks' && drink?.cat === 'drinks';
      }
      return BASE_MENU.some((m) => m.id === line.id);
    })
    .map((line) => {
      if (line.bundle) {
        return {
          key: `combo:${line.bundle.join(':')}`,
          id: 'combo',
          qty: line.qty,
          options: {},
          bundle: line.bundle.slice(0, 3) as [string, string, string],
        };
      }
      return {
        key: String(line.key || line.id),
        id: line.id,
        qty: line.qty,
        options: {
          cheese: Boolean(line.options?.cheese),
          meat: Boolean(line.options?.meat),
          spice: (['Mild', 'Medium', 'Hot'] as const).includes(line.options?.spice as 'Mild' | 'Medium' | 'Hot')
            ? (line.options.spice as 'Mild' | 'Medium' | 'Hot')
            : 'Medium',
          sauce: (SAUCE_OPTIONS as readonly string[]).includes(line.options?.sauce || '')
            ? line.options.sauce
            : 'The Best',
        },
      };
    });
}

export function getActivePromosMap(
  settings: RestaurantSettings,
  serverPromos: Record<string, Promotion> | null
): Record<string, Promotion> {
  const custom = Object.fromEntries(
    (settings.customPromos || []).map((p) => [
      p.code,
      {
        type: 'percent' as const,
        rate: p.rate,
        label: `${Math.round(p.rate * 100)}% off your order`,
        custom: true,
      },
    ])
  );
  return { ...DEFAULT_PROMOS, ...(serverPromos || {}), ...custom };
}

export function discountForPoints(points: number): number {
  const safe = Math.max(0, Math.floor(points));
  if (safe >= 500) {
    // 500 pts tier bonus: 30,000 UZS + 5,000 per extra 100
    return 30000 + Math.floor((safe - 500) / 100) * 5000;
  }
  return Math.floor(safe / 100) * 5000;
}

export interface CartCalculation {
  lines: Array<CartLine & { item: MenuItem; unit: number; originalUnit: number }>;
  subtotal: number;
  saleSubtotal: number;
  discounts: Array<{ code: string; amount: number }>;
  discountTotal: number;
  merchandise: number;
  deliveryFee: number;
  grandTotal: number;
  pointsRedeemed: number;
  redeemablePoints: number;
  rewardDiscount: number;
}

export function calculateCart(
  cart: CartLine[],
  menuItems: MenuItem[],
  mode: FulfillmentMode,
  codes: string[],
  settings: RestaurantSettings,
  serverPromos: Record<string, Promotion> | null,
  rewardsProfile: RewardsProfile | null,
  redeemPointsAmount: number
): CartCalculation {
  const allPromos = getActivePromosMap(settings, serverPromos);
  const isPromoActive = (code: string) => Boolean(allPromos[code]) && !settings.promoOff.includes(code);

  const lines = cart
    .map((l) => {
      const item = l.bundle ? buildComboItem(l.bundle, menuItems) : menuItems.find((m) => m.id === l.id) || null;
      if (!item) return null;
      const addonCost = (l.options.cheese ? 7000 : 0) + (l.options.meat ? 12000 : 0);
      return {
        ...l,
        item,
        unit: item.price + addonCost,
        originalUnit: item.originalPrice + addonCost,
      };
    })
    .filter((l): l is CartLine & { item: MenuItem; unit: number; originalUnit: number } => Boolean(l));

  const subtotal = lines.reduce((s, l) => s + l.originalUnit * l.qty, 0);
  const saleSubtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);

  const saleDiscounts = new Map<string, number>();
  for (const line of lines) {
    const diff = (line.originalUnit - line.unit) * line.qty;
    if (diff > 0) {
      const label = line.bundle ? 'Combo bundle (10%)' : `Menu offer (${line.item.discountRate}%)`;
      saleDiscounts.set(label, (saleDiscounts.get(label) || 0) + diff);
    }
  }
  const discounts: Array<{ code: string; amount: number }> = [...saleDiscounts].map(([code, amount]) => ({
    code,
    amount,
  }));

  let bogo = 0;
  if (codes.includes('1PLUS1') && isPromoActive('1PLUS1')) {
    const eligible = lines
      .filter((l) => l.item.bogo)
      .flatMap((l) => Array<number>(l.qty).fill(l.unit))
      .sort((a, b) => a - b);
    const freeCount = Math.floor(eligible.length / 2);
    bogo = eligible.slice(0, freeCount).reduce((a, b) => a + b, 0);
    if (bogo > 0) discounts.push({ code: '1PLUS1', amount: bogo });
  }

  for (const code of codes) {
    const promo = allPromos[code];
    if (!promo || !isPromoActive(code) || promo.type === 'bogo') continue;
    let amount = 0;
    if (promo.type === 'percent' && promo.rate) {
      amount = Math.round((saleSubtotal - bogo) * promo.rate);
    } else if (promo.type === 'category' && promo.rate && promo.category) {
      const catSum = lines
        .filter((l) => l.item.cat === promo.category)
        .reduce((s, l) => s + l.unit * l.qty, 0);
      amount = Math.round(catSum * promo.rate);
    }
    if (amount > 0) discounts.push({ code, amount });
  }

  const promoDiscount = discounts
    .filter((d) => !d.code.startsWith('Menu offer') && !d.code.startsWith('Combo bundle'))
    .reduce((s, d) => s + d.amount, 0);

  const merchandiseBeforeReward = Math.max(0, saleSubtotal - promoDiscount);

  const availablePoints = Math.max(0, Math.floor(rewardsProfile?.points || 0));
  const maxRedeemableFromOrder = Math.floor(merchandiseBeforeReward / 5000) * 100;
  const maxAllowedPoints = Math.min(availablePoints - (availablePoints % 100), maxRedeemableFromOrder);
  const pointsToRedeem = redeemPointsAmount > 0 ? Math.min(redeemPointsAmount, maxAllowedPoints) : 0;
  const rewardDiscount = pointsToRedeem >= 100 ? discountForPoints(pointsToRedeem) : 0;

  if (rewardDiscount > 0) {
    discounts.push({ code: `REWARDS (${pointsToRedeem} pts)`, amount: Math.min(merchandiseBeforeReward, rewardDiscount) });
  }

  const merchandise = Math.max(0, merchandiseBeforeReward - rewardDiscount);
  const deliveryFee =
    mode === 'delivery' && lines.length > 0 && merchandise < settings.freeThreshold ? settings.deliveryFee : 0;
  const grandTotal = merchandise + deliveryFee;
  const discountTotal = Math.max(0, subtotal - merchandise);

  return {
    lines,
    subtotal,
    saleSubtotal,
    discounts,
    discountTotal,
    merchandise,
    deliveryFee,
    grandTotal,
    pointsRedeemed: pointsToRedeem,
    redeemablePoints: maxAllowedPoints,
    rewardDiscount,
  };
}

export function getLoyaltyTier(points: number): LoyaltyTierInfo {
  const safe = Math.max(0, points);
  if (safe >= 750) {
    return {
      name: 'Gold',
      multiplier: 1.5,
      nextTier: null,
      pointsToNext: 0,
      progressPercent: 100,
      perks: ['1.5× points on every order', 'Priority kitchen preparation', 'Free delivery on orders 100K+'],
    };
  }
  if (safe >= 250) {
    return {
      name: 'Silver',
      multiplier: 1.25,
      nextTier: 'Gold',
      pointsToNext: 750 - safe,
      progressPercent: Math.round(((safe - 250) / 500) * 100),
      perks: ['1.25× points on every order', 'Complimentary birthday treat', 'Early access to seasonal combos'],
    };
  }
  return {
    name: 'Bronze',
    multiplier: 1,
    nextTier: 'Silver',
    pointsToNext: 250 - safe,
    progressPercent: Math.round((safe / 250) * 100),
    perks: ['1 point per 1,000 UZS spent', 'Redeem 100 pts for 5,000 UZS off'],
  };
}

export function createOrderId(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return `VR-${Array.from(bytes, (v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

export function isRestaurantOpen(settings: RestaurantSettings): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tashkent',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 12);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const now = h * 60 + m;
    const [oh, om] = settings.open.split(':').map(Number);
    const [ch, cm] = settings.close.split(':').map(Number);
    const start = oh * 60 + om;
    const end = ch * 60 + cm;
    return start <= end ? now >= start && now < end : now >= start || now < end;
  } catch {
    return true;
  }
}

export function sanitizeOrdersList(raw: unknown): Order[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Order => Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string'))
    .map((entry) => ({
      ...entry,
      status: normalizeLiveStatus(entry.status),
      items: Array.isArray(entry.items) ? entry.items : [],
      totals: entry.totals && typeof entry.totals === 'object' ? entry.totals : { subtotal: 0, discount: 0, delivery: 0, total: 0 },
    }))
    .slice(-100);
}
