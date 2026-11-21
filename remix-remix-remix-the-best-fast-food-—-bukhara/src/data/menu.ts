import { MenuItem, Promotion, RestaurantSettings } from '../types';

export const HERO_BACKDROP = '/src/assets/images/hero_sunlit_travertine_wall_1795176209726.jpg';

export const HERO_SLIDES = [
  {
    id: 'hero-1',
    img: '/src/assets/images/hero_burger_fries_cola_studio_1795176457989.jpg',
    title: 'Double Flame-Seared Smash Burger',
    caption: 'Crispy caramelized beef, aged cheddar, golden fries & chilled iced cola',
  },
  {
    id: 'hero-2',
    img: '/src/assets/images/hero_signature_feast_clean_1795176210416.jpg',
    title: 'The Best Signature Platter',
    caption: 'Toasted brioche cheeseburger, golden fries & chilled cola on warm travertine',
  },
  {
    id: 'hero-3',
    img: '/src/assets/images/combo_lavash_duo_1794835984324.jpg',
    title: 'Bukhara Artisan Feast',
    caption: 'Hand-rolled grilled lavash wraps, crispy golden fries & mint lemonade',
  },
];

export const STORY_IMAGE = '/src/assets/images/story_bright_kitchen_1795012784797.jpg';

export const FOOD_PHOTOS: Record<string, string> = {
  c1: '/src/assets/images/combo_the_best_1794835984500.jpg',
  c2: '/src/assets/images/combo_lavash_duo_1794835984324.jpg',
  f1: '/src/assets/images/food_classic_lavash_1794835985715.jpg',
  f2: '/src/assets/images/food_beef_lavash_1794835986072.jpg',
  f3: '/src/assets/images/food_smash_burger_1794835986640.jpg',
  f4: '/src/assets/images/food_double_burger_1794835987076.jpg',
  s1: '/src/assets/images/food_golden_fries_1794835988925.jpg',
  s2: '/src/assets/images/food_loaded_fries_1794835987751.jpg',
  s3: '/src/assets/images/food_chicken_strips_1794835989023.jpg',
  d1: '/src/assets/images/drink_iced_cola_1794835989905.jpg',
  d2: '/src/assets/images/drink_ayran_1794835990217.jpg',
  d3: '/src/assets/images/drink_mint_lemonade_1794835989941.jpg',
};

export const ITEM_DISCOUNTS: Record<string, number> = {
  c1: 15,
  c2: 22,
  f1: 29,
  f2: 36,
  f3: 43,
  f4: 50,
  s1: 21,
  s2: 28,
  s3: 35,
  d1: 42,
  d2: 49,
  d3: 20,
};

