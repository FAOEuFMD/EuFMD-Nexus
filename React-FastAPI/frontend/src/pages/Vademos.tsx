import React from 'react';

const Vademos: React.FC = () => {
  return (
    <div>
      <div
        style={{ width: '100%', height: '500px', overflow: 'hidden', position: 'relative' }}
      >
        <iframe
          src="https://eufmd.shinyapps.io/VADEMOS/"
          style={{
            width: '100%',
            height: '900px',
            border: 'none',
            position: 'absolute',
            top: '-100px',
            left: '0',
          }}
          title="VADEMOS Application"
        ></iframe>
      </div>
    </div>
  );
};

export default Vademos;
