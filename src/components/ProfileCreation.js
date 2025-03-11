import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { ArrowLeft, ArrowRight, User, Music, Medal, Camera } from "lucide-react";

// Helper component for the festival button styling
const FestivalButton = ({ children, glow, variant, disabled, onClick, className = "" }) => {
  const baseClasses = "flex items-center justify-center rounded-xl transition-all duration-300 font-medium";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:opacity-90",
    outline: "border border-white/10 bg-white/5 hover:bg-white/10 text-white",
    ghost: "text-white/70 hover:text-white hover:bg-white/5",
  };
  
  const glowClasses = glow ? "shadow-lg shadow-purple-600/20" : "";
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";
  
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      className={`${baseClasses} ${variantClasses[variant || "primary"]} ${glowClasses} ${disabledClasses} ${className}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0f172a] animate-fadeIn">
      {/* Background Gradient Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse-slow delay-700" />
        <div className="absolute top-3/4 left-1/4 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl animate-pulse-slow delay-300" />
        <div className="absolute bottom-1/3 right-1/4 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl animate-pulse-slow delay-500" />
      </div>

      {/* Header with back button */}
      {step > 1 && (
        <div className="absolute top-0 left-0 w-full p-6">
          <FestivalButton 
            variant="ghost" 
            onClick={handleBack}
            className="px-4 py-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </FestivalButton>
        </div>
      )}

      {/* Progress indicator */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5, 6].map((stepNum) => (
            <div 
              key={stepNum}
              className={`h-1 w-1/6 ${
                stepNum <= step 
                  ? "bg-gradient-to-r from-purple-600 to-pink-600" 
                  : "bg-gray-700"
              } rounded-full transition-all duration-300`}
            />
          ))}
        </div>
      </div>

      {/* Main content card */}
      <div className="max-w-md w-full backdrop-blur-xl bg-white/5 rounded-2xl p-8 mb-8 shadow-xl border border-white/10 animate-fadeIn transition-all duration-300">
        {/* Show QR code info if available */}
        {qrCodeId && (
          <div className="bg-green-900/30 border border-green-500/30 p-4 rounded-xl mb-6 text-center animate-fadeIn">
            <p className="text-green-300">QR Code detected! Complete your profile to claim it.</p>
          </div>
        )}
        
        {/* Step 1: Username */}
        {step === 1 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">What's your name?</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm text-gray-400">Username</label>
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Step 2: Password */}
        {step === 2 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
                <User className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Create a password</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-gray-400">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Enter a password"
                  className="w-full px-4 py-3 rounded-xl bg-white/5 text-white border border-white/10 focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 focus:outline-none transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Step 3: Photo Upload */}
{/* Step 3: Photo Upload */}
{step === 3 && (
  <div className="space-y-6 animate-fadeIn">
    <div className="text-center mb-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
        <Camera className="w-10 h-10 text-purple-400" />
      </div>
      <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Add a profile photo</h2>
      <p className="text-gray-400 mt-2">Upload a profile photo (optional)</p>
    </div>
    
    <div className="flex flex-col items-center justify-center">
      <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 overflow-hidden">
        {photo ? (
          <img 
            src={URL.createObjectURL(photo)} 
            alt="Profile preview" 
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-16 h-16 text-purple-400/50" />
        )}
      </div>
      
      <label className="cursor-pointer">
        {/* This is a label that wraps the hidden input, so clicking anywhere on it will trigger the file dialog */}
        <div className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-purple-400 transition-all">
          Choose a photo
        </div>
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handlePhotoUpload}
        />
      </label>
    </div>
  </div>
)}

        
        {/* Step 4: Favorite Genre */}
        {step === 4 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
                <Music className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">What's your favorite music genre?</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setFavoriteGenre(genre)}
                  className={`p-3 rounded-xl transition-all ${
                    favoriteGenre === genre 
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white" 
                      : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Step 5: Confirmation */}
        {step === 5 && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
                <Medal className="w-10 h-10 text-purple-400" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Review Your Profile</h2>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4 overflow-hidden">
                {photo ? (
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt="Profile preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-purple-400/50" />
                )}
              </div>
              
              <h3 className="text-xl font-bold text-white">{name}</h3>
              
              {favoriteGenre && (
                <span className="mt-2 px-3 py-1 bg-gradient-to-r from-purple-600/30 to-pink-600/30 rounded-full text-sm text-purple-200">
                  {favoriteGenre}
                </span>
              )}
              
              {qrCodeId && (
                <div className="mt-3 px-3 py-1 bg-green-500/30 rounded-full text-sm text-green-200">
                  QR Code: {qrCodeId}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Step 6: Complete */}
        {step === 6 && (
          <div className="text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600/20 to-pink-600/20 flex items-center justify-center mx-auto mb-6">
              <Medal className="w-10 h-10 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">Profile Complete!</h2>
            <p className="text-gray-400">
              {qrCodeId 
                ? "You're ready to claim your first stem!" 
                : "You're ready to start mixing stems!"}
            </p>
            
            {error && (
              <div className="mt-4 p-4 bg-red-500/20 rounded-xl border border-red-500/30">
                <p className="text-center text-red-200">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="w-full max-w-md flex justify-between animate-fadeIn">
        {step === 1 ? (
          <FestivalButton 
            glow
            onClick={handleNext} 
            disabled={!name.trim()}
            className={`w-full py-3 group ${!name.trim() ? "opacity-50" : ""}`}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </FestivalButton>
        ) : step === 6 ? (
          <FestivalButton 
            glow
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full py-3"
          >
            {loading ? "Please wait..." : "Begin Your Festival Adventure!"}
          </FestivalButton>
        ) : (
          <>
            <div></div> {/* Spacer for flex justify-between */}
            <FestivalButton 
              glow
              onClick={handleNext} 
              disabled={step === 2 && !password.trim()}
              className="px-6 py-3 group"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </FestivalButton>
          </>
        )}
      </div>
    </div>
  );
};

// Add these animations to your CSS or tailwind.config.js
// @keyframes fadeIn {
//   from { opacity: 0; transform: translateY(10px); }
//   to { opacity: 1; transform: translateY(0); }
// }
// 
// @keyframes pulseSlow {
//   0%, 100% { opacity: 0.4; }
//   50% { opacity: 0.7; }
// }
// 
// .animate-fadeIn {
//   animation: fadeIn 0.5s ease-out forwards;
// }
// 
// .animate-pulse-slow {
//   animation: pulseSlow 4s ease-in-out infinite;
// }
// 
// .text-gradient {
//   @apply bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent;
// }
// 
// .glass {
//   @apply backdrop-blur-xl bg-white/5 border border-white/10;
// }

export default ProfileCreation;
