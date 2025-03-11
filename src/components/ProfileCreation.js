import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const ProfileCreation = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [photo, setPhoto] = useState(null);
  const [favoriteGenre, setFavoriteGenre] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [qrCodeId, setQrCodeId] = useState(null);

  const genres = ["Techno", "House", "Trance", "Drum & Bass", "Hip Hop", "Pop", "Rock", "Metal"];

  // Check for scanned QR code in localStorage
  useEffect(() => {
    const storedQrCodeId = localStorage.getItem("scannedQrCodeId");
    if (storedQrCodeId) {
      setQrCodeId(storedQrCodeId);
      console.log("Found scanned QR code:", storedQrCodeId);
    }
  }, []);

  // Debug logging
  useEffect(() => {
    console.log("Current step:", step);
    console.log("QR Code ID:", qrCodeId);
  }, [step, qrCodeId]);

  const handleNext = () => setStep((prev) => prev + 1);
  const handleBack = () => setStep((prev) => prev - 1);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhoto(file);
    }
  };

  // Updated handleSubmit with API_BASE_URL
  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    
    // Ensure name is not empty before submission
    if (!name.trim()) {
      setError("Username is required");
      setLoading(false);
      return;
    }
    
    // Ensure password is not empty
    if (!password.trim()) {
      setError("Password is required");
      setLoading(false);
      return;
    }
    
    try {
      // Generate a unique username by adding a timestamp
      const uniqueUsername = `${name.trim()}_${Date.now()}`;
      
      // Prepare user data including QR code if available
      const userData = {
        username: uniqueUsername,
        password: password,
        favoriteGenre: favoriteGenre || "",
        qrCodeId: qrCodeId || undefined
      };
      
      console.log("Sending JSON data with unique username:", userData);
      
      // Register the user using API_BASE_URL
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, userData, {
        headers: { 
          "Content-Type": "application/json"
        },
      });
  
      console.log("✅ Registration successful:", response.data);
      
      // Store the token and user data
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("user", JSON.stringify({
        id: response.data.user.id,
        username: response.data.user.username,
        favoriteGenre: response.data.user.favoriteGenre,
        stems: response.data.user.stems || []
      }));
      
      // Clear the stored QR code
      localStorage.removeItem("scannedQrCodeId");
      
      // If we have a photo, upload it separately after successful registration
      if (photo) {
        try {
          const photoFormData = new FormData();
          photoFormData.append("photo", photo);
          photoFormData.append("userId", response.data.user.id); // Add user ID from registration response
          
          // Use API_BASE_URL for photo upload
          await axios.post(`${API_BASE_URL}/api/user/upload-photo`, photoFormData, {
            headers: { 
              Authorization: `Bearer ${response.data.token}`, 
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
        } else if (error.response.data.error === "Invalid QR code") {
          setError("The scanned QR code is invalid. Please try scanning again.");
        } else if (error.response.data.error === "QR code already assigned to another user") {
          setError("This QR code has already been claimed by another user.");
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
        {/* Show QR code info if available */}
        {qrCodeId && (
          <div className="bg-green-500/20 p-3 rounded-lg mb-4 text-center">
            <p>QR Code detected! Complete your profile to claim it.</p>
          </div>
        )}
        
        {/* Step 1: Username */}
        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-center">What's your name?</h2>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full mt-4 p-2 rounded-lg bg-white/20 text-white placeholder-white/60"
            />
            <button 
              onClick={handleNext} 
              disabled={!name.trim()}
              className={`w-full mt-6 py-2 rounded-lg ${!name.trim() ? "bg-gray-400" : "bg-purple-500 hover:bg-purple-600"}`}
            >
              Next
            </button>
          </>
        )}
        
        {/* Step 2: Password */}
        {step === 2 && (
          <>
            <h2 className="text-xl font-bold text-center">Create a password</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter a password"
              className="w-full mt-4 p-2 rounded-lg bg-white/20 text-white placeholder-white/60"
            />
            <div className="flex justify-between mt-6">
              <button 
                onClick={handleBack}
                className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30"
              >
                Back
              </button>
              <button 
                onClick={handleNext} 
                disabled={!password.trim()}
                className={`px-4 py-2 rounded-lg ${!password.trim() ? "bg-gray-400" : "bg-purple-500 hover:bg-purple-600"}`}
              >
                Next
              </button>
            </div>
          </>
        )}
        
        {/* Step 3: Photo Upload */}
        {step === 3 && (
          <>
            <h2 className="text-xl font-bold text-center">Add a profile photo</h2>
            <div className="mt-4 flex flex-col items-center">
              {photo ? (
                <div className="relative">
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt="Profile preview" 
                    className="w-32 h-32 rounded-full object-cover"
                  />
                  <button 
                    onClick={() => setPhoto(null)}
                    className="absolute bottom-0 right-0 bg-red-500 rounded-full p-1"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ) : (
                <label className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                </label>
              )}
              <p className="mt-2 text-sm opacity-70">Optional: Upload a profile photo</p>
            </div>
            <div className="flex justify-between mt-6">
              <button 
                onClick={handleBack}
                className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30"
              >
                Back
              </button>
              <button 
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600"
              >
                Next
              </button>
            </div>
          </>
        )}
        
        {/* Step 4: Favorite Genre */}
        {step === 4 && (
          <>
            <h2 className="text-xl font-bold text-center">What's your favorite music genre?</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setFavoriteGenre(genre)}
                  className={`p-2 rounded-lg ${
                    favoriteGenre === genre 
                      ? "bg-purple-500" 
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-6">
              <button 
                onClick={handleBack}
                className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30"
              >
                Back
              </button>
              <button 
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600"
              >
                Next
              </button>
            </div>
          </>
        )}
        
        {/* Step 5: Confirmation */}
        {step === 5 && (
          <>
            <h2 className="text-xl font-bold text-center">Review Your Profile</h2>
            <div className="mt-4 flex flex-col items-center">
              {photo ? (
                <img 
                  src={URL.createObjectURL(photo)} 
                  alt="Profile preview" 
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <h3 className="mt-2 text-lg font-bold">{name}</h3>
              {favoriteGenre && (
                <span className="mt-1 px-3 py-1 bg-purple-500/30 rounded-full text-sm">
                  {favoriteGenre}
                </span>
              )}
              {qrCodeId && (
                <div className="mt-3 px-3 py-1 bg-green-500/30 rounded-full text-sm">
                  QR Code: {qrCodeId}
                </div>
              )}
            </div>
            <div className="flex justify-between mt-6">
              <button 
                onClick={handleBack}
                className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30"
              >
                Back
              </button>
              <button 
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600"
              >
                Confirm
              </button>
            </div>
          </>
        )}
        
        {/* Step 6: Complete */}
        {step === 6 && (
          <>
            <h2 className="text-xl font-bold text-center">Profile Complete!</h2>
            <p className="text-center mt-2">
              {qrCodeId 
                ? "You're ready to claim your first stem!" 
                : "You're ready to start mixing stems!"}
            </p>
            {error && (
              <div className="mt-4 p-3 bg-red-500/50 rounded-lg">
                <p className="text-center">{error}</p>
              </div>
            )}
            <button 
              onClick={handleSubmit} 
              disabled={loading} 
              className={`w-full mt-6 py-2 rounded-lg ${loading ? "bg-gray-400" : "bg-green-500 hover:bg-green-600"}`}
            >
              {loading ? "Please wait..." : "Begin Your Festival Adventure!"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileCreation;
