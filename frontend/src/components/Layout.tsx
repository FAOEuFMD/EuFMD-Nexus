import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const handleToggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleCloseSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 scrollbar-thin content-wrap">
      <Navbar onToggleSidebar={handleToggleSidebar} />
      
      {/* Sidebar component is always rendered */}
      <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />
      
      {/* Main content area */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Show breadcrumb if not on login page */}
        {location.pathname !== '/login' && (
          <div className="w-screen bg-white py-3 text-green-primary font-marta">
            <div className="container mx-auto px-6">
              <p className="font-light">
                <span className="mr-1">
                  <Link to="/" className="font-black capitalize text-2xl m-3 font-martaBold hover:text-green-secondary hover:underline cursor-pointer">
                    Home
                  </Link>
                </span>
                {location.pathname !== '/' && (
                  <span className="font-black text-xl font-martaBold">
                    &gt;&gt;&gt; {getPageTitle(location.pathname)}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
        
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

// Helper function to get page title from pathname to match Vue router names exactly
const getPageTitle = (pathname: string): string => {
  // Normalize pathname by removing leading slash
  const normalizedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  
  const pathMap: { [key: string]: string } = {
    'RMT': 'Risk Monitoring Tool',
    'rmt': 'Risk Monitoring Tool',
    'rmt/risk-scores': 'RMT > Risk Scores',
    'rmt/results': 'RMT > Results',
    'PCP_fmd': 'PCP FMD',
    'PCP-fmd-map': 'FMD-PCP Map', 
    'training': 'Training',
    'diagnostic-support': 'DiagnosticSupport',
    'emergency-response': 'EmergencyResponse',
    'fast-report': 'Fast Report',
    'getprepared': 'GetPrepared',
    'monitoring': 'Monitoring',
    'risp': 'RISP',
    'risp/outbreak': 'RISP - Outbreak Entry',
    'risp/vaccination': 'RISP - Vaccination', 
    'risp/surveillance': 'RISP - Surveillance',
    'get-prepared-wall': 'GetPreparedWall',
    'emergency-toolbox': 'EmergencyToolbox',
    'Vademos': 'Vademos',
    'RMTData': 'RMTData',
    'rmt-data': 'RMTData',
    'view-past-training-impact': 'TrainingImpact',
  };
  
  return pathMap[normalizedPath] || normalizedPath.replace('-', ' ');
};

export default Layout;
