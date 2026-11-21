import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Search, Square, X } from 'lucide-react';
import { Lang } from '../types';

interface MenuSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  resultCount: number;
  totalCount: number;
  clearLabel: string;
  itemsLabel: string;
  lang?: Lang;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Could not read audio recording.'));
    reader.readAsDataURL(blob);
  });
}

export const MenuSearchBar: React.FC<MenuSearchBarProps> = ({
  value,
  onChange,
  placeholder,
  resultCount,
  totalCount,
  clearLabel,
  itemsLabel,
  lang = 'en',
}) => {
  const hasQuery = value.trim().length > 0;
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [voiceError, setVoiceError] = useState('');

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const liveTranscriptRef = useRef('');
  const autoStopRef = useRef<number | null>(null);

  const cleanupAudio = useCallback(() => {
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {
        // ignore
      }
      speechRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupAudio();
    };
  }, [cleanupAudio]);

  const stopVoiceSearch = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      cleanupAudio();
      setVoiceState('idle');
    }
  }, [cleanupAudio]);

  const startVoiceSearch = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setVoiceError('Microphone access is not supported in this browser.');
      return;
    }

    setVoiceError('');
    liveTranscriptRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Live interim transcript via Web Speech API when available
      try {
        const SR =
          (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
            .webkitSpeechRecognition;
        if (SR) {
          const recognition = new SR();
          recognition.lang = lang === 'ru' ? 'ru-RU' : lang === 'uz' ? 'uz-UZ' : 'en-US';
          recognition.interimResults = true;
          recognition.continuous = false;
          recognition.onresult = (event) => {
            let text = '';
            for (let i = 0; i < event.results.length; i += 1) {
              text += event.results[i][0]?.transcript || '';
            }
            const clean = text.trim().replace(/[.!?]+$/g, '');
            if (clean) {
              liveTranscriptRef.current = clean;
              onChange(clean);
            }
          };
          recognition.onerror = () => {};
          recognition.start();
          speechRef.current = recognition;
        }
      } catch {
        // Fallback to server-side Gemini transcription
      }

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || preferredMime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const browserText = liveTranscriptRef.current;
        cleanupAudio();
        recorderRef.current = null;

        // If browser speech recognition already captured clean text, use it immediately
        if (browserText) {
          onChange(browserText);
          setVoiceState('idle');
          return;
        }

        if (blob.size < 400) {
          setVoiceState('idle');
          return;
        }

        setVoiceState('processing');
        try {
          const audioBase64 = await blobToBase64(blob);
          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioBase64, mimeType }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data.error || 'Could not transcribe voice search.');
          }
          if (data.text) {
            onChange(String(data.text));
          }
        } catch (err) {
          setVoiceError(err instanceof Error ? err.message : 'Voice search failed.');
        } finally {
          setVoiceState('idle');
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setVoiceState('listening');

      // Auto-stop after 6 seconds for quick menu search
      autoStopRef.current = window.setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === 'recording') {
          recorderRef.current.stop();
        }
      }, 6000);
    } catch (err) {
      cleanupAudio();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setVoiceError('Microphone permission denied. Allow microphone access to use voice search.');
      } else if (name === 'NotFoundError') {
        setVoiceError('No microphone detected on this device.');
      } else {
        setVoiceError('Could not access microphone.');
      }
      setVoiceState('idle');
    }
  }, [cleanupAudio, lang, onChange]);

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="menu-search-input"
            type="search"
            value={value}
            onChange={(e) => {
              setVoiceError('');
              onChange(e.target.value);
            }}
            placeholder={voiceState === 'listening' ? 'Listening… say burger, lavash, fries…' : placeholder}
            aria-label={placeholder}
            className={`w-full h-12 pl-10 pr-36 text-sm bg-white border rounded-2xl text-[#111111] placeholder:text-neutral-400 focus:outline-none transition-colors shadow-2xs ${
              voiceState === 'listening'
                ? 'border-[#F2B01E] ring-2 ring-[#F2B01E]/35'
                : 'border-neutral-200 focus:border-[#F2B01E]'
            }`}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-neutral-500 tabular-nums pointer-events-none hidden sm:inline mr-0.5">
              {resultCount}/{totalCount} {itemsLabel}
            </span>
            {hasQuery && (
              <button
                type="button"
                onClick={() => onChange('')}
                aria-label={clearLabel}
                className="w-7 h-7 rounded-lg bg-white hover:bg-[#F2B01E] text-[#111111] border border-neutral-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={voiceState === 'processing'}
              onClick={voiceState === 'listening' ? stopVoiceSearch : startVoiceSearch}
              title={voiceState === 'listening' ? 'Stop voice search' : 'Search menu by voice'}
              aria-label={voiceState === 'listening' ? 'Stop voice search' : 'Search menu by voice'}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer disabled:opacity-60 ${
                voiceState === 'listening'
                  ? 'bg-[#F2B01E] text-[#111111]'
                  : 'bg-white border border-neutral-200 text-[#111111] hover:border-[#F2B01E] hover:bg-[#F2B01E]'
              }`}
            >
              {voiceState === 'processing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : voiceState === 'listening' ? (
                <Square className="w-3 h-3 fill-[#111111]" />
              ) : (
                <Mic className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {voiceState === 'listening' && (
        <p className="text-xs font-semibold text-[#9E7000] flex items-center gap-1.5 pl-1">
          <span className="w-2 h-2 rounded-full bg-[#F2B01E] animate-ping" />
          <span>Listening… tap the stop button or pause when finished.</span>
        </p>
      )}
      {voiceState === 'processing' && (
        <p className="text-xs text-neutral-600 pl-1">Transcribing your search…</p>
      )}
      {voiceError && (
        <p className="text-xs font-medium text-red-600 pl-1" role="alert">
          {voiceError}
        </p>
      )}
    </div>
  );
};
