import React, { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import FeedbackButton from './Feedback/FeedbackButton';

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
    <div className="min-h-screen bg-gray-50 scrollbar scrollbar-thumb-gray-500 scrollbar-track-gray-200 scrollbar-thin flex flex-col">
      <Navbar onToggleSidebar={handleToggleSidebar} />
      
      {/* Menu bar with hamburger icon and MENU text */}
      <div className="bg-[#15736d] border-b border-[#0f4a46] py-3 px-6 flex items-center gap-3">
        <button 
          onClick={handleToggleSidebar}
          className="cursor-pointer text-white hover:text-[#F2F2F2] transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-white font-semibold text-lg">MENU</span>
      </div>
      
      {/* Sidebar component is always rendered */}
      <Sidebar isOpen={sidebarOpen} onClose={handleCloseSidebar} />
      
      {/* Main content area */}
      <div className={`transition-all duration-300 flex-grow ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        {/* Show breadcrumb if not on login page or home page */}
        {location.pathname !== '/login' && location.pathname !== '/' && (
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
      
      {/* Footer */}
      <footer className="bg-[#F7F8F9] text-[#545454] py-6 border-t border-gray-300 mt-auto">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center mb-4">
            <div className="mb-4 md:mb-0">
              <p className="text-sm">&copy; {new Date().getFullYear()} FAO EuFMD - European Commission for the Control of Foot-and-Mouth Disease</p>
              <p className="text-xs text-[#999999] mt-1">Food and Agriculture Organization of the United Nations</p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center md:justify-end">
              <a href="https://www.fao.org" target="_blank" rel="noopener noreferrer" className="text-[#5792c9] hover:text-[#1C4767] text-sm">
                FAO Website
              </a>
              <a href="https://www.fao.org/eufmd" target="_blank" rel="noopener noreferrer" className="text-[#5792c9] hover:text-[#1C4767] text-sm">
                EuFMD Website
              </a>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 justify-center text-xs">
            <a href="https://www.fao.org/contact-us/terms/en/" target="_blank" rel="noopener noreferrer" className="text-[#5792c9] hover:text-[#1C4767]">
              Terms and Conditions
            </a>
            <span className="text-[#999999]">|</span>
            <a href="https://fao.org/contact-us/data-protection-and-privacy/en/" target="_blank" rel="noopener noreferrer" className="text-[#5792c9] hover:text-[#1C4767]">
              Data Protection and Privacy
            </a>
            <span className="text-[#999999]">|</span>
            <a href="https://www.fao.org/contact-us/scam-alert/en/" target="_blank" rel="noopener noreferrer" className="text-[#5792c9] hover:text-[#1C4767]">
              Scam Alert
            </a>
          </div>
        </div>
      </footer>
      
      {/* Feedback Button - Fixed position, available on all pages */}
      <FeedbackButton />
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
