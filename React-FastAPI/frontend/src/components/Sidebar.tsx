import React from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faFileCsv, faTools } from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../stores/authStore';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  
  // Check if user is admin (role === "admin" like in Vue app)
  const isAdmin = user?.role === 'admin';
  // Check if user is RISP user (role === "risp" like in Vue app)
  const isRispUser = user?.role === 'risp';

  return (
    <div
      id="sidebar"
      className={`fixed h-full z-50 top-0 left-0 bg-greens text-green-100 overflow-auto ${
        isOpen ? 'w-64' : 'w-0'
      }`}
    >
      <div>
        <div className="px-2 py-3 mt-2">
          <p className="top-1 right-3 absolute cursor-pointer" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </p>
        </div>
        
        <div className={`flex flex-col justify-center p-5 mt-20 font-martaBold ${isOpen ? '' : 'hidden'}`}>
          <hr className="my-3 hr-text gradient" data-content="" />

          {/* Admin-only sections */}
          {isAdmin && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/diagnostic-support"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faFileCsv} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                  Diagnostic Support
                </span>
                Diagnostic Support
              </Link>
            </div>
          )}

          {isAdmin && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/PCP_fmd"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faFileCsv} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8 text-center">
                  PCP FMD
                </span>
                PCP FMD
              </Link>
            </div>
          )}

          {isAdmin && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/RMTData"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faFileCsv} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8 text-center">
                  RMTData
                </span>
                RMT Data
              </Link>
            </div>
          )}

          {isAdmin && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/training-data"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faFileCsv} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-left">
                  Training Impact
                </span>
                Training Data
              </Link>
            </div>
          )}

          <hr className="my-3 hr-text gradient" data-content="" />
          
          {/* RISP section - moved up above Tools and Resources */}
          {(isAdmin || isRispUser) && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/risp"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faTools} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8">
                  RISP
                </span>
                <div className="flex flex-col items-start">
                  <span>RISP</span>
                </div>
              </Link>
            </div>
          )}
          
          <hr className="my-3 hr-text gradient" data-content="" />
          <h1 className="border-white border-2 p-2 rounded">Tools and Resources</h1>
          
          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/get-prepared-wall"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                Get Prepared Wall
              </span>
              Get Prepared Wall
            </Link>
          </div>

          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/emergency-toolbox"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                Emergency Toolbox
              </span>
              Emergency Toolbox
            </Link>
          </div>

          <div>
            <a
              href="https://eufmd-tom.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl mr-0" />
              <span className="tooltip rounded shadow-lg p-5 bg-black text-white -mt-8 text-center">
                TOM
              </span>
              TOM
            </a>
          </div>

          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/view-past-training-impact"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg bg-black text-white text-center">
                Training HP_Training_impact
              </span>
              Training Impact
            </Link>
          </div>

          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/fast-report"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                Fast Report
              </span>
              Fast Report
            </Link>
          </div>

          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/RMT"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                RMT
              </span>
              RMT
            </Link>
          </div>

          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/Vademos"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                VADEMOS
              </span>
              VADEMOS
            </Link>
          </div>

          <div>
            <Link
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/PCP-fmd-map"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faTools} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8 text-center">
                FMD-PCP Map
              </span>
              FMD-PCP Map
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
