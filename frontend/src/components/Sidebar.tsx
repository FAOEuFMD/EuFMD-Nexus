import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faFileCsv,
  faFlask,
  faTowerBroadcast,
  faArchway,
  faTriangleExclamation,
  faGraduationCap,
  faChalkboardUser,
  faFileLines,
  faChartLine,
  faSyringe,
  faMapLocationDot
} from '@fortawesome/free-solid-svg-icons';
import { useAuthStore } from '../stores/authStore';
import { isSeenRispUser } from '../utils/seenUser';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const [showRispDropdown, setShowRispDropdown] = useState(false);
  const userRole = user?.role?.toLowerCase();
  // Admins and SEEN risp users get SOI + FAST Report branching
  const showRispBranching = isSeenRispUser(user);
  
  // Check if user is admin (role === "admin" like in Vue app)
  const isAdmin = userRole === 'admin';
  // Check if user is RISP user (role === "risp" like in Vue app)
  const isRispUser = userRole === 'risp';
  // Check if user is Thrace user (role === "thrace" like in Vue app)
  const isThraceUser = userRole === 'thrace';
  // Check if user is TFP user
  const isTfpUser = userRole === 'tfp';

  return (
    <div
      id="sidebar"
      className={`fixed z-40 left-0 bg-[#15736d] text-white overflow-auto ${
        isOpen ? 'w-64' : 'w-0'
      }`}
      style={{ top: 'calc(3.5rem + 4rem)', height: 'calc(100vh - 3.5rem - 4rem)' }}
    >
      <div>
        <div className="px-2 py-3 mt-2">
          <p className="top-1 right-3 absolute cursor-pointer" onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </p>
        </div>
        
        <div className={`flex flex-col ${isAdmin ? 'justify-center' : 'justify-start'} p-5 ${isAdmin ? 'mt-20' : 'mt-0'} font-martaBold ${isOpen ? '' : 'hidden'}`}>
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



          {/* Second separator - only show if there are admin items */}
          {isAdmin && <hr className="my-3 hr-text gradient" data-content="" />}
          
          {/* RISP section - moved up above Tools and Resources */}
          {(isAdmin || isRispUser) && (
            <div>
              <div className="relative">
                {showRispBranching ? (
                  <>
                    <button
                      className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline w-full text-left"
                      onClick={() => setShowRispDropdown(!showRispDropdown)}
                    >
                      <FontAwesomeIcon icon={faTowerBroadcast} className="text-xl" />
                      <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8">
                        RISP
                      </span>
                      <div className="flex flex-col items-start flex-1">
                        <span>RISP</span>
                      </div>
                      <svg className={`w-4 h-4 transition-transform ${showRispDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showRispDropdown && (
                      <div className="ml-8 mt-1 space-y-1 border-l-2 border-white/30 pl-3">
                        {/* SOI */}
                        <Link
                          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-white/20 transition-colors"
                          to="/risp/soi"
                          onClick={onClose}
                        >
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>SOI</span>
                        </Link>
                        
                        {/* FAST Report */}
                        <Link
                          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-white/20 transition-colors"
                          to="/risp"
                          onClick={onClose}
                        >
                          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                          <span>FAST Report</span>
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <Link
                    className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                    to="/risp"
                    onClick={onClose}
                  >
                    <FontAwesomeIcon icon={faTowerBroadcast} className="text-xl" />
                    <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8">
                      RISP
                    </span>
                    <div className="flex flex-col items-start">
                      <span>RISP</span>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {(isAdmin || isTfpUser) && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/training-credits"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faChalkboardUser} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8">
                  Training Credits
                </span>
                <div className="flex flex-col items-start">
                  <span>Training Credits</span>
                </div>
              </Link>
            </div>
          )}
          
          {/* Thrace section */}
          {(isAdmin || isThraceUser) && (
            <div>
              <Link
                className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
                to="/thrace"
                onClick={onClose}
              >
                <FontAwesomeIcon icon={faFlask} className="text-xl" />
                <span className="tooltip rounded shadow-lg p-1 bg-black text-white mt-8">
                  Thrace
                </span>
                <div className="flex flex-col items-start">
                  <span>Thrace</span>
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
              <FontAwesomeIcon icon={faArchway} className="text-xl" />
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
              <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl" />
              <span className="tooltip rounded shadow-lg p-1 bg-black text-white -mt-8 text-center">
                Emergency Toolbox
              </span>
              Emergency Toolbox
            </Link>
          </div>

          <div>
            <a
              href="https://eufmd-tom.com:9443"
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3 items-center px-1 py-2 bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              onClick={onClose}
            >
              <FontAwesomeIcon icon={faGraduationCap} className="text-xl mr-0" />
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
              <FontAwesomeIcon icon={faChalkboardUser} className="text-xl" />
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
              <FontAwesomeIcon icon={faFileLines} className="text-xl" />
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
              <FontAwesomeIcon icon={faChartLine} className="text-xl" />
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
              <FontAwesomeIcon icon={faSyringe} className="text-xl" />
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
              <FontAwesomeIcon icon={faMapLocationDot} className="text-xl" />
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
