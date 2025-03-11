import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import AuthContext from "../context/AuthContext";

const Profile = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          navigate("/login");
          return;
        }

        const { data } = await axios.get(`${API_BASE_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log("Profile data:", data);

        // ✅ Ensure stems and mashups are always an array
        const processedData = {
          ...data,
          stems: data.stems || [],
          mashups: data.mashups || []
        };

        setProfile(processedData);
      } catch (error) {
        console.error("❌ Error fetching profile:", error);
        setError("Failed to load profile data. Please try again.");
        
        // If we get a 401 Unauthorized, the token is invalid
        if (error.response && error.response.status === 401) {
          localStorage.removeItem("token");
          navigate("/login");
        }
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [navigate, isAuthenticated]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-700 to-pink-500">
        <p className="text-center text-white text-xl">Loading profile...</p>
      </div>
    );
  }

  // Handle not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-700 to-pink-500">
        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl text-center">
          <p className="text-white text-xl mb-4">Please log in to view your profile</p>
          <button 
            onClick={() => navigate("/login")} 
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  // Handle error or no profile data
  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-700 to-pink-500">
        <div className="bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl text-center">
          <p className="text-white text-xl mb-4">{error || "Profile data not available"}</p>
          <button 
            onClick={() => navigate("/")} 
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // If we have profile data, render the profile
  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-purple-700 to-pink-500 p-6 text-white">
      <div className="w-full max-w-2xl bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate("/")} className="text-white text-lg">
            ← Terug
          </button>
          <h1 className="text-2xl font-bold text-center">Mijn Profiel</h1>
        </div>

        {/* Profile Info */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 text-4xl">
            {profile.username ? profile.username.charAt(0).toUpperCase() : "?"}
          </div>
          <h2 className="mt-4 text-xl font-bold">{profile.username || "Onbekend"}</h2>
          <p className="text-sm text-gray-300">
            Lid sinds:{" "}
            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Onbekend"}
          </p>
          <p className="text-sm text-gray-300">Favoriet Genre: {profile.favoriteGenre || "Onbekend"}</p>
        </div>

        {/* Rest of your profile component remains the same */}
        {/* ... */}

        {/* Logout */}
        <button
          onClick={() => {
            localStorage.removeItem("token");
            navigate("/login");
          }}
          className="w-full mt-6 bg-red-500 hover:bg-red-600 py-2 rounded-lg"
        >
          Log Uit
        </button>
      </div>
    </div>
  );
};

export default Profile;
