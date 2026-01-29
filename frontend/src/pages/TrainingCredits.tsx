import React, { useState } from 'react';

const TrainingCredits: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'calendar' | 'allocations' | 'previous'>('summary');

  return (
    <div className="container mx-auto px-4">
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          Training Credits
        </p>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <p className="text-gray-700">
            Manage training credit summaries, upcoming sessions, and allocations.
          </p>
        </div>

        <div className="flex justify-start space-x-2 mb-6">
          <button
            className={`nav-btn ${activeTab === 'summary' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Summary
          </button>
          <button
            className={`nav-btn ${activeTab === 'calendar' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            Calendar
          </button>
          <button
            className={`nav-btn ${activeTab === 'allocations' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('allocations')}
          >
            Training Allocations
          </button>
          <button
            className={`nav-btn ${activeTab === 'previous' ? 'bg-greens text-white' : ''}`}
            onClick={() => setActiveTab('previous')}
          >
            Previous Allocations
          </button>
        </div>
      </section>

      <section className="mb-6">
        {activeTab === 'summary' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Summary</h2>
            <p className="text-gray-700">Summary view coming soon.</p>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Calendar</h2>
            <p className="text-gray-700">Calendar view coming soon.</p>
          </div>
        )}

        {activeTab === 'allocations' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Training Allocations</h2>
            <p className="text-gray-700">Training allocations view coming soon.</p>
          </div>
        )}

        {activeTab === 'previous' && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Previous Allocations</h2>
            <p className="text-gray-700">Previous allocations view coming soon.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default TrainingCredits;
