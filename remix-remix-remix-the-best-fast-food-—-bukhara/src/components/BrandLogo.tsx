import React from 'react';

interface BrandLogoProps {
  variant?: 'light' | 'dark';
  showSubtitle?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'light',
  showSubtitle = false,
  size = 'md',
}) => {
  const isLight = variant === 'light';
  const mainInk = isLight ? '#111111' : '#FFFFFF';
  const subInk = isLight ? '#525252' : '#D4D4D4';
  const goldInk = '#F2B01E';
  const hatStroke = '#E5A210';
  const chefSize = size === 'sm' ? 28 : size === 'lg' ? 38 : 32;

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 select-none">
      {/* Golden Chef Hat Emblem inspired by THE BEST signature mark */}
      <svg
        width={chefSize}
        height={chefSize}
        viewBox="0 0 48 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 -rotate-6"
      >
        <path
          d="M12 28C7.5 26.5 5 22.5 5.5 17.8C6 13.4 9.7 10.2 14.2 10.5C16.2 6.8 20.1 4.5 24.4 4.8C28.8 5.1 32.3 7.8 33.8 11.4C38.4 11.2 42.3 14.6 42.5 19.2C42.7 23.6 39.7 27.3 35.4 28.4L34 34.5H13.6L12 28Z"
          stroke={hatStroke}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 34.5H32.5"
          stroke={hatStroke}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M19 20.5C19 22.5 19.6 25.2 20.2 27.5M24 19.5C24 22.2 24 25 24 27.5M29 20.5C29 22.5 28.4 25.2 27.8 27.5"
          stroke={hatStroke}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>

      <span className="flex flex-col leading-none">
        <span className="relative inline-flex flex-col items-start">
          <span
            className={`font-display font-extrabold italic tracking-[-0.03em] uppercase leading-none ${
              size === 'sm' ? 'text-[19px]' : size === 'lg' ? 'text-2xl sm:text-[28px]' : 'text-[22px]'
            }`}
            style={{ color: mainInk }}
          >
            THE <span style={{ color: goldInk }}>BEST</span>
          </span>
          <svg
            viewBox="0 0 120 8"
            fill="none"
            aria-hidden="true"
            className="w-full h-1.5 mt-0.5"
          >
            <path
              d="M2 6C36 2 82 1.8 118 4.5"
              stroke={hatStroke}
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        {showSubtitle && (
          <span
            className="text-[9px] font-medium tracking-[0.16em] mt-1 uppercase"
            style={{ color: subInk }}
          >
            FAST FOOD — BUKHARA
          </span>
        )}
      </span>
    </span>
  );
};
