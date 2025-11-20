import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import NexusIcon from './NexusIcon';

interface NavbarProps {
  onToggleSidebar: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { isAuthenticated, user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="w-screen">
      <div className="text-white bg-green-greenMain flex justify-between items-center py-3 px-6 z-50">
        {/* Hamburger menu button - only show when logged in */}
        {user && (
          <button 
            onClick={onToggleSidebar}
            className="cursor-pointer text-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <div className="container flex justify-between items-center">
          {/* Home Logo */}
          <div>
            <Link to="/" className="flex items-center">
              <h3 className="text-2xl text-white font-semibold">EuFMD Nexus</h3>
              <NexusIcon className="ml-2 text-white" size={28} />
            </Link>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Link
            className="px-4 py-2 mt-2 text-md font-semibold md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900"
            to="/"
          >
            Home
          </Link>
          
          {/* Show Login button if not authenticated */}
          {!isAuthenticated ? (
            <Link
              className="bg-white px-4 py-2 mt-2 text-md whitespace-nowrap font-semibold text-green-greenMain rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              to="/login"
            >
              Log In
            </Link>
          ) : (
            /* Show user info and logout if authenticated */
            <button
              className="px-4 py-2 mt-2 text-sm font-semibold bg-transparent rounded-lg md:mt-0 md:ml-4 hover:text-gray-900 focus:text-gray-900 hover:bg-gray-200 focus:bg-gray-200 focus:outline-none focus:shadow-outline"
              onClick={handleLogout}
            >
              <div className="flex flex-row items-center">
                <p>{user?.email || 'User'}</p>
                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
