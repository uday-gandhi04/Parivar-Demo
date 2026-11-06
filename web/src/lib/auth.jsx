import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api.js';

const TOKEN_KEY = 'parivar:token';
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setMember(null);
      setLoading(false);
      return;
    }
    let active = true;
    api.me()
      .then((data) => { if (active) setMember(data.member); })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        if (active) { setToken(null); setMember(null); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const handleUnauthorized = () => {
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setMember(null);
    };
    window.addEventListener('parivar:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('parivar:unauthorized', handleUnauthorized);
  }, []);

  async function enterDemo() {
    const data = await api.demoSession();
    localStorage.setItem(TOKEN_KEY, data.token);
    setMember(data.member);
    setToken(data.token);
    return data;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setMember(null);
  }

  async function refreshMember() {
    const data = await api.me();
    setMember(data.member);
  }

  return (
    <AuthContext.Provider value={{ member, loading, enterDemo, logout, refreshMember }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
