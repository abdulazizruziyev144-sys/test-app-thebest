import React, { useEffect, useState } from 'react';
import { Award, CheckCircle2, ExternalLink, Sparkles, X } from 'lucide-react';
import { translate } from '../data/i18n';
import { getLoyaltyTier, normalizePhone } from '../lib/calculations';
import { Lang, RewardsProfile } from '../types';

interface RewardsModalProps {
  open: boolean;
  lang: Lang;
  profile: RewardsProfile | null;
  onClose: () => void;
  onSignedIn: (profile: RewardsProfile) => void;
  onSignOut: () => void;
}

export const RewardsModal: React.FC<RewardsModalProps> = ({
  open,
  lang,
  profile,
  onClose,
  onSignedIn,
  onSignOut,
}) => {
  const t = (k: string) => translate(lang, k);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [botLink, setBotLink] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch('/api/rewards/status', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.verified && data.sessionToken) {
          window.clearInterval(timer);
          onSignedIn({
            phone: data.phone,
            name: name.trim() || data.name || data.phone,
            points: Number(data.points) || 0,
            lifetimePoints: Number(data.lifetimePoints) || Number(data.points) || 0,
            sessionToken: data.sessionToken,
          });
          setToken(null);
          setCode('');
        }
      } catch {
        // silent poll
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [token, name, onSignedIn]);

  if (!open) return null;

  const tier = getLoyaltyTier(profile?.points || 0);

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const digits = normalizePhone(phone);
    if (!/^\d{9,15}$/.test(digits)) {
      setError('Enter a valid phone number with 9–15 digits.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/rewards/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: digits, name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not start phone verification.');
      setToken(data.token);
      setBotLink(data.botLink);
      setPreviewCode(data.previewCode || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification request failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setError('');
    setBusy(true);
    try {
      const verify = await fetch('/api/rewards/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: code.trim() }),
      });
      const vData = await verify.json().catch(() => ({}));
      if (!verify.ok) throw new Error(vData.error || 'Invalid verification code.');

      const statusRes = await fetch('/api/rewards/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const status = await statusRes.json();
      if (status.verified && status.sessionToken) {
        onSignedIn({
          phone: status.phone,
          name: name.trim() || status.name || status.phone,
          points: Number(status.points) || 0,
          lifetimePoints: Number(status.lifetimePoints) || Number(status.points) || 0,
          sessionToken: status.sessionToken,
        });
        setToken(null);
        setCode('');
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#191919]/35 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rewardsDialogTitle"
    >
      <div className="bg-[#FAF8F3] border border-[#191919]/12 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-[#191919]">
        <div className="px-5 py-4 border-b border-[#191919]/10 bg-[#F2EDE3] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#D8961D]" />
            <h2 id="rewardsDialogTitle" className="font-display font-extrabold text-xl text-[#191919] tracking-tight">
              {t('The Best Rewards')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rewards"
            className="w-9 h-9 rounded-lg border border-[#191919]/14 bg-white text-[#5C5346] hover:text-[#191919] hover:border-[#E9A92F] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {profile ? (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-white border border-[#191919]/10 shadow-xs text-[#191919] space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-[#5C5346]">{profile.phone}</div>
                    <div className="font-display font-bold text-xl mt-0.5 text-[#191919]">{profile.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[#B67A0E]">
                      <Sparkles className="w-3.5 h-3.5 text-[#D8961D]" />
                      <span>{tier.name} Tier</span>
                    </div>
                    <div className="font-mono font-bold text-2xl text-[#B67A0E] tabular-nums mt-0.5">
                      {profile.points} pts
                    </div>
                  </div>
                </div>

                {tier.nextTier && (
                  <div>
                    <div className="flex justify-between text-xs text-[#5C5346] mb-1.5 tabular-nums">
                      <span>Progress to {tier.nextTier}</span>
                      <span>{tier.pointsToNext} pts needed</span>
                    </div>
                    <div className="h-1.5 bg-[#FAF8F3] border border-[#191919]/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E9A92F]"
                        style={{ width: `${tier.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-[#191919]/10 space-y-1.5">
                  <div className="text-xs font-semibold text-[#191919]">Active Tier Perks</div>
                  {tier.perks.map((p) => (
                    <div key={p} className="text-xs text-[#5C5346] flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#D8961D] shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-[#191919]/10 bg-white rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#5C5346]">
                  Redeemable Vouchers
                </div>
                <div className="flex justify-between text-sm text-[#5C5346]">
                  <span>100 points</span>
                  <strong className="font-mono text-[#191919]">5,000 UZS off</strong>
                </div>
                <div className="flex justify-between text-sm text-[#5C5346]">
                  <span>250 points</span>
                  <strong className="font-mono text-[#191919]">12,500 UZS off</strong>
                </div>
                <div className="flex justify-between text-sm text-[#5C5346]">
                  <span>500 points (Bonus Tier)</span>
                  <strong className="font-mono text-[#B67A0E]">30,000 UZS off</strong>
                </div>
                <p className="text-xs text-[#5C5346] pt-1">
                  Apply points directly inside your shopping cart drawer.
                </p>
              </div>

              <button
                type="button"
                onClick={onSignOut}
                className="h-10 w-full rounded-lg border border-[#191919]/14 bg-white hover:border-[#E9A92F] text-sm font-semibold text-[#191919] transition-colors cursor-pointer"
              >
                {t('Sign out')}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F2EDE3] border border-[#191919]/10 rounded-lg">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`h-8 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'login' ? 'bg-[#E9A92F] text-[#191919] font-bold' : 'text-[#5C5346] hover:text-[#191919]'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className={`h-8 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'signup' ? 'bg-[#E9A92F] text-[#191919] font-bold' : 'text-[#5C5346] hover:text-[#191919]'
                  }`}
                >
                  Create account
                </button>
              </div>

              {!token ? (
                <form onSubmit={handleRequestVerification} className="space-y-3.5">
                  {mode === 'signup' && (
                    <label className="block">
                      <span className="text-xs font-semibold text-[#5C5346]">Your name</span>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={60}
                        placeholder="e.g. Azizbek"
                        className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-[#191919]/14 text-sm text-[#191919] placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
                      />
                    </label>
                  )}

                  <label className="block">
                    <span className="text-xs font-semibold text-[#5C5346]">Phone number</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998 90 123 45 67"
                      className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-[#191919]/14 text-sm text-[#191919] placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
                    />
                  </label>

                  <p className="text-xs text-[#5C5346]">
                    Your phone is verified via Telegram to unlock server-stored points & Gold tier perks.
                  </p>

                  {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="h-10 w-full rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-sm font-bold transition-colors cursor-pointer"
                  >
                    {busy ? 'Sending…' : 'Continue with Phone'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  {botLink && (
                    <a
                      href={botLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-[#E9A92F]/15 border border-[#E9A92F]/45 text-xs font-semibold text-[#191919] hover:border-[#D8961D] transition-colors"
                    >
                      <span>Open Telegram to verify your phone</span>
                      <ExternalLink className="w-4 h-4 text-[#B67A0E]" />
                    </a>
                  )}

                  {previewCode && (
                    <div className="p-3 rounded-lg bg-white border border-[#E9A92F]/45 text-xs text-[#191919]">
                      Verification code: <strong className="font-mono text-sm text-[#B67A0E]">{previewCode}</strong>
                    </div>
                  )}

                  <label className="block">
                    <span className="text-xs font-semibold text-[#5C5346]">
                      6-digit verification code
                    </span>
                    <input
                      required
                      minLength={6}
                      maxLength={6}
                      inputMode="numeric"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="123456"
                      className="mt-1 w-full h-10 px-3 rounded-lg bg-white border border-[#191919]/14 font-mono text-sm text-[#191919] tracking-widest placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
                    />
                  </label>

                  {error && <p className="text-xs text-red-600 font-medium">{error}</p>}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setToken(null)}
                      className="h-10 px-4 rounded-lg border border-[#191919]/14 bg-white text-xs font-semibold text-[#5C5346] hover:text-[#191919] hover:border-[#E9A92F] transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="flex-1 h-10 rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-sm font-bold transition-colors cursor-pointer"
                    >
                      {busy ? 'Verifying…' : 'Verify code'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
