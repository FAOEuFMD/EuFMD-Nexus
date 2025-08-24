import React, { useState } from 'react';

const Vademos: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  return (
    <div>
      <div
        style={{ width: '100%', height: '550px', overflow: 'hidden', position: 'relative' }}
      >
        {/* Loading Spinner */}
        {isLoading && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-white z-10"
            style={{ height: '550px' }}
          >
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-greenMain"></div>
              <p className="mt-4 text-gray-600 font-medium">Loading VADEMOS Application...</p>
            </div>
          </div>
        )}
        
        <iframe
          src="https://eufmd.shinyapps.io/VADEMOS/"
          style={{
            width: '100%',
            height: '900px',
            border: 'none',
            position: 'absolute',
            top: '-80px',
            left: '0',
          }}
          title="VADEMOS Application"
          onLoad={handleIframeLoad}
        ></iframe>
      </div>
    </div>
  );
};

export default Vademos;
