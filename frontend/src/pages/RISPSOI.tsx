import React from 'react';
import { Link } from 'react-router-dom';

const RISPSOI: React.FC = () => {
  return (
    <div className="container mx-auto px-4">
      {/* Header Section */}
      <section className="mb-6">
        <p className="font-black capitalize text-2xl mb-6 font-martaBold">
          Statement of Intentions (SOI) Database
        </p>
        <div className="w-full">
          <h3 className="text-gray-600 welcome-text-full mb-6" style={{ lineHeight: '2.5rem', width: '100%' }}>
            Welcome to the SOI Database. This platform allows you to report and share
            information as specified on the Statement of Intentions Agreement. Your input is crucial
            to help monitor and manage health risks effectively. Please share information about
            outbreaks, vaccination and market prices.
          </h3>
        </div>
      </section>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Templates */}
        <div className="bg-white rounded-lg shadow p-8 hover:shadow-lg transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Templates</h3>
            <p className="text-gray-600 mb-4">Download reporting templates for outbreaks, vaccination, and market prices.</p>
            <a
              href="/RISP_Template.xlsx"
              download
              className="inline-block bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Download Template
            </a>
          </div>
        </div>

        {/* Uploads */}
        <div className="bg-white rounded-lg shadow p-8 hover:shadow-lg transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Uploads</h3>
            <p className="text-gray-600 mb-4">Upload completed SOI reports to share data with the network.</p>
            <Link
              to="/risp/outbreak"
              className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Upload Report
            </Link>
          </div>
        </div>

        {/* Data */}
        <div className="bg-white rounded-lg shadow p-8 hover:shadow-lg transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Data</h3>
            <p className="text-gray-600 mb-4">View and analyze submitted SOI data across countries and time periods.</p>
            <Link
              to="/fast-report"
              className="inline-block bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              View Data
            </Link>
          </div>
        </div>

        {/* Visualizations */}
        <div className="bg-white rounded-lg shadow p-8 hover:shadow-lg transition-shadow">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Visualizations</h3>
            <p className="text-gray-600 mb-4">Interactive charts and maps to explore SOI data visually.</p>
            <Link
              to="/risp"
              className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Explore
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RISPSOI;