import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api, tokenManager } from '@/lib/api';

interface User {
  id: number;
  email: string;
  full_name?: string;
  phone_number?: string;
  role: 'customer' | 'vendor' | 'admin';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    full_name?: string;
    phone_number?: string;
    role?: 'customer' | 'vendor' | 'admin';
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Check for existing token on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = tokenManager.getToken();
      if (token) {
        try {
          const userData = await api.auth.getCurrentUser();
          setUser(userData);
        } catch (error) {
          // Token is invalid, clear it
          tokenManager.removeToken();
        }
      }
      setIsLoading(false);
    };

    initAuth();

    // Listen for logout events
    const handleLogout = () => {
      setUser(null);
    };

    window.addEventListener('auth:logout', handleLogout);
    return () => {
      window.removeEventListener('auth:logout', handleLogout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      await api.auth.login(email, password);
      const userData = await api.auth.getCurrentUser();
      setUser(userData);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const register = async (data: {
    email: string;
    password: string;
    full_name?: string;
    phone_number?: string;
    role?: 'customer' | 'vendor' | 'admin';
  }) => {
    try {
      await api.auth.register(data);
      // Auto-login after registration
      await login(data.email, data.password);
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const logout = () => {
    api.auth.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await api.auth.getCurrentUser();
      setUser(userData);
    } catch (error) {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

