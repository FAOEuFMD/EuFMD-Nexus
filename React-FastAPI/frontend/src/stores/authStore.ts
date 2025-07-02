import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User, AuthState } from '../types';
import { authService, LoginResponse } from '../services';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        user: authService.getCurrentUser(),
        token: authService.getToken(),
        isAuthenticated: authService.isAuthenticated(),
        loading: false,

        login: async (email: string, password: string) => {
          set({ loading: true });
          try {
            const response: LoginResponse = await authService.login({ email, password });
            
            const user: User = {
              id: response.user_id,
              email: email,
              name: email, // Will be updated when we get profile
              role: response.user_role || '',
              country: response.country,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            
            set({
              user,
              token: response.access_token,
              isAuthenticated: true,
              loading: false,
            });

            // Get full profile data
            await get().getProfile();
          } catch (error) {
            set({ 
              loading: false,
              user: null,
              token: null,
              isAuthenticated: false
            });
            throw error;
          }
        },

        logout: async () => {
          set({ loading: true });
          try {
            await authService.logout();
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              loading: false,
            });
          } catch (error) {
            console.error('Logout error:', error);
            // Always clear state even if API call fails
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              loading: false,
            });
          }
        },

        getProfile: async () => {
          if (!get().isAuthenticated) return;
          
          set({ loading: true });
          try {
            const user = await authService.getProfile();
            set({ user, loading: false });
          } catch (error: any) {
            set({ loading: false });
            
            // If profile fetch fails due to invalid token, logout
            if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
              get().logout();
            }
            throw error;
          }
        },

        setUser: (user: User | null) => {
          set({ user, isAuthenticated: !!user });
        },

        setToken: (token: string | null) => {
          set({ token, isAuthenticated: !!token });
        },

        setLoading: (loading: boolean) => {
          set({ loading });
        },

        clearError: () => {
          // Clear any error state if needed
        },

        checkAuth: () => {
          const isAuthenticated = authService.isAuthenticated();
          const user = authService.getCurrentUser();
          const token = authService.getToken();
          
          set({
            isAuthenticated,
            user,
            token
          });
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    ),
    {
      name: 'auth-store',
    }
  )
);
