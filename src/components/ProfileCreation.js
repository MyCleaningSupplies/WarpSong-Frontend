import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const ProfileCreation = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [favoriteGenre, setFavoriteGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const genres = ["Techno", "House", "Trance", "Drum & Bass", "Hip Hop", "Pop", "Rock", "Metal"];

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    const token = localStorage.getItem("token");
    
    // Ensure name is not empty before submission
    if (!name.trim()) {
      setError("Username is required");
      setLoading(false);
      return;
    }
    
    try {
      // Use environment variable for API URL if available
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";
      
      // Generate a unique username by adding a timestamp
      const uniqueUsername = `${name.trim()}_${Date.now()}`;
      
      // Try sending as JSON instead of FormData
      const userData = {
        username: uniqueUsername,
        password: "defaultPassword123",
        favoriteGenre: favoriteGenre || ""
      };
      
      console.log("Sending JSON data with unique username:", userData);
      
      // First attempt: Try with JSON
      const response = await axios.post(`${apiUrl}/api/auth/register`, userData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
      });
  
      console.log("✅ Registration successful:", response.data);
      
      // If we have a photo, upload it separately after successful registration
      if (photo) {
        try {
          const photoFormData = new FormData();
          photoFormData.append("photo", photo);
          photoFormData.append("userId", response.data.user._id); // Add user ID from registration response
          
          await axios.post(`${apiUrl}/api/user/upload-photo`, photoFormData, {
            headers: { 
              Authorization: `Bearer ${response.data.token || token}`, 
              "Content-Type": "multipart/form-data" 
            },
          });
          
          console.log("✅ Photo uploaded successfully");
        } catch (photoError) {
          console.error("⚠️ Photo upload failed, but user was created:", photoError);
          // Continue anyway since the user was created
        }
      }
      
      navigate("/connect");
    } catch (error) {
      console.error("❌ Error submitting profile:", error.response?.data || error.message);
      
      // More detailed error logging
      if (error.response) {
        console.log("Response status:", error.response.status);
        console.log("Response headers:", error.response.headers);
        console.log("Response data:", error.response.data);
        
        // Set a more user-friendly error message
        if (error.response.data.error === "User or QR already exists") {
          setError("This username is already taken. Please try another one.");
        } else {
          setError(error.response?.data?.error || "Failed to create profile. Please try again.");
        }
      } else {
        setError("Network error. Please check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-700 to-pink-500 text-white p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl">
        {step === 1 && (
          <>
            <h1 className="text-2xl font-bold text-center">Welkom bij WarpSong!</h1>
            <p className="text-center mt-2">Personaliseer je ervaring en verzamel stems.</p>
            <button onClick={handleNext} className="w-full mt-6 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg">
              Aan de Slag →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-xl font-bold text-center">Hoe wil je genoemd worden?</h2>
            <input type="text" className="w-full p-2 mt-4 rounded-lg text-black" placeholder="Jouw naam" value={name} onChange={(e) => setName(e.target.value)} />
            <button onClick={handleNext} disabled={!name} className={`w-full mt-6 py-2 rounded-lg ${name ? "bg-purple-500 hover:bg-purple-600" : "bg-gray-400"}`}>
              Volgende →
            </button>
            <button onClick={handleBack} className="mt-2 text-sm text-gray-300">← Terug</button>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-xl font-bold text-center">Voeg een profielfoto toe</h2>
            <input type="file" accept="image/*" className="mt-4" onChange={handlePhotoUpload} />
            {photo && <img src={URL.createObjectURL(photo)} alt="Preview" className="mt-4 w-32 h-32 rounded-full object-cover mx-auto" />}
            <button onClick={handleNext} className="w-full mt-6 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg">
              Volgende →
            </button>
            <button onClick={handleBack} className="mt-2 text-sm text-gray-300">← Terug</button>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-xl font-bold text-center">Muziekvoorkeuren</h2>
            <select className="w-full p-2 mt-4 rounded-lg text-black" value={favoriteGenre} onChange={(e) => setFavoriteGenre(e.target.value)}>
              <option value="">Selecteer een genre</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>{genre}</option>
              ))}
            </select>
            <button onClick={handleNext} disabled={!favoriteGenre} className={`w-full mt-6 py-2 rounded-lg ${favoriteGenre ? "bg-purple-500 hover:bg-purple-600" : "bg-gray-400"}`}>
              Volgende →
            </button>
            <button onClick={handleBack} className="mt-2 text-sm text-gray-300">← Terug</button>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="text-xl font-bold text-center">Profiel Compleet!</h2>
            <p className="text-center mt-2">Je bent klaar om te beginnen met het mixen van stems!</p>
            <button onClick={handleSubmit} disabled={loading} className={`w-full mt-6 py-2 rounded-lg ${loading ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"}`}>
              {loading ? "Even geduld..." : "Begin je Festival Avontuur!"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileCreation;
