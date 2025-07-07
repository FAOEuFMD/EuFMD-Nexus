import { apiService } from './api';
import { User, LoginCredentials } from '../types';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  user_role?: string;
  country?: string;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await apiService.auth.login(credentials.email, credentials.password);
      const data = response.data;
      
      // Store token and auth status
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('auth', 'true');
      
      // Store user data
      const userData = {
        id: data.user_id,
        role: data.user_role,
        country: data.country
      };
      localStorage.setItem('user', JSON.stringify(userData));
      
      return data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  }

  async logout(): Promise<void> {
    try {
      await apiService.auth.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('auth');
      localStorage.removeItem('user');
    }
  }

  async getProfile(): Promise<User> {
    try {
      const response = await apiService.auth.getProfile();
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to get profile');
    }
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    const auth = localStorage.getItem('auth');
    return !!(token && auth === 'true');
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  async refreshToken(): Promise<void> {
    // Implementation depends on your refresh token strategy
    // For now, redirect to login if token is invalid
    if (!this.isAuthenticated()) {
      window.location.href = '/login';
    }
  }
}

export const authService = new AuthService();
export default authService;
