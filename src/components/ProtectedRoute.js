import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // Add this import
import AuthContext from "../context/AuthContext";

const ProtectedRoute = ({ children, adminOnly }) => {
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate(); // Now this will work

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  return children;
};

export default ProtectedRoute;
