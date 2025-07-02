import React from 'react';

const TrainingData: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-primary mb-6">Training Data Management</h1>
      <p className="text-red-600 mb-4">
        <strong>Admin Only:</strong> This page is restricted to administrators.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a 
            href="/training-data/courses" 
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-green-primary">Non-Moodle Courses</h3>
            <p className="text-gray-600 text-sm">Manage training courses</p>
          </a>
          
          <a 
            href="/training-data/enrolments" 
            className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <h3 className="font-semibold text-green-primary">Enrolments</h3>
            <p className="text-gray-600 text-sm">Manage training enrolments</p>
          </a>
        </div>
      </div>
    </div>
  );
};

export default TrainingData;
