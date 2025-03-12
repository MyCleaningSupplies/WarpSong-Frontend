import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Music, History, ArrowLeft, User, Trophy, Star, Flame, Album } from "lucide-react";
import AuthContext from "../context/AuthContext";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

// ✅ FestivalButton component
const FestivalButton = ({ children, glow, variant, disabled, onClick, className = "" }) => {
  const baseClasses = "flex items-center justify-center rounded-full transition-all duration-300 font-medium";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90 shadow-lg shadow-purple-500/25",
    outline: "border border-white/10 bg-white/5 hover:bg-white/10 text-white",
    ghost: "text-white/70 hover:text-white hover:bg-white/5",
  };
  
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`${baseClasses} ${variantClasses[variant || "primary"]} ${disabledClasses} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

// Glass Card component
const GlassCard = ({ children, className = "" }) => (
  <div className={`bg-white/5 backdrop-blur-sm rounded-3xl p-6 mb-6 border border-white/10 ${className}`}>
    {children}
  </div>
);

export const ProfileScreen = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useContext(AuthContext);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Load profile data from API
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/login");
          return;
        }

        const { data } = await axios.get(`${API_BASE_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        setProfile(data);
        console.log("✅ Profile data loaded:", data);
      } catch (error) {
        console.error("❌ Error fetching profile:", error);
        setError("Failed to load profile data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, navigate]);

  // Handle loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-center text-white text-xl">Loading profile...</p>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white text-xl">{error}</div>
      </div>
    );
  }

  // Handle missing profile data
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white text-xl">Profile data not available.</div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen p-6 animate-fade-in bg-gradient-to-br from-[#1A1429] via-[#211937] to-[#06001F] text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <FestivalButton 
          variant="ghost" 
          onClick={() => navigate("/")}
          className="text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug
        </FestivalButton>
        <FestivalButton onClick={handleLogout} variant="outline">Log Uit</FestivalButton>
      </div>

      {/* Profile Header */}
      <GlassCard className="text-center mb-8">
        <div className="w-24 h-24 rounded-full glass flex items-center justify-center mx-auto mb-4">
          <User className="w-12 h-12 text-purple-400" />
        </div>
        <h1 className="text-3xl font-bold text-gradient mb-2">{profile.username || "Onbekend"}</h1>
        <p className="text-gray-400">Lid sinds {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Onbekend"}</p>
        <p className="text-gray-400 mt-1">Niveau: {profile.level || "Onbekend"}</p>
      </GlassCard>

      {/* Stats Overview */}
      <GlassCard>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <Trophy className="w-6 h-6 text-purple-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">Lvl {profile.level || 0}</p>
            <p className="text-sm text-gray-400">Niveau</p>
          </div>
          <div className="text-center">
            <Star className="w-6 h-6 text-pink-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{profile.stemsCollected || 0}</p>
            <p className="text-sm text-gray-400">Stems</p>
          </div>
          <div className="text-center">
            <Flame className="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{profile.streak || 0}</p>
            <p className="text-sm text-gray-400">Dagenreeks</p>
          </div>
          <div className="text-center">
            <Album className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">#{profile.rank || 0}</p>
            <p className="text-sm text-gray-400">Ranking</p>
          </div>
        </div>
      </GlassCard>

      {/* Achievements */}
      <GlassCard>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-orange-400" />
          Prestaties
        </h2>
        <div className="space-y-4">
          {profile.achievements && profile.achievements.map(achievement => (
            <div key={achievement._id} className="glass p-4 rounded-2xl opacity-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{achievement.name}</h3>
                  <p className="text-sm text-gray-400">{achievement.description}</p>
                </div>
                <Trophy className="w-5 h-5 text-orange-400" />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Stems Collection */}
      <GlassCard>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Music className="w-5 h-5 mr-2 text-purple-400" />
          Jouw Stems
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.stems && profile.stems.map(stem => (
            <div key={stem._id} className="glass p-4 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">{stem.name}</span>
                <span className="text-sm text-gray-400">{stem.type}</span>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Recent Mashups */}
      <GlassCard>
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <History className="w-5 h-5 mr-2 text-pink-400" />
          Recente Mashups
        </h2>
        <div className="space-y-4">
          {profile.mashups && profile.mashups.map(mashup => (
            <div key={mashup._id} className="glass p-4 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{mashup.name}</h3>
                  <p className="text-sm text-gray-400">
                    Gemaakt op {new Date(mashup.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {/* Assuming you want a "ghost" style button */}
                <FestivalButton 
                  variant="ghost"
                  onClick={() => navigate(`/share`)}
                  className="text-purple-400 hover:bg-purple-500/10"
                >
                  Delen
                </FestivalButton>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
