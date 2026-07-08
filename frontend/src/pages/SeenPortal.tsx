import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const SeenPortal: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="container mx-auto px-4 py-6">
      <section className="mb-8">
        <p className="font-black capitalize text-2xl mb-4 font-martaBold">
          Risk Information Sharing Platform
        </p>
        <h3 className="text-gray-600 max-w-3xl" style={{ lineHeight: '2rem' }}>
          Welcome{user?.country ? `, ${user.country}` : ''}. Choose the report you want to
          submit or review.
        </h3>
      </section>

      <div className="grid md:grid-cols-2 gap-6 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-2">SOI</h2>
          <p className="text-gray-600 mb-6 flex-1">
            Statement of Intentions database — report and share information on
            outbreaks, vaccination, and market prices.
          </p>
          <Link to="/risp/soi" className="nav-btn inline-block text-center w-fit">
            Open SOI
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-100 flex flex-col">
          <h2 className="text-xl font-bold text-gray-800 mb-2">FAST Report</h2>
          <p className="text-gray-600 mb-6 flex-1">
            Regional dashboard — visualize and share outbreak, surveillance, and
            vaccination information.
          </p>
          <Link to="/risp" className="nav-btn inline-block text-center w-fit">
            Open FAST Report
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SeenPortal;
