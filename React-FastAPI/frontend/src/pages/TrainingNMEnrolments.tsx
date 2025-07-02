import React from 'react';

const TrainingNMEnrolments: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-green-primary mb-6">Training Data - Enrolments</h1>
      <p className="text-red-600 mb-4">
        <strong>Admin Only:</strong> This page is restricted to administrators.
      </p>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p>Training enrolments management will be implemented here.</p>
      </div>
    </div>
  );
};

export default TrainingNMEnrolments;
