import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useRispProgram } from '../../hooks/useRispProgram';

const RispNavBar: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isSoi } = useRispProgram();
  const overviewPath = isSoi ? '/risp/soi' : '/risp';

  const isActive = (path: string) => currentPath === path;

  const linkClass = (path: string) =>
    `px-4 py-2 mr-2 mb-2 rounded-lg ${
      isActive(path) ? 'bg-green-greenMain text-white' : 'bg-gray-100 hover:bg-gray-200'
    }`;

  return (
    <div className="bg-white shadow rounded-lg mb-6">
      <div className="flex flex-wrap justify-start px-4 py-2">
        <Link to="/risp/outbreak" className={linkClass('/risp/outbreak')}>
          Outbreak Entry
        </Link>
        <Link to="/risp/vaccination" className={linkClass('/risp/vaccination')}>
          Vaccination
        </Link>
        <Link to="/risp/surveillance" className={linkClass('/risp/surveillance')}>
          Surveillance
        </Link>
        <Link to="/risp/market-price" className={linkClass('/risp/market-price')}>
          Market Price
        </Link>
        <Link to="/risp/summary" className={linkClass('/risp/summary')}>
          Summary
        </Link>
        <Link to={overviewPath} className={linkClass(overviewPath)}>
          {isSoi ? 'SOI Overview' : 'Regional Overview'}
        </Link>
      </div>
    </div>
  );
};

export default RispNavBar;
