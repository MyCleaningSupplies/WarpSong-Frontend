import React, { useEffect, useState, useContext } from "react";
import { Navigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading } = useContext(AuthContext);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(adminOnly);

  useEffect(() => {
    // Only check admin status if adminOnly is true
    if (adminOnly && isAuthenticated) {
      const checkAdminStatus = async () => {
        try {
          const token = localStorage.getItem("token");
          if (!token) {
            setAdminCheckLoading(false);
            return;
          }

          // Verify the token and check admin status
          const response = await axios.get(`${API_BASE_URL}/api/user/verify-admin`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          setIsAdmin(response.data.isAdmin);
        } catch (error) {
          console.error("Error verifying admin status:", error);
        } finally {
          setAdminCheckLoading(false);
        }
      };

      checkAdminStatus();
    } else {
      setAdminCheckLoading(false);
    }
  }, [adminOnly, isAuthenticated]);

  // Show loading while checking auth or admin status
  if (loading || adminCheckLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading...</div>;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Redirect to profile if admin route but user is not admin
  if (adminOnly && !isAdmin) {
    return <Navigate to="/profile" />;
  }

  // User is authenticated (and is admin if required)
  return children;
};

export default ProtectedRoute;
