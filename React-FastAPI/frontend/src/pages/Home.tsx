import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// SearchBox Component (inline for simplicity, matching Vue structure)
const SearchBox: React.FC = () => {
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const searchableContent = [
    { title: 'Home', path: '/', type: 'page', description: 'Main page of EuFMD Hub' },
    { title: 'Get Prepared', path: '/get-prepared-wall', type: 'page', description: 'Prepare for animal disease outbreaks' },
    { title: 'Emergency Tools', path: '/emergency-toolbox', type: 'page', description: 'Tools for emergency response' },
    { title: 'Fast Report', path: '/fast-report', type: 'page', description: 'Report disease outbreaks' },
    { title: 'Risk Monitoring Tool', path: '/RMT', type: 'tool', description: 'Monitor disease risks' },
    { title: 'PCP-FMD Map', path: '/PCP-fmd-map', type: 'tool', description: 'FMD Progressive Control Pathway Map' },
    { title: 'VADEMOS', path: '/Vademos', type: 'tool', description: 'Vaccine Demand Estimation Model' },
  ];

  const filteredResults = query ? searchableContent.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.description.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8) : [];

  return (
    <div className="relative w-full max-w-md mx-auto">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setShowResults(!!e.target.value);
        }}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        placeholder="Search tools, pages, or resources..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-greenMain focus:border-green-greenMain"
      />
      
      {showResults && filteredResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
          {filteredResults.map((result, index) => (
            <Link
              key={index}
              to={result.path}
              className="block px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              onClick={() => setShowResults(false)}
            >
              <div className="font-medium text-gray-900">{result.title}</div>
              <div className="text-sm text-gray-600">{result.description}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const Home: React.FC = () => {
  return (
    <div className="py-5 text-gray-800">
      {/* Header */}
      <h1 className="text-center mb-8 text-2xl font-bold">
        Welcome to EuFMD Hub all in one Tools and Resources
      </h1>
      
      {/* Search Box */}
      <div className="mb-8">
        <SearchBox />
      </div>

      {/* 4 sections */}
      <div className="grid md:grid-cols-2 sm:grid-cols-1 gap-4 p-5">
        {/* GET PREPARED */}
        <div className="flex p-5 m-5 bg-gray-300 rounded-lg">
          <img
            src="/prepared.png"
            className="w-20 h-auto m-7"
            alt="Get Prepared Icon"
          />
          <span className="block">
            <h2 className="text-left mt-2 text-xl font-bold">Get Prepared</h2>
            <p className="text-left">Access tools and guides to prepare for disease outbreaks.</p>
            <button className="float-left bg-white hover:bg-gray-100 text-green-greenMain font-semibold py-2 px-4 border border-green-greenMain rounded-lg shadow mt-4">
              <Link to="/getprepared">Learn More</Link>
            </button>
          </span>
        </div>

        {/* Training */}
        <div className="flex p-5 m-5 bg-gray-300 rounded-lg">
          <img
            src="/training.png"
            className="w-20 h-auto m-7"
            alt="Training Icon"
          />
          <span className="block">
            <h2 className="text-left mt-2 text-xl font-bold">Training</h2>
            <p className="text-left">Enhance your skills with our latest training programs.</p>
            <button className="float-left bg-white hover:bg-gray-100 text-green-greenMain font-semibold py-2 px-4 border border-green-greenMain rounded-lg shadow mt-4">
              <Link to="/training">Learn More</Link>
            </button>
          </span>
        </div>

        {/* Monitoring */}
        <div className="flex p-5 m-5 bg-gray-300 rounded-lg">
          <img
            src="/monitoring.png"
            className="w-20 h-auto m-7"
            alt="Monitoring Icon"
          />
          <span className="block">
            <h2 className="text-left mt-2 text-xl font-bold">Monitoring</h2>
            <p className="text-left">Stay updated with real-time monitoring of disease spread.</p>
            <button className="float-left bg-white hover:bg-gray-100 text-green-greenMain font-semibold py-2 px-4 border border-green-greenMain rounded-lg shadow mt-4">
              <Link to="/RMT">Learn More</Link>
            </button>
          </span>
        </div>

        {/* Emergency response */}
        <div className="flex p-5 m-5 bg-gray-300 rounded-lg">
          <img
            src="/emergency.png"
            className="w-20 h-auto m-7"
            alt="Emergency response Icon"
          />
          <span className="block">
            <h2 className="text-left mt-2 text-xl font-bold">Emergency Response</h2>
            <p className="text-left">Coordinate quick and effective emergency responses.</p>
            <button className="float-left bg-white hover:bg-gray-100 text-green-greenMain font-semibold py-2 px-4 border border-green-greenMain rounded-lg shadow mt-4">
              <Link to="/emergency-response">Learn More</Link>
            </button>
          </span>
        </div>
      </div>
    </div>
  );
};

export default Home;
