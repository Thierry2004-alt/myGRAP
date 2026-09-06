import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { safeStorage } from '../services/storage';
import { api, User } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: 'PASSENGER' | 'DRIVER' | 'ADMIN';
  token: string | null;
  isLoading: boolean;
  login: (u: string, p: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  requestEmailVerification: () => Promise<void>;
  verifyEmail: (code: string) => Promise<void>;
  updateProfile: (data: { first_name: string; last_name: string; email: string; phone_number: string }) => Promise<void>;
  switchRoleDemo: (newRole: 'PASSENGER' | 'DRIVER' | 'ADMIN') => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'PASSENGER' | 'DRIVER' | 'ADMIN'>('PASSENGER');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredSession();
  }, []);

  const loadStoredSession = async () => {
    try {
      await api.initToken();
      const storedToken = await safeStorage.getItem('grap_access_token');
      if (storedToken) {
        setToken(storedToken);
        const me = await api.getMe();
        setUser(me.user);
        setRole(me.user.role);
      }
    } catch (e) {
      console.log('No active session or token expired');
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (u: string, p: string) => {
    const res = await api.login(u, p);
    setToken(res.access);
    setUser(res.user);
    setRole(res.user.role);
  };

  const register = async (data: any) => {
    await api.register(data);
    await login(data.username, data.password);
  };

  const logout = async () => {
    api.setToken(null);
    setToken(null);
    setUser(null);
    setRole('PASSENGER');
    await safeStorage.removeItem('grap_access_token');
  };

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me.user);
    setRole(me.user.role);
  }, []);

  const requestEmailVerification = async () => {
    await api.requestEmailVerification();
  };

  const verifyEmail = async (code: string) => {
    const result = await api.verifyEmail(code);
    setUser(result.user);
  };

  const updateProfile = async (data: { first_name: string; last_name: string; email: string; phone_number: string }) => {
    const updatedUser = await api.updateMe(data);
    setUser(updatedUser);
  };


  const switchRoleDemo = (newRole: 'PASSENGER' | 'DRIVER' | 'ADMIN') => {
    setRole(newRole);
    if (user) {
      setUser({ ...user, role: newRole });
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, token, isLoading, login, register, logout, refreshUser, requestEmailVerification, verifyEmail, updateProfile, switchRoleDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
