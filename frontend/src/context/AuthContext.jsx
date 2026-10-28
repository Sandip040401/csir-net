import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState({
    name: 'CSIR Aspirant',
    email: 'aspirant@csirnet.local',
    examDate: '2026-12-19',
    dailyTarget: 100,
    settings: {
      weakThreshold: 50,
      needsWorkThreshold: 65,
      goodThreshold: 80,
    },
  });
  const [loading, setLoading] = useState(false);

  const fetchUser = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.user) {
        setUser(res.data.user);
      }
    } catch (err) {
      // In no-auth mode, default user is always available
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const updateUser = (updated) => {
    setUser((prev) => ({ ...prev, ...updated }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, updateUser, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
