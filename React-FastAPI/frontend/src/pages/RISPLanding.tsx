import React from 'react';

const RISPLanding: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-primary mb-6">RISP - Risk Information Sharing Platform</h1>
      <p className="text-gray-600 mb-4">
        Risk Information Sharing Platform for authenticated users.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/risp/outbreak" 
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-green-primary">Outbreak Entry</h3>
            <p className="text-gray-600 text-sm">Report outbreak information</p>
          </a>
          
          <a 
            href="/risp/vaccination" 
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-green-primary">Vaccination</h3>
            <p className="text-gray-600 text-sm">Manage vaccination records</p>
          </a>
          
          <a 
            href="/risp/surveillance" 
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-green-primary">Surveillance</h3>
            <p className="text-gray-600 text-sm">Monitor surveillance activities</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default RISPLanding;
