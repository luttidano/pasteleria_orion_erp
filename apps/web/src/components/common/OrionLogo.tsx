import React from 'react';

interface OrionLogoProps {
  collapsed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const OrionLogo: React.FC<OrionLogoProps> = ({
  collapsed = false,
  className = '',
  size = 'md',
}) => {
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  }[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Luxury Pastry Seal / Emblem */}
      <div
        className={`${iconDimensions} relative rounded-2xl bg-gradient-to-br from-[#8C1F25] via-[#74191E] to-[#4A0D11] p-0.5 shadow-md flex items-center justify-center shrink-0 border border-[#D4A373]/50 ring-1 ring-black/10 group cursor-pointer transition-transform hover:scale-105`}
        title="Pastelería Orión"
      >
        {/* Subtle inner golden circle */}
        <div className="w-full h-full rounded-[14px] border border-[#F1DFC4]/30 flex items-center justify-center relative overflow-hidden bg-radial from-transparent to-black/25">
          {/* Subtle star / sparkle behind */}
          <span className="absolute top-0.5 right-1 text-[8px] text-[#F1DFC4]/70">✦</span>
          
          {/* Main Serif Monogram with Wheat/Star Flourish */}
          <span className="font-serif text-white font-bold text-lg md:text-xl tracking-tighter drop-shadow-sm flex items-center justify-center -mt-0.5">
            <span className="font-serif italic text-[#F7E5C8]">O</span>
          </span>

          {/* Golden mini-crown / wheat dot at bottom */}
          <div className="absolute bottom-1 w-1 h-1 rounded-full bg-[#E5B56A]"></div>
        </div>
      </div>

      {/* Brand Typography (visible when not collapsed) */}
      {!collapsed && (
        <div className="flex flex-col truncate">
          <span className="font-serif tracking-[0.26em] text-[10px] font-bold text-[#8C1F25] dark:text-[#E8A598] uppercase leading-none">
            Pastelería
          </span>
          <span className="font-serif text-xl font-black text-[#2A1B16] dark:text-[#FBF5ED] tracking-tight leading-tight mt-0.5">
            Orión
          </span>
        </div>
      )}
    </div>
  );
};
