import React from 'react';

const DiagnosticSupport: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Diagnostic Support</h1>
        <button className="btn-primary">
          Add Laboratory
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Laboratory Network</h2>
          <p className="text-gray-600 mb-4">
            Network of accredited laboratories providing diagnostic support for FMD detection and analysis.
          </p>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">National Veterinary Lab - Country A</div>
                <div className="text-sm text-gray-600">RT-PCR, ELISA, Virus Isolation</div>
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">Regional Reference Lab - Region B</div>
                <div className="text-sm text-gray-600">RT-PCR, Sequencing, Serology</div>
              </div>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Active</span>
            </div>
          </div>
        </div>
        
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Diagnostic Tests</h2>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <div className="font-medium">RT-PCR</div>
              <div className="text-sm text-gray-600">Real-time PCR for FMD virus detection</div>
              <div className="text-xs text-gray-500">Sensitivity: 95% | Specificity: 98%</div>
            </div>
            <div className="border-l-4 border-green-500 pl-4">
              <div className="font-medium">ELISA</div>
              <div className="text-sm text-gray-600">Enzyme-linked immunosorbent assay</div>
              <div className="text-xs text-gray-500">Sensitivity: 92% | Specificity: 96%</div>
            </div>
            <div className="border-l-4 border-purple-500 pl-4">
              <div className="font-medium">Virus Isolation</div>
              <div className="text-sm text-gray-600">Cell culture isolation</div>
              <div className="text-xs text-gray-500">Gold standard confirmation</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-eufmd-blue mb-2">85</div>
          <div className="text-sm text-gray-600">Accredited Labs</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-green-600">1,247</div>
          <div className="text-sm text-gray-600">Tests Completed</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">24h</div>
          <div className="text-sm text-gray-600">Avg. Turnaround</div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticSupport;
