import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

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
        if (!data.stems) {
          data.stems = [];
        }
        if (!data.mashups) {
          data.mashups = [];
        }

        setProfile(data);
      } catch (error) {
        console.error("❌ Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  if (loading) return <p className="text-center text-white">Loading...</p>;

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
            {profile.username?.charAt(0).toUpperCase()}
          </div>
          <h2 className="mt-4 text-xl font-bold">{profile.username || "Onbekend"}</h2>
          <p className="text-sm text-gray-300">
            Lid sinds:{" "}
            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "Onbekend"}
          </p>
          <p className="text-sm text-gray-300">Favoriet Genre: {profile.favoriteGenre || "Onbekend"}</p>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="p-4 bg-purple-500 rounded-xl text-center">
            <h3 className="text-lg font-bold">🎮 Level</h3>
            <p className="text-2xl">{profile.level || 1}</p>
          </div>
          <div className="p-4 bg-pink-500 rounded-xl text-center">
            <h3 className="text-lg font-bold">🎵 Stems</h3>
            <p className="text-2xl">{profile.stems.length || 0}</p>
          </div>
          <div className="p-4 bg-cyan-500 rounded-xl text-center">
            <h3 className="text-lg font-bold">🔥 Streak</h3>
            <p className="text-2xl">{profile.streak || 0}d</p>
          </div>
          <div className="p-4 bg-yellow-500 rounded-xl text-center">
            <h3 className="text-lg font-bold">🏆 Ranking</h3>
            <p className="text-2xl">#{profile.rank || 999}</p>
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mt-6">
          <h3 className="text-lg font-bold">🚀 XP Progress</h3>
          <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
            <div
              className="h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
              style={{ width: `${(profile.xp / ((profile.level || 1) * 50)) * 100}%` }}
            ></div>
          </div>
          <p className="text-sm mt-2">
            {profile.xp || 0} / {(profile.level || 1) * 50} XP
          </p>
        </div>

        {/* Achievements Section */}
        <div className="mt-6">
          <h3 className="text-lg font-bold">🏅 Achievements</h3>
          <ul className="mt-2 space-y-2">
            {profile.achievements?.length > 0 ? (
              profile.achievements.map((ach, index) => (
                <li key={index} className="p-3 bg-white/10 rounded-xl">
                  🏆 {ach}
                </li>
              ))
            ) : (
              <p className="text-sm text-gray-300">Nog geen prestaties behaald.</p>
            )}
          </ul>
        </div>

        {/* Stems Collected */}
        <div className="mt-6">
          <h3 className="text-lg font-bold">📀 Mijn Stems</h3>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {profile.stems && profile.stems.length > 0 ? (
              profile.stems.map((stem, index) => (
                <div key={index} className="p-3 bg-white/10 rounded-xl">
                  <p className="text-sm">
                    {stem.name} - {stem.type}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-300">Geen stems verzameld.</p>
            )}
          </div>
        </div>

        {/* Mashups Created */}
        <div className="mt-6">
          <h3 className="text-lg font-bold">🎵 Mijn Mashups</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            {profile.mashups && profile.mashups.length > 0 ? (
              profile.mashups.map((mashup, index) => (
                <div key={index} className="p-3 bg-white/10 rounded-xl">
                  <p className="text-sm">{mashup.name}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-300">Geen mashups gemaakt.</p>
            )}
          </div>
        </div>

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