export const BASE_MENU: Array<Omit<MenuItem, 'originalPrice' | 'discountRate' | 'available'>> = [
  {
    id: 'c1',
    cat: 'combos',
    name: 'The Best Combo',
    price: 69000,
    desc: 'Smash burger, golden fries, and iced cola.',
    img: FOOD_PHOTOS.c1,
    tag: 'Bestseller',
    dietary: [],
    prepMinutes: 12,
    calories: 990,
    macros: { protein: 38, carbs: 108, fat: 44 },
    allergens: ['Gluten', 'Dairy', 'Sesame'],
  },
  {
    id: 'c2',
    cat: 'combos',
    name: 'Lavash Duo',
    price: 79000,
    desc: 'Classic lavash, fries, and your choice of drink.',
    img: FOOD_PHOTOS.c2,
    tag: 'Feed two',
    dietary: [],
    prepMinutes: 14,
    calories: 940,
    macros: { protein: 42, carbs: 104, fat: 38 },
    allergens: ['Gluten'],
  },
  {
    id: 'f1',
    cat: 'fast-food',
    name: 'Classic Lavash',
    price: 32000,
    desc: 'Tender chicken, crisp vegetables, garlic sauce.',
    img: FOOD_PHOTOS.f1,
    bogo: true,
    dietary: ['dairy-free'],
    prepMinutes: 8,
    calories: 460,
    macros: { protein: 28, carbs: 46, fat: 18 },
    allergens: ['Gluten'],
  },
  {
    id: 'f2',
    cat: 'fast-food',
    name: 'Beef Lavash',
    price: 39000,
    desc: 'Flame-seared beef, pickles, onion, house sauce.',
    img: FOOD_PHOTOS.f2,
    bogo: true,
    dietary: ['dairy-free', 'spicy'],
    prepMinutes: 9,
    calories: 540,
    macros: { protein: 32, carbs: 48, fat: 24 },
    allergens: ['Gluten'],
  },
  {
    id: 'f3',
    cat: 'fast-food',
    name: 'Smash Burger',
    price: 45000,
    desc: 'Crisp-edged beef, cheddar, pickles, The Best sauce.',
    img: FOOD_PHOTOS.f3,
    tag: 'Bestseller',
    dietary: ['dairy-free'],
    prepMinutes: 10,
    calories: 510,
    macros: { protein: 29, carbs: 36, fat: 28 },
    allergens: ['Gluten', 'Dairy', 'Sesame'],
  },
  {
    id: 'f4',
    cat: 'fast-food',
    name: 'Double The Best',
    price: 62000,
    desc: 'Two smashed patties, double cheddar, bold sauce.',
    img: FOOD_PHOTOS.f4,
    dietary: ['dairy-free', 'spicy'],
    prepMinutes: 11,
    calories: 760,
    macros: { protein: 48, carbs: 38, fat: 46 },
    allergens: ['Gluten', 'Dairy', 'Sesame'],
  },
  {
    id: 's1',
    cat: 'snacks',
    name: 'Golden Fries',
    price: 18000,
    desc: 'Hand-cut, twice-cooked, sea salt.',
    img: FOOD_PHOTOS.s1,
    dietary: ['vegetarian'],
    prepMinutes: 6,
    calories: 340,
    macros: { protein: 5, carbs: 44, fat: 16 },
    allergens: [],
  },
  {
    id: 's2',
    cat: 'snacks',
    name: 'Loaded Fries',
    price: 32000,
    desc: 'Cheddar, beef crumble, pickles, house sauce.',
    img: FOOD_PHOTOS.s2,
    tag: 'New',
    dietary: ['spicy'],
    prepMinutes: 8,
    calories: 530,
    macros: { protein: 22, carbs: 48, fat: 28 },
    allergens: ['Dairy'],
  },
  {
    id: 's3',
    cat: 'snacks',
    name: 'Chicken Strips',
    price: 29000,
    desc: 'Crisp chicken strips with two dipping sauces.',
    img: FOOD_PHOTOS.s3,
    dietary: ['dairy-free', 'spicy'],
    prepMinutes: 8,
    calories: 410,
    macros: { protein: 30, carbs: 26, fat: 21 },
    allergens: ['Gluten', 'Egg'],
  },
  {
    id: 'd1',
    cat: 'drinks',
    name: 'Iced Cola',
    price: 9000,
    desc: 'Classic cola served cold with plenty of ice.',
    img: FOOD_PHOTOS.d1,
    dietary: ['dairy-free'],
    prepMinutes: 2,
    calories: 140,
    macros: { protein: 0, carbs: 35, fat: 0 },
    allergens: [],
  },
  {
    id: 'd2',
    cat: 'drinks',
    name: 'Ayran',
    price: 8000,
    desc: 'Cool, lightly salted yoghurt drink.',
    img: FOOD_PHOTOS.d2,
    dietary: ['vegetarian'],
    prepMinutes: 2,
    calories: 110,
    macros: { protein: 6, carbs: 8, fat: 6 },
    allergens: ['Dairy'],
  },
  {
    id: 'd3',
    cat: 'drinks',
    name: 'Mint Lemonade',
    price: 14000,
    desc: 'Fresh lemon, mint, and a gentle sparkle.',
    img: FOOD_PHOTOS.d3,
    dietary: ['vegetarian', 'dairy-free'],
    prepMinutes: 3,
    calories: 120,
    macros: { protein: 0, carbs: 30, fat: 0 },
    allergens: [],
  },
];

export const DEFAULT_PROMOS: Record<string, Promotion> = {
  WELCOME10: { type: 'percent', rate: 0.1, label: '10% off your order' },
  YARIM50: { type: 'percent', rate: 0.5, label: 'Up to 50% off your order' },
  COMBO25: { type: 'category', category: 'combos', rate: 0.25, label: '25% off combos' },
  '1PLUS1': { type: 'bogo', label: 'Lavash: buy one, get one' },
};

export const SAUCE_OPTIONS = ['The Best', 'Garlic', 'Spicy tomato', 'No sauce'] as const;

export const SAUCE_NUTRITION: Record<
  string,
  { calories: number; macros: { protein: number; carbs: number; fat: number }; allergens: string[] }
> = {
  'The Best': { calories: 80, macros: { protein: 1, carbs: 5, fat: 6 }, allergens: ['Egg', 'Mustard'] },
  Garlic: { calories: 90, macros: { protein: 1, carbs: 3, fat: 8 }, allergens: ['Egg'] },
  'Spicy tomato': { calories: 35, macros: { protein: 1, carbs: 7, fat: 0 }, allergens: [] },
  'No sauce': { calories: 0, macros: { protein: 0, carbs: 0, fat: 0 }, allergens: [] },
};

export const ADDON_NUTRITION = {
  cheese: { calories: 110, macros: { protein: 7, carbs: 1, fat: 9 }, allergens: ['Dairy'] },
  meat: { calories: 210, macros: { protein: 22, carbs: 1, fat: 13 }, allergens: [] as string[] },
};

export const DEFAULT_SETTINGS: RestaurantSettings = {
  open: '10:00',
  close: '23:00',
  deliveryFee: 12000,
  freeThreshold: 150000,
  etaMin: 25,
  etaMax: 35,
  promoOff: [],
  customPromos: [],
};

export const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'combos', label: 'Combos' },
  { id: 'fast-food', label: 'Fast food' },
  { id: 'snacks', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'favorites', label: 'Favorites' },
] as const;

export const DIET_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'spicy', label: 'Spicy' },
] as const;
