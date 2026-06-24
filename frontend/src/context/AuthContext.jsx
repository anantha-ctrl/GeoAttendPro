import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on first load if a token exists.
  const refresh = useCallback(async () => {
    const token = localStorage.getItem('gap_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.data.user);
      localStorage.setItem('gap_csrf', data.data.csrf_token);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { token, csrf_token, user } = data.data;
    localStorage.setItem('gap_token', token);
    localStorage.setItem('gap_csrf', csrf_token);
    setUser(user);
    return user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    localStorage.removeItem('gap_token');
    localStorage.removeItem('gap_csrf');
    setUser(null);
  };

  const isAdmin = user && ['super_admin', 'admin'].includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
