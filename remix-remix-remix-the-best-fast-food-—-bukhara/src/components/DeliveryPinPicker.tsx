import React, { useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  Pin,
} from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import type { DeliveryCoords, Lang } from '../types';

const STORE_COORDS = { lat: 39.7559636, lng: 64.4261603 };

const BUKHARA_LANDMARKS = [
  { label: 'Bukhara Center', lat: 39.7747, lng: 64.4286 },
  { label: 'Ark Fortress Area', lat: 39.7779, lng: 64.4109 },
  { label: '5th Microdistrict', lat: 39.7532, lng: 64.4398 },
  { label: 'Bukhara Railway', lat: 39.7219, lng: 64.5446 },
];

export function calculateDeliveryMetrics(lat: number, lng: number): {
  distanceKm: number;
  etaMinutes: number;
} {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat - STORE_COORDS.lat);
  const dLng = toRad(lng - STORE_COORDS.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(STORE_COORDS.lat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const roadFactor = 1.25;
  const distanceKm = Math.max(0.3, Math.round(R * c * roadFactor * 10) / 10);
  const etaMinutes = Math.min(60, Math.max(18, Math.round(14 + distanceKm * 3.5)));
  return { distanceKm, etaMinutes };
}

interface DeliveryPinPickerProps {
  lang: Lang;
  value: DeliveryCoords | null;
  onChange: (coords: DeliveryCoords, suggestedAddress?: string) => void;
}

export const DeliveryPinPicker: React.FC<DeliveryPinPickerProps> = ({
  lang,
  value,
  onChange,
}) => {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const mapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.GOOGLE_MAPS_API_KEY || '';

  const selectPoint = (lat: number, lng: number, label?: string) => {
    const { distanceKm, etaMinutes } = calculateDeliveryMetrics(lat, lng);
    const coords: DeliveryCoords = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      distanceKm,
      etaMinutes,
    };
    const suggested = label
      ? `${label}, Bukhara (${coords.lat}, ${coords.lng})`
      : `Bukhara Pin (${coords.lat}, ${coords.lng})`;
    onChange(coords, suggested);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported in this browser.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        selectPoint(pos.coords.latitude, pos.coords.longitude, 'Current Location');
      },
      () => {
        setLocating(false);
        setGeoError('Location permission denied. Tap the map or pick an area below.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const pinPos = value ? { lat: value.lat, lng: value.lng } : STORE_COORDS;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2.5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#111111] inline-flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#E5A210]" />
          <span>Pin delivery spot in Bukhara</span>
        </span>
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating}
          className="h-7 px-2.5 rounded-lg bg-[#FAFAFA] border border-neutral-200 hover:border-[#F2B01E] text-[11px] font-semibold text-[#9E7000] inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
        >
          <LocateFixed className="w-3 h-3 text-[#E5A210]" />
          <span>{locating ? 'Locating…' : 'Use my GPS'}</span>
        </button>
      </div>

      {mapsApiKey ? (
        <div className="relative h-[180px] rounded-lg overflow-hidden border border-neutral-200 bg-[#FAFAFA]">
          <APIProvider
            apiKey={mapsApiKey}
            language={lang}
            region="UZ"
            solutionChannel="gmp_mcp_codeassist_v1_aistudio"
          >
            <GoogleMap
              defaultCenter={STORE_COORDS}
              center={pinPos}
              defaultZoom={14}
              mapId="DEMO_MAP_ID"
              gestureHandling="greedy"
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
              onClick={(ev) => {
                const ll = ev.detail.latLng;
                if (ll) selectPoint(ll.lat, ll.lng);
              }}
            >
              <AdvancedMarker position={STORE_COORDS} title="THE BEST Kitchen">
                <Pin background="#111111" borderColor="#F2B01E" glyphColor="#F2B01E" glyphText="TB" />
              </AdvancedMarker>
              {value && (
                <AdvancedMarker position={{ lat: value.lat, lng: value.lng }} title="Delivery Pin">
                  <Pin background="#F2B01E" borderColor="#111111" glyphColor="#111111" />
                </AdvancedMarker>
              )}
            </GoogleMap>
          </APIProvider>
        </div>
      ) : (
        <div className="text-[11px] text-neutral-600 bg-[#FAFAFA] border border-neutral-200 rounded-lg px-3 py-2">
          Pick a Bukhara landmark or tap <strong className="text-[#111111]">Use my GPS</strong> to calculate live delivery distance & ETA.
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {BUKHARA_LANDMARKS.map((lm) => (
          <button
            key={lm.label}
            type="button"
            onClick={() => selectPoint(lm.lat, lm.lng, lm.label)}
            className="h-7 px-2.5 rounded-lg bg-[#FAFAFA] border border-neutral-200 hover:border-[#F2B01E] text-[11px] font-medium text-neutral-600 hover:text-[#111111] transition-colors cursor-pointer"
          >
            {lm.label}
          </button>
        ))}
      </div>

      {geoError && <p className="text-[11px] text-red-600 font-medium">{geoError}</p>}

      {value && (
        <div className="flex items-center justify-between text-xs bg-[#FAFAFA] border border-[#F2B01E] rounded-lg px-3 py-2">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#9E7000]">
            <Navigation className="w-3.5 h-3.5 text-[#E5A210]" />
            <span>{value.distanceKm} km from THE BEST</span>
          </span>
          <span className="font-mono font-bold text-[#111111] tabular-nums">
            ~{value.etaMinutes} min ETA
          </span>
        </div>
      )}
    </div>
  );
};
