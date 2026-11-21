import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(__dirname, '.data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

interface StoreData {
  menuOverrides: {
    items: Array<{
      id: string;
      name: string;
      desc: string;
      price: number;
      discountRate: number;
      available: boolean;
    }>;
    promos: Record<string, { type: string; rate?: number; category?: string; label: string; custom?: boolean }>;
    promoOff: string[];
    customPromos: Array<{ code: string; rate: number }>;
    open: string;
    close: string;
    deliveryFee: number;
    freeThreshold: number;
    etaMin: number;
    etaMax: number;
  } | null;
  reviews: Array<{
    id: string;
    name: string;
    category: string;
    rating: number;
    text: string;
    approved: boolean;
    createdAt: string;
  }>;
  orders: Array<Record<string, unknown>>;
  rewardsAccounts: Record<
    string,
    {
      phone: string;
      name: string;
      points: number;
      lifetimePoints: number;
      verified: boolean;
      sessionToken: string;
      updatedAt: string;
    }
  >;
  pendingVerifications: Record<
    string,
    {
      phone: string;
      code: string;
      codeSent: boolean;
      verified: boolean;
      createdAt: number;
      sessionToken?: string;
    }
  >;
}

const DEFAULT_REVIEWS: StoreData['reviews'] = [
  {
    id: 'rev-1',
    name: 'Dilshod R.',
    category: 'fast-food',
    rating: 5,
    text: 'Crispy smash burger edges and the house sauce hits every time. Delivered hot in Bukhara in 22 minutes.',
    approved: true,
    createdAt: '2026-10-18T14:20:00.000Z',
  },
  {
    id: 'rev-2',
    name: 'Malika K.',
    category: 'combos',
    rating: 5,
    text: 'Lavash Duo is our weekend staple. Fresh flatbread, generous chicken, and the fries stay crisp.',
    approved: true,
    createdAt: '2026-10-25T18:45:00.000Z',
  },
  {
    id: 'rev-3',
    name: 'Sardor T.',
    category: 'snacks',
    rating: 5,
    text: 'Loaded fries with beef crumble and cheddar is huge for the price. Great late-night option in Bukhara.',
    approved: true,
    createdAt: '2026-11-02T21:10:00.000Z',
  },
  {
    id: 'rev-4',
    name: 'Aziza N.',
    category: 'drinks',
    rating: 5,
    text: 'Mint lemonade is super refreshing and not overly sweet. Pairs perfectly with Beef Lavash.',
    approved: true,
    createdAt: '2026-11-08T13:15:00.000Z',
  },
];

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        menuOverrides: parsed.menuOverrides ?? null,
        reviews: Array.isArray(parsed.reviews) ? parsed.reviews : DEFAULT_REVIEWS,
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        rewardsAccounts: parsed.rewardsAccounts ?? {},
        pendingVerifications: parsed.pendingVerifications ?? {},
      };
    }
  } catch (err) {
    console.warn('Could not read store.json, starting fresh:', err);
  }
  return {
    menuOverrides: null,
    reviews: DEFAULT_REVIEWS,
    orders: [],
    rewardsAccounts: {},
    pendingVerifications: {},
  };
}

let store: StoreData = loadStore();

function saveStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to persist store.json:', err);
  }
}

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\D/g, '').slice(0, 15);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Menu & Settings API
  app.get('/api/menu', (_req, res) => {
    if (!store.menuOverrides) {
      return res.json({ items: null });
    }
    return res.json(store.menuOverrides);
  });

  app.put('/api/menu', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 16) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }
    const body = req.body;
    if (!body || !Array.isArray(body.items)) {
      return res.status(400).json({ error: 'Invalid menu payload.' });
    }
    store.menuOverrides = {
      items: body.items.slice(0, 50),
      promos: body.promos && typeof body.promos === 'object' ? body.promos : {},
      promoOff: Array.isArray(body.promoOff) ? body.promoOff : [],
      customPromos: Array.isArray(body.customPromos) ? body.customPromos : [],
      open: String(body.open || '10:00'),
      close: String(body.close || '23:00'),
      deliveryFee: Number(body.deliveryFee ?? 12000),
      freeThreshold: Number(body.freeThreshold ?? 150000),
      etaMin: Number(body.etaMin ?? 25),
      etaMax: Number(body.etaMax ?? 35),
    };
    saveStore();
    return res.json({ ok: true, promos: store.menuOverrides.promos });
  });

  // Reviews API
  app.get('/api/reviews', (req, res) => {
    const showPending = req.query.pending === '1';
    if (showPending) {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ') || authHeader.length < 16) {
        return res.status(401).json({ error: 'Admin authentication required.' });
      }
      return res.json(store.reviews);
    }
    return res.json(store.reviews.filter((r) => r.approved));
  });

  app.post('/api/reviews', (req, res) => {
    const { name, category, rating, text } = req.body || {};
    const cleanName = String(name || '').trim().slice(0, 40);
    const cleanCategory = String(category || '').trim();
    const cleanText = String(text || '').trim().slice(0, 500);
    const numRating = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)));

    if (cleanName.length < 2) {
      return res.status(400).json({ error: 'Please enter your name (at least 2 characters).' });
    }
    if (!['combos', 'fast-food', 'snacks', 'drinks'].includes(cleanCategory)) {
      return res.status(400).json({ error: 'Choose a valid food category.' });
    }
    if (cleanText.length < 10) {
      return res.status(400).json({ error: 'Please write at least 10 characters in your review.' });
    }

    const entry = {
      id: `rev-${crypto.randomBytes(6).toString('hex')}`,
      name: cleanName,
      category: cleanCategory,
      rating: numRating,
      text: cleanText,
      approved: false,
      createdAt: new Date().toISOString(),
    };
    store.reviews.unshift(entry);
    saveStore();
    return res.status(201).json({ ok: true, review: entry });
  });

  app.put('/api/reviews', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 16) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }
    const { id, approved, remove } = req.body || {};
    if (remove) {
      store.reviews = store.reviews.filter((r) => r.id !== id);
      saveStore();
      return res.json({ ok: true });
    }
    const target = store.reviews.find((r) => r.id === id);
    if (!target) {
      return res.status(404).json({ error: 'Review not found.' });
    }
    target.approved = Boolean(approved);
    saveStore();
    return res.json({ ok: true, review: target });
  });

  // Orders Server Mirror API (complements Firestore)
  app.get('/api/orders', (req, res) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ') || authHeader.length < 16) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }
    return res.json(store.orders.slice(0, 100));
  });

  app.post('/api/orders', (req, res) => {
    const order = req.body;
    if (!order || typeof order.id !== 'string') {
      return res.status(400).json({ error: 'Invalid order payload.' });
    }
    store.orders.unshift({ ...order, serverSavedAt: new Date().toISOString() });
    store.orders = store.orders.slice(0, 250);

    // Update loyalty rewards points if verified phone is attached
    const phone = normalizePhone(order.rewards?.phone || '');
    if (phone && store.rewardsAccounts[phone]?.verified) {
      const acct = store.rewardsAccounts[phone];
      const earned = Math.max(0, Math.round(Number(order.rewards?.pointsEarned) || 0));
      const redeemed = Math.max(0, Math.round(Number(order.rewards?.pointsRedeemed) || 0));
      acct.points = Math.max(0, acct.points - redeemed + earned);
      acct.lifetimePoints = Math.max(acct.lifetimePoints, acct.points) + earned;
      acct.updatedAt = new Date().toISOString();
    }

    saveStore();
    return res.status(201).json({ ok: true, id: order.id });
  });

  // Rewards & Phone Verification API
  app.post('/api/rewards/request', (req, res) => {
    const digits = normalizePhone(req.body?.phone || '');
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!/^\d{9,15}$/.test(digits)) {
      return res.status(400).json({ error: 'Enter a valid phone number with 9-15 digits.' });
    }

    const token = crypto.randomBytes(16).toString('hex');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    store.pendingVerifications[token] = {
      phone: digits,
      code,
      codeSent: true,
      verified: false,
      createdAt: Date.now(),
    };

    if (!store.rewardsAccounts[digits]) {
      store.rewardsAccounts[digits] = {
        phone: `+${digits}`,
        name: name || `+${digits}`,
        points: 120,
        lifetimePoints: 120,
        verified: false,
        sessionToken: crypto.randomBytes(20).toString('hex'),
        updatedAt: new Date().toISOString(),
      };
    } else if (name) {
      store.rewardsAccounts[digits].name = name;
    }

    saveStore();

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'TheBestBukharaBot';
    return res.json({
      token,
      botLink: `https://t.me/${botUsername}?start=${token}`,
      previewCode: process.env.TELEGRAM_BOT_TOKEN ? undefined : code,
    });
  });

  app.get('/api/rewards/status', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Missing token.' });
    }

    const pending = store.pendingVerifications[token];
    if (pending) {
      if (Date.now() - pending.createdAt > 10 * 60 * 1000) {
        delete store.pendingVerifications[token];
        saveStore();
        return res.status(410).json({ error: 'Verification link expired. Please start again.' });
      }
      const acct = store.rewardsAccounts[pending.phone];
      return res.json({
        codeSent: pending.codeSent,
        verified: pending.verified,
        phone: acct?.phone || `+${pending.phone}`,
        name: acct?.name || `+${pending.phone}`,
        points: acct?.points ?? 0,
        lifetimePoints: acct?.lifetimePoints ?? 0,
        sessionToken: pending.verified ? acct?.sessionToken : undefined,
      });
    }

    const acct = Object.values(store.rewardsAccounts).find((a) => a.sessionToken === token);
    if (!acct) {
      return res.status(401).json({ error: 'Rewards session expired.' });
    }
    return res.json({
      verified: acct.verified,
      phone: acct.phone,
      name: acct.name,
      points: acct.points,
      lifetimePoints: acct.lifetimePoints,
      sessionToken: acct.sessionToken,
    });
  });

  app.post('/api/rewards/verify', (req, res) => {
    const { token, code } = req.body || {};
    const pending = store.pendingVerifications[String(token || '')];
    if (!pending) {
      return res.status(404).json({ error: 'Verification session not found or expired.' });
    }
    if (String(code || '').trim() !== pending.code) {
      return res.status(400).json({ error: 'Invalid 6-digit verification code.' });
    }
    pending.verified = true;
    const acct = store.rewardsAccounts[pending.phone];
    if (acct) {
      acct.verified = true;
      acct.updatedAt = new Date().toISOString();
      pending.sessionToken = acct.sessionToken;
    }
    saveStore();
    return res.json({ ok: true, verified: true });
  });

  // Gemini Maps Grounding API (server-side only, gemini-4-hydrogen + googleMaps tool)
  app.post('/api/maps/grounding', async (req, res) => {
    const rawQuery = String(req.body?.query || '').trim().slice(0, 300);
    if (rawQuery.length < 3) {
      return res.status(400).json({ error: 'Please enter a location or neighborhood question.' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    // Default coordinates: THE BEST, Bukhara, Uzbekistan
    const latitude = Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : 39.7559636;
    const longitude = Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : 64.4261603;
    const langHint =
      req.body?.lang === 'uz'
        ? 'Respond in Uzbek.'
        : req.body?.lang === 'ru'
          ? 'Respond in Russian.'
          : 'Respond in English.';

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `You are helping a guest visiting or ordering from THE BEST FAST FOOD in Bukhara, Uzbekistan (coordinates 39.7559636, 64.4261603). ${langHint} Keep the answer concise, helpful, and grounded in Google Maps data.\n\nQuestion: ${rawQuery}`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude, longitude },
            },
          },
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const places: Array<{
        title: string;
        uri: string;
        placeId?: string;
        reviewSnippets: Array<{ text: string; uri?: string }>;
      }> = [];

      for (const chunk of chunks) {
        const m = (chunk as {
          maps?: {
            title?: string;
            uri?: string;
            placeId?: string;
            placeAnswerSources?: {
              reviewSnippets?: Array<{ reviewText?: string; text?: string; uri?: string }>;
            };
          };
        }).maps;
        if (m?.uri) {
          const snippets = (m.placeAnswerSources?.reviewSnippets || [])
            .map((s) => ({
              text: String(s.reviewText || s.text || '').trim(),
              uri: s.uri ? String(s.uri) : undefined,
            }))
            .filter((s) => s.text.length > 0);
          places.push({
            title: String(m.title || 'Google Maps Place'),
            uri: String(m.uri),
            ...(m.placeId ? { placeId: String(m.placeId) } : {}),
            reviewSnippets: snippets,
          });
        }
      }

      return res.json({
        text: response.text || '',
        places,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Maps grounding request failed.';
      console.error('Maps grounding error:', err);
      return res.status(502).json({ error: msg });
    }
  });

  // Voice Search Transcription API (gemini-3.5-transcribe)
  app.post('/api/voice/transcribe', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'Gemini API key is not configured in server secrets.',
      });
    }

    const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64.trim() : '';
    const rawMime = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : 'audio/webm';
    const mimeType = rawMime.split(';')[0] || 'audio/webm';

    if (!audioBase64) {
      return res.status(400).json({ error: 'No audio recording was received.' });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const transcribeResp = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Transcribe this short restaurant menu search query accurately in the spoken language (English, Russian, or Uzbek). Output only the spoken words without punctuation.',
            },
          ],
        },
      });

      const text = (transcribeResp.text || '')
        .trim()
        .replace(/[.!?,"'«»]+$/g, '')
        .trim()
        .slice(0, 120);

      if (!text) {
        return res.status(422).json({
          error: 'Could not hear any speech. Try speaking closer to your microphone.',
        });
      }

      return res.json({ text });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice transcription failed.';
      console.error('Voice transcribe error:', msg);
      return res.status(502).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`THE BEST FAST FOOD server running at http://localhost:${PORT}`);
  });
}

startServer();
