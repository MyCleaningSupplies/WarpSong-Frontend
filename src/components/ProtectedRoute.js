import React, { useEffect, useState, useContext } from "react";
import { Navigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setLoading(false);
          return;
        }

        // Verify the token and check admin status
        const response = await axios.get(`${API_BASE_URL}/api/user/verify-admin`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setIsAdmin(response.data.isAdmin);
        setLoading(false);
      } catch (error) {
        console.error("Error verifying admin status:", error);
        setLoading(false);
      }
    };

    if (adminOnly) {
      checkAdminStatus();
    } else {
      setLoading(false);
    }
  }, [adminOnly]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/profile" />;
  }

  return children;
};

export default ProtectedRoute;