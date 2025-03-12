// contexts/GamificationContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';//no longer need asyncstorage
import { API_BASE_URL, SOCKET_URL } from '../config/api';//we need axios instead, since we aren't using api.js

const GamificationContext = createContext();

export const useGamification = () => useContext(GamificationContext);

export const GamificationProvider = ({ children }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadGamificationStats = async () => {
      setLoading(true);
      try {
        // const response = await apis.getGamificationStats();
        const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/api/gamification/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStats(response.data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    // Load stats when the component mounts
    loadGamificationStats();
  }, []);

  const updateStats = async () => {
    setLoading(true);
    try {
      // const response = await apis.getGamificationStats();
      const token = localStorage.getItem("token");
        const response = await axios.get(`${API_BASE_URL}/api/gamification/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      setStats(response.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    stats,
    loading,
    error,
    updateStats,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
};
