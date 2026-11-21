export type Lang = 'en' | 'uz' | 'ru';

export type CategoryId = 'all' | 'combos' | 'fast-food' | 'snacks' | 'drinks' | 'favorites';

export type DietFilter = 'all' | 'vegetarian' | 'dairy-free' | 'spicy';

export type FulfillmentMode = 'delivery' | 'pickup' | 'reservation' | 'dine-in';

export type PaymentMethod = 'cash' | 'terminal' | 'click' | 'payme';

export interface DeliveryCoords {
  lat: number;
  lng: number;
  distanceKm?: number;
  etaMinutes?: number;
}

export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'delivered'
  | 'declined';

export interface NutritionMacros {
  protein: number;
  carbs: number;
  fat: number;
}

export interface MenuItem {
  id: string;
  cat: 'combos' | 'fast-food' | 'snacks' | 'drinks';
  name: string;
  price: number; // discounted price
  originalPrice: number;
  discountRate: number;
  desc: string;
  img: string;
  tag?: string;
  bogo?: boolean;
  available: boolean;
  dietary: Array<'vegetarian' | 'dairy-free' | 'spicy'>;
  prepMinutes?: number;
  calories: number;
  macros: NutritionMacros;
  allergens: string[];
}

export interface CartOptions {
  cheese?: boolean;
  meat?: boolean;
  spice?: 'Mild' | 'Medium' | 'Hot';
  sauce?: string;
}

export interface CartLine {
  key: string;
  id: string;
  qty: number;
  options: CartOptions;
  bundle?: [string, string, string];
}

export interface Promotion {
  type: 'percent' | 'category' | 'bogo';
  rate?: number;
  category?: string;
  label: string;
  custom?: boolean;
}

export interface RestaurantSettings {
  open: string;
  close: string;
  deliveryFee: number;
  freeThreshold: number;
  etaMin: number;
  etaMax: number;
  promoOff: string[];
  customPromos: Array<{ code: string; rate: number }>;
}

export interface OrderItem {
  id: string;
  name: string;
  qty: number;
  unit: number;
  options: CartOptions;
  bundle?: string[];
}

export interface OrderCustomer {
  name: string;
  phone: string;
  address: string;
  date: string;
  time: string;
  guests: string;
  table: string;
  note: string;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
}

export interface Order {
  id: string;
  userId?: string;
  source: 'website';
  mode: FulfillmentMode;
  status: OrderStatus;
  createdAt: string;
  eta?: { min: number; max: number };
  scheduledDeliveryTime?: string;
  paymentMethod?: PaymentMethod;
  deliveryCoords?: DeliveryCoords;
  kitchenNote?: string;
  customer: OrderCustomer;
  deliveryInstructions?: string;
  dietaryNotes?: string;
  items: OrderItem[];
  codes: string[];
  rewards: {
    phone: string;
    pointsRedeemed: number;
    pointsEarned: number;
  };
  totals: OrderTotals;
}

export interface Review {
  id: string;
  name: string;
  category: 'combos' | 'fast-food' | 'snacks' | 'drinks';
  rating: number;
  text: string;
  approved?: boolean;
  createdAt: string;
}

export interface RewardsProfile {
  phone: string;
  name: string;
  points: number;
  lifetimePoints?: number;
  sessionToken: string;
}

export interface LoyaltyTierInfo {
  name: 'Bronze' | 'Silver' | 'Gold';
  multiplier: number;
  nextTier: 'Silver' | 'Gold' | null;
  pointsToNext: number;
  progressPercent: number;
  perks: string[];
}

export interface OrderNotification {
  id: string;
  orderId: string;
  status: OrderStatus;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  phone: string;
  defaultAddress: string;
  favorites: string[];
  updatedAt: string;
}
