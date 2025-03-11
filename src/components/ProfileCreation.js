import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { ArrowLeft, ArrowRight, User, Music, Medal, Camera } from "lucide-react";

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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 animate-fade-in">
      {/* Background Gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-festival-purple/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-festival-pink/20 rounded-full blur-3xl animate-pulse-slow delay-700" />
      </div>

      {/* Header with back button */}
      {step > 1 && (
        <div className="absolute top-0 left-0 w-full p-6">
          <button 
            onClick={handleBack}
            className="text-white/60 hover:text-white flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="w-full max-w-md mb-8">
        <div className="flex justify-between mb-2">
          {[1, 2, 3, 4, 5, 6].map((stepNum) => (
            <div 
              key={stepNum}
              className={`h-1 w-1/6 ${
                stepNum <= step ? "bg-festival-purple" : "bg-gray-600"
              } rounded-full`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-md w-full glass rounded-3xl p-8 mb-8">
        {/* Show QR code info if available */}
        {qrCodeId && (
          <div className="bg-green-500/20 p-3 rounded-lg mb-4 text-center">
            <p>QR Code detected! Complete your profile to claim it.</p>
          </div>
        )}
        
        {/* Step 1: Username */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-festival-purple/20 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-festival-purple" />
              </div>
              <h2 className="text-2xl font-bold text-gradient">What's your name?</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm text-gray-400">Username</label>
                <input
                  type="text"
                  id="username"
                  placeholder="Enter your name"
                  className="w-full px-4 py-3 glass rounded-lg bg-white/5 text-white border border-white/10 focus:border-festival-purple/50 focus:outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Step 2: Password */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-festival-purple/20 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-festival-purple" />
              </div>
              <h2 className="text-2xl font-bold text-gradient">Create a password</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm text-gray-400">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Enter a password"
                  className="w-full px-4 py-3 glass rounded-lg bg-white/5 text-white border border-white/10 focus:border-festival-purple/50 focus:outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Step 3: Photo Upload */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-festival-purple/20 flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-festival-purple" />
              </div>
              <h2 className="text-2xl font-bold text-gradient">Add a profile photo</h2>
              <p className="text-gray-400 mt-2">Upload a profile photo (optional)</p>
            </div>
            
            <div className="flex flex-col items-center justify-center">
              <div className="w-32 h-32 rounded-full glass flex items-center justify-center mb-4 overflow-hidden">
                {photo ? (
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt="Profile preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-festival-purple/50" />
                )}
              </div>
              
              <label className="cursor-pointer">
                <button className="px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-festival-purple">
                  Choose a photo
                </button>
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
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-festival-purple/20 flex items-center justify-center mx-auto mb-4">
                <Music className="w-10 h-10 text-festival-purple" />
              </div>
              <h2 className="text-2xl font-bold text-gradient">What's your favorite music genre?</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setFavoriteGenre(genre)}
                  className={`p-3 rounded-lg transition-colors ${
                    favoriteGenre === genre 
                      ? "bg-festival-purple text-white" 
                      : "bg-white/5 border border-white/10 hover:bg-white/10"
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
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-festival-purple/20 flex items-center justify-center mx-auto mb-4">
                <Medal className="w-10 h-10 text-festival-purple" />
              </div>
              <h2 className="text-2xl font-bold text-gradient">Review Your Profile</h2>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full glass flex items-center justify-center mb-4 overflow-hidden">
                {photo ? (
                  <img 
                    src={URL.createObjectURL(photo)} 
                    alt="Profile preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-festival-purple/50" />
                )}
              </div>
              
              <h3 className="text-xl font-bold">{name}</h3>
              
              {favoriteGenre && (
                <span className="mt-2 px-3 py-1 bg-festival-purple/30 rounded-full text-sm">
                  {favoriteGenre}
                </span>
              )}
              
              {qrCodeId && (
                <div className="mt-3 px-3 py-1 bg-green-500/30 rounded-full text-sm">
                  QR Code: {qrCodeId}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Step 6: Complete */}
        {step === 6 && (
          <div className="text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-festival-purple/20 flex items-center justify-center mx-auto">
              <Medal className="w-10 h-10 text-festival-purple" />
            </div>
            <h2 className="text-2xl font-bold text-gradient">Profile Complete!</h2>
            <p className="text-gray-400">
              {qrCodeId 
                ? "You're ready to claim your first stem!" 
                : "You're ready to start mixing stems!"}
            </p>
            
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 rounded-lg border border-red-500/30">
                <p className="text-center text-red-200">{error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="w-full max-w-md flex justify-between">
        {step === 1 ? (
          <button 
            onClick={handleNext} 
            disabled={!name.trim()}
            className={`w-full py-3 rounded-lg flex items-center justify-center ${
              !name.trim() 
                ? "bg-gray-600 cursor-not-allowed" 
                : "bg-festival-purple hover:bg-festival-purple/90"
            }`}
          >
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </button>
        ) : step === 6 ? (
          <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className={`w-full py-3 rounded-lg ${
              loading 
                ? "bg-gray-600 cursor-not-allowed" 
                : "bg-festival-purple hover:bg-festival-purple/90"
            }`}
          >
            {loading ? "Please wait..." : "Begin Your Festival Adventure!"}
          </button>
        ) : (
          <>
            <button 
              onClick={handleBack}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10"
            >
              Back
            </button>
            <button 
              onClick={handleNext} 
              disabled={step === 2 && !password.trim()}
              className={`px-4 py-2 rounded-lg flex items-center ${
                (step === 2 && !password.trim()) 
                  ? "bg-gray-600 cursor-not-allowed" 
                  : "bg-festival-purple hover:bg-festival-purple/90"
              }`}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileCreation;
