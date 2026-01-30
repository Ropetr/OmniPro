import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, tenantName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('omnipro_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser({ id: data.id, name: data.name, email: data.email, role: data.role, avatar: data.avatar });
      setTenant(data.tenant);
      connectSocket(token);
    } catch {
      localStorage.removeItem('omnipro_token');
      localStorage.removeItem('omnipro_refresh_token');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('omnipro_token', data.accessToken);
    localStorage.setItem('omnipro_refresh_token', data.refreshToken);
    setUser(data.user);
    setTenant(data.tenant);
    connectSocket(data.accessToken);
  };

  const register = async (name: string, email: string, password: string, tenantName: string) => {
    const { data } = await api.post('/auth/register', { name, email, password, tenantName });
    localStorage.setItem('omnipro_token', data.accessToken);
    localStorage.setItem('omnipro_refresh_token', data.refreshToken);
    setUser(data.user);
    setTenant(data.tenant);
    connectSocket(data.accessToken);
  };

  const logout = () => {
    localStorage.removeItem('omnipro_token');
    localStorage.removeItem('omnipro_refresh_token');
    setUser(null);
    setTenant(null);
    disconnectSocket();
  };

  return (
    <AuthContext.Provider value={{
      user, tenant, isAuthenticated: !!user, isLoading,
      login, register, logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
