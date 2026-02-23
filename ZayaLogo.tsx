
import React from 'react';

interface ZayaLogoProps {
  className?: string;
  showText?: boolean;
}

const ZayaLogo: React.FC<ZayaLogoProps> = ({ className = "w-12 h-12", showText = false }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${showText ? 'gap-2' : ''}`}>
      <div className={`relative flex items-center justify-center rounded-full bg-white border-[3px] border-gold shadow-md overflow-hidden ${className}`}>
        {/* Double ring effect */}
        <div className="absolute inset-0 border-[1px] border-gold/40 rounded-full m-[2px]"></div>
        <span 
          className="text-gold font-serif font-bold relative z-10 select-none" 
          style={{ 
            fontSize: 'calc(100% * 0.65)',
            textShadow: '0.5px 0.5px 1px rgba(0,0,0,0.2)',
            transform: 'translateY(-2%)'
          }}
        >
          Z
        </span>
      </div>
      {showText && (
        <div className="text-center">
          <h2 className="text-[#003366] font-serif font-black tracking-tight text-xl leading-none">ZAYA</h2>
          <p className="text-[#003366] font-bold text-[6px] tracking-tighter mt-1 whitespace-nowrap">GROUP (SMC-PRIVATE) LIMITED</p>
          <div className="h-[1px] w-full bg-gold/50 my-0.5"></div>
          <p className="text-slate-500 font-medium text-[4px] leading-tight">Recruitment & Training • Travel & Tours<br/>Business Consultant</p>
        </div>
      )}
    </div>
  );
};

export default ZayaLogo;
