'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/api/client';
import type { User, AuthResponse } from '@/types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        fetchUser();
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
    } catch (err: unknown) {
      // Only an explicit 401 means the session is gone. A 500 or network
      // error (e.g. a brief database outage) must not sign everyone out.
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem('token');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = useCallback(async (email: string, password: string, options?: { slug?: string; adminLogin?: boolean }) => {
    setError(null);
    try {
      const response: AuthResponse = await api.login(email, password, options);
      if (typeof window !== 'undefined') {
        localStorage.setItem('token', response.token);
      }
      setUser(response.user);
      return response.user;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      const message = error.response?.data?.error || 'Login failed';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (userData: { email: string; password: string; firstName: string; lastName: string }) => {
    setError(null);
    try {
      const response = await api.register(userData);
      return response;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      const message = error.response?.data?.error || 'Registration failed';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    setUser(null);
  }, []);

  const isAuthenticated = !!user;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN' || user?.role === 'LOCATION_ADMIN';
  const isStaff = isAdmin || user?.role === 'SERVICE_STAFF' || user?.role === 'RECEPTIONIST';

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated,
    isSuperAdmin,
    isAdmin,
    isStaff,
  };
};

export default useAuth;
