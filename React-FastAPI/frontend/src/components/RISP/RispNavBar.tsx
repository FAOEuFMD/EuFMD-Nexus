import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const RispNavBar: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    return currentPath === path;
  };

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="flex flex-wrap justify-start px-4 py-2">
        <Link 
          to="/risp/outbreak" 
          className={`px-4 py-2 mr-2 mb-2 rounded-lg ${isActive('/risp/outbreak') ? 
            'bg-green-greenMain text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          Outbreak Entry
        </Link>
        
        <Link 
          to="/risp/vaccination" 
          className={`px-4 py-2 mr-2 mb-2 rounded-lg ${isActive('/risp/vaccination') ? 
            'bg-green-greenMain text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          Vaccination
        </Link>
        
        <Link 
          to="/risp/surveillance" 
          className={`px-4 py-2 mr-2 mb-2 rounded-lg ${isActive('/risp/surveillance') ? 
            'bg-green-greenMain text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
        >
          Surveillance
        </Link>
      </div>
    </div>
  );
};

export default RispNavBar;
