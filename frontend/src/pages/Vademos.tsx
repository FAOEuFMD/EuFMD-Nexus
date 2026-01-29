import React, { useEffect } from 'react';

const Vademos: React.FC = () => {
  useEffect(() => {
    // Redirect to VADEMOS in a new tab
    window.open('https://eufmd.shinyapps.io/VADEMOS/', '_blank');
    // Optionally go back to previous page
    window.history.back();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Redirecting to VADEMOS...</h2>
        <p className="text-gray-700 mb-4">
          The VADEMOS application is opening in a new tab. If it doesn't open automatically, 
          please click the link below:
        </p>
        <a 
          href="https://eufmd.shinyapps.io/VADEMOS/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          Open VADEMOS Application
        </a>
      </div>
    </div>
  );
};

export default Vademos;
