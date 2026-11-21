import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Lang } from '../types';

interface BukharaStoreMapProps {
  lang: Lang;
  onAddressResolved?: (address: string, coords?: { lat: number; lng: number }) => void;
}

interface ResolvedPlace {
  lat: number;
  lng: number;
  name: string;
  address: string;
}

const STORE_COORDS = { lat: 39.7559636, lng: 64.4261603 };
const STORE_MAPS_URL = 'https://maps.app.goo.gl/oXXdrwXF1V3RUzyn7';
const DEFAULT_ADDRESS = 'THE BEST, Bukhara, Uzbekistan';

const StoreMapInner: React.FC<{
  onAddressResolved?: (address: string, coords?: { lat: number; lng: number }) => void;
}> = ({ onAddressResolved }) => {
  const placesLib = useMapsLibrary('places');
  const [place, setPlace] = useState<ResolvedPlace>({
    lat: STORE_COORDS.lat,
    lng: STORE_COORDS.lng,
    name: 'THE BEST FAST FOOD',
    address: DEFAULT_ADDRESS,
  });
  const [infoOpen, setInfoOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;

    async function lookupLocation() {
      try {
        const { Place } = placesLib!;
        const { places } = await Place.searchByText({
          textQuery: 'THE BEST, Bukhara, Uzbekistan',
          locationBias: {
            center: STORE_COORDS,
            radius: 500,
          },
          fields: ['displayName', 'formattedAddress', 'location'],
          region: 'UZ',
          maxResultCount: 1,
        });
        if (cancelled) return;
        const first = places?.[0];
        if (first?.location) {
          const lat =
            typeof first.location.lat === 'function'
              ? first.location.lat()
              : Number(first.location.lat);
          const lng =
            typeof first.location.lng === 'function'
              ? first.location.lng()
              : Number(first.location.lng);
          const isNearby =
            Math.abs(lat - STORE_COORDS.lat) < 0.01 && Math.abs(lng - STORE_COORDS.lng) < 0.01;
          const address =
            isNearby && first.formattedAddress ? first.formattedAddress : DEFAULT_ADDRESS;
          const resolved: ResolvedPlace = {
            lat: STORE_COORDS.lat,
            lng: STORE_COORDS.lng,
            name: 'THE BEST FAST FOOD',
            address,
          };
          setPlace(resolved);
          onAddressResolved?.(address, STORE_COORDS);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('OVER_QUERY_LIMIT') || msg.includes('429')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        if (!cancelled) {
          setStatusMsg('Could not refresh live place details from Google Maps.');
        }
      }
    }

    lookupLocation();
    return () => {
      cancelled = true;
    };
  }, [placesLib]);

  const markerPos = { lat: place.lat, lng: place.lng };

  return (
    <div className="relative w-full h-[300px] sm:h-[360px] bg-[#FAFAFA]">
      <GoogleMap
        defaultCenter={STORE_COORDS}
        center={markerPos}
        defaultZoom={16}
        mapId="DEMO_MAP_ID"
        gestureHandling="cooperative"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={true}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%' }}
      >
        <AdvancedMarker
          position={markerPos}
          title="THE BEST FAST FOOD — Bukhara"
          onClick={() => setInfoOpen((prev) => !prev)}
        >
          <Pin
            background="#F2B01E"
            borderColor="#111111"
            glyphColor="#111111"
            glyphText="TB"
          />
        </AdvancedMarker>

        {infoOpen && (
          <InfoWindow position={markerPos} onCloseClick={() => setInfoOpen(false)}>
            <div className="text-[#111111] p-1 space-y-1 max-w-[220px]">
              <strong className="block font-display text-sm">THE BEST FAST FOOD</strong>
              <span className="block text-xs text-neutral-600">
                {place.address || DEFAULT_ADDRESS}
              </span>
              <a
                href={STORE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-semibold text-[#9E7000] hover:underline"
              >
                Open in Google Maps ↗
              </a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {statusMsg && (
        <div className="absolute bottom-2 left-2 right-2 bg-white/95 border border-neutral-200 rounded-md px-3 py-1.5 text-xs text-[#111111] shadow-sm">
          {statusMsg}
        </div>
      )}
    </div>
  );
};

export const BukharaStoreMap: React.FC<BukharaStoreMapProps> = ({ lang, onAddressResolved }) => {
  const mapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.GOOGLE_MAPS_API_KEY || '';

  if (!mapsApiKey) {
    return (
      <div className="w-full h-[300px] sm:h-[360px] bg-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center gap-2">
        <p className="text-sm font-semibold text-[#111111]">
          Interactive Google Map loads automatically when GOOGLE_MAPS_API_KEY is configured.
        </p>
        <a
          href={STORE_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-[#9E7000] hover:underline"
        >
          Open Google Maps →
        </a>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={mapsApiKey}
      language={lang}
      region="UZ"
      solutionChannel="gmp_mcp_codeassist_v1_aistudio"
    >
      <StoreMapInner onAddressResolved={onAddressResolved} />
    </APIProvider>
  );
};
