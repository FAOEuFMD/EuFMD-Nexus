import React from 'react';

const PCP: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Progressive Control Pathway</h1>
        <button className="btn-primary">
          Update Country Status
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">PCP Stage Overview</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Stage 0</div>
                <div className="text-sm text-gray-600">Endemic without control</div>
              </div>
              <div className="text-lg font-bold text-red-600">12</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Stage 1</div>
                <div className="text-sm text-gray-600">Reducing risk and impact</div>
              </div>
              <div className="text-lg font-bold text-orange-600">8</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Stage 2</div>
                <div className="text-sm text-gray-600">Controlling clinical disease</div>
              </div>
              <div className="text-lg font-bold text-yellow-600">6</div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Stage 3</div>
                <div className="text-sm text-gray-600">Preventing clinical disease</div>
              </div>
              <div className="text-lg font-bold text-green-600">4</div>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Country Progress</h2>
          <p className="text-gray-600 mb-4">
            Track individual country progress through the PCP stages with detailed assessments and timelines.
          </p>
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-4">
              <div className="font-medium">Country Alpha</div>
              <div className="text-sm text-gray-600">Stage 2 → Stage 3 (In Progress)</div>
            </div>
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="font-medium">Country Beta</div>
              <div className="text-sm text-gray-600">Stage 1 → Stage 2 (Planning)</div>
            </div>
            <div className="border-l-4 border-orange-500 pl-4">
              <div className="font-medium">Country Gamma</div>
              <div className="text-sm text-gray-600">Stage 0 → Stage 1 (Assessment)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PCP;
