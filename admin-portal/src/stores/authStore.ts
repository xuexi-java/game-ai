import { create } from 'zustand';
import type { User } from '../types';
import { getCurrentUser, clearUserInfo, requestLogout } from '../services/auth.service';
import { websocketService } from '../services/websocket.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isAuthReady: false,
  
  setUser: (user) => set({ 
    user, 
    isAuthenticated: !!user,
    isAuthReady: true,
  }),
  
  logout: () => {
    requestLogout().finally(() => {
      websocketService.disconnect();
      clearUserInfo();
      set({ 
        user: null, 
        isAuthenticated: false,
        isAuthReady: true,
      });
    });
  },
  
  initAuth: () => {
    const user = getCurrentUser();
    const token = localStorage.getItem('admin_token');
    
    if (user && token) {
      set({ 
        user, 
        isAuthenticated: true,
        isAuthReady: true,
      });
      websocketService.connect(token);
    } else {
      set({ 
        user: null, 
        isAuthenticated: false,
        isAuthReady: true,
      });
    }
  },
}));
