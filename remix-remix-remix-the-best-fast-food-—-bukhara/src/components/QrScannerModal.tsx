import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, QrCode, Upload, X } from 'lucide-react';
import { translate } from '../data/i18n';
import { Lang } from '../types';

interface QrScannerModalProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
  onTableDetected: (tableNumber: string) => void;
}

export function parseTableQrPayload(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const qTable =
        url.searchParams.get('table') ||
        url.searchParams.get('t') ||
        url.searchParams.get('dinein');
      if (qTable) {
        const clean = qTable.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 10);
        if (clean) return clean;
      }
    }
  } catch {
    // Fallback to regex matching
  }

  const keyMatch = trimmed.match(/(?:table|dine[-_]?in|stol)\s*[:=#-]?\s*([a-zA-Z0-9]{1,8})/i);
  if (keyMatch?.[1]) {
    return keyMatch[1].toUpperCase();
  }

  const numMatch = trimmed.match(/^#?(\d{1,3})$/);
  if (numMatch?.[1]) {
    return numMatch[1];
  }

  return null;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  open,
  lang,
  onClose,
  onTableDetected,
}) => {
  const t = (k: string) => translate(lang, k);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'unavailable'>('starting');
  const [cameraMessage, setCameraMessage] = useState('');
  const [manualTable, setManualTable] = useState('');
  const [scanError, setScanError] = useState('');

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleDecodedString = useCallback(
    (raw: string) => {
      const table = parseTableQrPayload(raw);
      if (table) {
        stopCamera();
        onTableDetected(table);
      } else {
        setScanError(`Unrecognized QR code ("${raw.slice(0, 40)}"). Expected a restaurant table code.`);
      }
    },
    [onTableDetected, stopCamera]
  );

  useEffect(() => {
    if (!open) {
      stopCamera();
      setScanError('');
      setCameraMessage('');
      setManualTable('');
      return;
    }

    let cancelled = false;

    async function startCamera() {
      setCameraState('starting');
      setCameraMessage('');
      setScanError('');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraState('unavailable');
        setCameraMessage('Camera access is not available in this browser. Upload a QR image or enter your table number below.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraState('active');

        const scanFrame = () => {
          if (cancelled) return;
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
            const w = video.videoWidth;
            const h = video.videoHeight;
            if (w > 0 && h > 0) {
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              if (ctx) {
                ctx.drawImage(video, 0, 0, w, h);
                const imgData = ctx.getImageData(0, 0, w, h);
                const decoded = jsQR(imgData.data, w, h, { inversionAttempts: 'dontInvert' });
                if (decoded?.data) {
                  handleDecodedString(decoded.data);
                  return;
                }
              }
            }
          }
          rafRef.current = window.requestAnimationFrame(scanFrame);
        };

        rafRef.current = window.requestAnimationFrame(scanFrame);
      } catch {
        if (!cancelled) {
          setCameraState('unavailable');
          setCameraMessage(
            'Camera permission declined or no camera found. Upload a table QR image or enter your table number below.'
          );
        }
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera, handleDecodedString]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError('');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const decoded = jsQR(imgData.data, img.width, img.height);
        if (decoded?.data) {
          handleDecodedString(decoded.data);
        } else {
          setScanError('No QR code detected in the uploaded image.');
        }
      };
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseTableQrPayload(manualTable);
    if (!parsed) {
      setScanError('Enter a valid table number (e.g. 7 or THEBEST:TABLE:7).');
      return;
    }
    stopCamera();
    onTableDetected(parsed);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#191919]/35 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qrScannerTitle"
    >
      <div className="bg-[#FAF8F3] border border-[#191919]/12 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-[#191919]">
        <div className="px-5 py-4 border-b border-[#191919]/10 bg-[#F2EDE3] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#D8961D]" />
            <h2 id="qrScannerTitle" className="font-display font-extrabold text-lg text-[#191919] tracking-tight">
              {t('Scan Table QR')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR scanner"
            className="w-9 h-9 rounded-lg border border-[#191919]/14 bg-white text-[#5C5346] hover:text-[#191919] hover:border-[#E9A92F] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#5C5346]">
            Point your camera at the QR code on your restaurant table to switch to{' '}
            <strong className="text-[#B67A0E]">{t('Dine-in')}</strong> mode and open the digital menu.
          </p>

          {/* Live Camera Viewfinder */}
          <div
            className={`relative aspect-[4/3] rounded-xl overflow-hidden border border-[#191919]/12 flex items-center justify-center ${
              cameraState === 'active' ? 'bg-[#191919]' : 'bg-[#F2EDE3]'
            }`}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-cover ${cameraState === 'active' ? 'block' : 'hidden'}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {cameraState === 'active' && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-44 h-44 border-2 border-[#E9A92F] rounded-xl shadow-[0_0_0_9999px_rgba(25,25,25,0.55)]" />
              </div>
            )}

            {cameraState !== 'active' && (
              <div className="p-6 text-center text-[#191919] space-y-2">
                <Camera className="w-8 h-8 text-[#D8961D] mx-auto" />
                <p className="text-xs text-[#5C5346] leading-relaxed">
                  {cameraState === 'starting'
                    ? 'Starting camera…'
                    : cameraMessage}
                </p>
              </div>
            )}
          </div>

          {scanError && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {scanError}
            </p>
          )}

          {/* Upload QR image fallback */}
          <label className="h-10 px-3 rounded-lg border border-[#191919]/14 bg-white hover:border-[#E9A92F] text-xs font-semibold text-[#B67A0E] flex items-center justify-center gap-2 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload table QR photo</span>
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          {/* Manual Table Code Entry */}
          <form onSubmit={handleManualSubmit} className="pt-3 border-t border-[#191919]/10 space-y-2">
            <label className="text-xs font-semibold text-[#5C5346] block">
              Or enter table number / QR code
            </label>
            <div className="flex gap-2">
              <input
                value={manualTable}
                onChange={(e) => setManualTable(e.target.value)}
                placeholder="e.g. 7 or THEBEST:TABLE:7"
                className="flex-1 h-10 px-3 rounded-lg bg-white border border-[#191919]/14 text-sm text-[#191919] placeholder:text-[#5C5346]/55 focus:outline-none focus:border-[#E9A92F]"
              />
              <button
                type="submit"
                className="h-10 px-4 rounded-lg bg-[#E9A92F] hover:bg-[#D8961D] text-[#191919] text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
              >
                Open Menu
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
