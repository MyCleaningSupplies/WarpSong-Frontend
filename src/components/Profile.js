import React, { useEffect, useState } from "react";
import axios from "axios";

const Profile = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        const { data } = await axios.get("http://localhost:3001/api/user/profile", {
          headers: { Authorization: `Bearer ${token}` }
        });
        setProfile(data);
      } catch (error) {
        console.error("❌ Error fetching profile:", error);
      }
    };

    fetchProfile();
  }, []);

  if (!profile) return <p>Loading...</p>;

  return (
    <div className="profile-container">
      <h1>{profile.username}</h1>
      <p>Level: {profile.level}</p>
      <p>XP: {profile.xp} / {profile.level * 50}</p>
      <p>Daily Streak: {profile.streak} days</p>
      <p>Stems Collected: {profile.stemsCollected}</p>
      <p>Achievements: {profile.achievements.length}</p>
      <p>Ranking: #{profile.rank}</p>
      <button>Edit Profile</button>
    </div>
  );
};

export default Profile;