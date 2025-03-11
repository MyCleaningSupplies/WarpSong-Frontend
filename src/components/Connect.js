import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Connect = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    // You could fetch user data here if needed
    // For now, just display a simple message
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-700 to-pink-500 text-white p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-center">Connect with Others</h1>
        <p className="text-center mt-4">
          Your profile has been created successfully! This page will allow you to connect with other festival-goers.
        </p>
        <p className="text-center mt-4">
          This feature is coming soon. Stay tuned!
        </p>
      </div>
    </div>
  );
};

export default Connect;
