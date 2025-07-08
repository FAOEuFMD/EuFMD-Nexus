import React from 'react';

interface NexusIconProps {
  className?: string;
  size?: number;
}

const NexusIcon: React.FC<NexusIconProps> = ({ className = "", size = 24 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Central hub */}
      <circle 
        cx="12" 
        cy="12" 
        r="3" 
        fill="currentColor" 
        className="opacity-90"
      />
      
      {/* Outer connection points */}
      <circle cx="12" cy="4" r="2" fill="currentColor" className="opacity-70" />
      <circle cx="20" cy="8" r="2" fill="currentColor" className="opacity-70" />
      <circle cx="20" cy="16" r="2" fill="currentColor" className="opacity-70" />
      <circle cx="12" cy="20" r="2" fill="currentColor" className="opacity-70" />
      <circle cx="4" cy="16" r="2" fill="currentColor" className="opacity-70" />
      <circle cx="4" cy="8" r="2" fill="currentColor" className="opacity-70" />
      
      {/* Connection lines */}
      <line x1="12" y1="9" x2="12" y2="6" stroke="currentColor" strokeWidth="2" className="opacity-60" />
      <line x1="14.5" y1="10.5" x2="18" y2="8" stroke="currentColor" strokeWidth="2" className="opacity-60" />
      <line x1="14.5" y1="13.5" x2="18" y2="16" stroke="currentColor" strokeWidth="2" className="opacity-60" />
      <line x1="12" y1="15" x2="12" y2="18" stroke="currentColor" strokeWidth="2" className="opacity-60" />
      <line x1="9.5" y1="13.5" x2="6" y2="16" stroke="currentColor" strokeWidth="2" className="opacity-60" />
      <line x1="9.5" y1="10.5" x2="6" y2="8" stroke="currentColor" strokeWidth="2" className="opacity-60" />
      
      {/* Inner connection ring */}
      <circle 
        cx="12" 
        cy="12" 
        r="6" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1" 
        strokeDasharray="2 2" 
        className="opacity-30"
      />
      
      {/* Outer connection ring */}
      <circle 
        cx="12" 
        cy="12" 
        r="9" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1" 
        strokeDasharray="3 3" 
        className="opacity-20"
      />
    </svg>
  );
};

export default NexusIcon;
