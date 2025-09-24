import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, loading, user } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both email and password');
      return;
    }

    try {
      await login(email, password);
      // Redirect will happen in useEffect when user is set
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  useEffect(() => {
    if (user && user.role) {
      if (user.role === 'rmt') {
        navigate('/rmt');
      } else {
        navigate('/');
      }
    }
  }, [user, navigate]);

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="pt-20 mb-48">
      <div className="p-8 max-w-sm border rounded mx-auto mt-10 bg-greens">
        <div className="w-3/4 my-2 mx-auto">
          <form onSubmit={handleSubmit}>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full block border rounded px-4 py-2 mb-2"
              required
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full block border rounded px-4 py-2 mb-2"
                required
              />
              <div className="" onClick={togglePasswordVisibility}>
                <FontAwesomeIcon
                  icon={showPassword ? faEyeSlash : faEye}
                  className="text-md cursor-pointer text-green-greenMain absolute top-3 right-2"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-greens hover:btn-greens/50 text-white font-semibold py-2 rounded mb-2"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
        
        {error && (
          <p className="text-center text-red-600 text-xs mt-2">{error}</p>
        )}
      </div>
    </div>
  );
};

export default Login;
