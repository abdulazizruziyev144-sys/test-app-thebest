import React, { useEffect, useState } from 'react';
import { Utensils } from 'lucide-react';

interface FoodImageProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export const FoodImage: React.FC<FoodImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  priority = false,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (failed || !src) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-[#FAFAFA] text-neutral-500 p-4 text-center"
        role="img"
        aria-label={alt}
      >
        <Utensils className="w-7 h-7 mb-1.5 text-[#F2B01E]" />
        <span className="text-xs font-medium text-neutral-600 line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
