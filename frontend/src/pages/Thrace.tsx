import React, { useState } from 'react';
import ThraceDataEntry from './ThraceDataEntry';

const Thrace: React.FC = () => {
  const [showDataEntry, setShowDataEntry] = useState(false);

  return (
    <div className="container mx-auto px-4">
      {/* Header Section */}
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          THRACE
        </p>
        <div className="w-full">
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <p className="text-gray-700 mb-4">
              <strong>THRACE:</strong> An international Transboundary High Risk Area Coordinated Epidemio-surveillance supported by EuFMD.
            </p>
            <p className="text-gray-700 mb-4">
              The THRACE project involves Turkey, Bulgaria and Greece who share common borders in the Thrace area.
            </p>
            <p className="text-gray-700">
              This database has been developed to facilitate the regular submission and management of surveillance data generated under the THRACE program from the three countries.
            </p>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end space-x-2">
          <button 
            className="nav-btn"
            onClick={() => setShowDataEntry(!showDataEntry)}
          >
            {showDataEntry ? 'Hide Data Entry' : 'Data Entry'}
          </button>
        </div>
      </section>

      {/* Data Entry Section - Shows when button is clicked */}
      {showDataEntry && (
        <section className="mb-6">
          <ThraceDataEntry />
        </section>
      )}
    </div>
  );
};

export default Thrace;
