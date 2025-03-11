import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { QrReader } from "react-qr-reader";

const ScanPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [scanning, setScanning] = useState(true);
  const [scannedData, setScannedData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stem, setStem] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userHasStem, setUserHasStem] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(true);
  
  // Track if we've already processed a QR code to prevent duplicates
  const hasProcessedCode = useRef(false);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token");
      setIsAuthenticated(!!token);
    };
    
    checkAuth();
  }, []);

  // Check for QR code in URL params (for testing)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qrCodeId = params.get("qrCodeId");
    
    if (qrCodeId) {
      handleScan(qrCodeId);
    }
  }, [location]);

  // Function to stop all video streams
  const stopVideoStreams = () => {
    // Get all video elements
    const videos = document.getElementsByTagName('video');
    for (let i = 0; i < videos.length; i++) {
      // Get the MediaStream from the video element
      const stream = videos[i].srcObject;
      if (stream) {
        // Stop each track in the stream
        const tracks = stream.getTracks();
        tracks.forEach(track => {
          track.stop();
        });
        // Clear the source object
        videos[i].srcObject = null;
      }
    }
  };

  const handleScan = async (data) => {
    // Prevent duplicate processing
    if (hasProcessedCode.current || !scanning) return;
    
    // Mark as processed immediately
    hasProcessedCode.current = true;
    setScanning(false);
    setLoading(true);
    
    // Stop all video streams
    stopVideoStreams();
    
    try {
      console.log("QR Code scanned:", data);
      
      // Parse the QR code data
      let qrCodeId;
      
      // Handle different QR code formats
      if (typeof data === 'string') {
        if (data.startsWith("http")) {
          // URL format
          const url = new URL(data);
          qrCodeId = url.searchParams.get("qrCodeId");
        } else {
          // Try to parse as JSON
          try {
            const jsonData = JSON.parse(data);
            qrCodeId = jsonData.qrCodeId;
          } catch (e) {
            // If not JSON, assume it's just the raw ID
            qrCodeId = data;
          }
        }
      } else {
        // If data is not a string, it might be an object already
        qrCodeId = data.qrCodeId || data;
      }
      
      if (!qrCodeId) {
        throw new Error("Invalid QR code format");
      }
      
      console.log("Extracted QR Code ID:", qrCodeId);
      setScannedData(qrCodeId);
      
      // Get the API URL from environment or default
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";
      
      // Get token if available
      const token = localStorage.getItem("token");
      
      // Call the QR code lookup endpoint
      const response = await axios.get(`${apiUrl}/api/qrcode/lookup?qrCodeId=${qrCodeId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      
      console.log("API Response:", response.data);
      
      // Set the stem data
      setStem(response.data.stem);
      setIsAuthenticated(response.data.isAuthenticated);
      setUserHasStem(response.data.userHasStem || false);
      
      // If user is not authenticated
      if (!response.data.isAuthenticated) {
        // Check if QR code is already claimed
        if (response.data.isQrClaimed) {
          setError("This QR code has already been claimed by another user. Please log in to add it to your collection.");
        } else {
          // QR code is available, store it and redirect to profile creation
          console.log("User not authenticated, redirecting to profile creation");
          localStorage.setItem("scannedQrCodeId", qrCodeId);
          
          // Use a short timeout to ensure the state is updated before navigation
          setTimeout(() => {
            navigate("/profile-creation");
          }, 100);
        }
      } else {
        // User is authenticated
        if (response.data.isQrClaimed && !response.data.isClaimedByUser) {
          setError("This QR code has already been claimed by another user.");
        }
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      setError(error.response?.data?.error || "Failed to process QR code");
      // Reset the processed flag on error so user can try again
      hasProcessedCode.current = false;
    } finally {
      setLoading(false);
    }
  };
  

  const handleCameraError = (err) => {
    console.error("QR Scanner Error:", err);
    setCameraPermission(false);
    setError("Failed to access camera. Please check permissions.");
  };

  const addStemToCollection = async () => {
    try {
      setLoading(true);
      const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:3001";
      const token = localStorage.getItem("token");
      
      if (!token) {
        // If not authenticated, store QR code and redirect to login
        localStorage.setItem("scannedQrCodeId", scannedData);
        navigate("/login", { state: { redirectAfterLogin: "/scan" } });
        return;
      }
      
      await axios.post(`${apiUrl}/api/user/add-stem`, 
        { stemId: stem.stemId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setUserHasStem(true);
    } catch (error) {
      console.error("Error adding stem:", error);
      setError(error.response?.data?.error || "Failed to add stem to collection");
    } finally {
      setLoading(false);
    }
  };

  const resetScan = () => {
    // Reset all state
    setScanning(true);
    setScannedData(null);
    setStem(null);
    setError("");
    setCameraPermission(true);
    hasProcessedCode.current = false;
  };

  const goToLogin = () => {
    // Store QR code ID if available
    if (scannedData) {
      localStorage.setItem("scannedQrCodeId", scannedData);
    }
    navigate("/login", { state: { redirectAfterLogin: "/scan" } });
  };

  const goToProfileCreation = () => {
    // Store QR code ID if available
    if (scannedData) {
      localStorage.setItem("scannedQrCodeId", scannedData);
    }
    navigate("/profile-creation");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-purple-700 to-pink-500 text-white p-6">
      <div className="w-full max-w-md bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-4">Scan QR Code</h1>
        
        {error && (
          <div className="bg-red-500/50 p-3 rounded-lg mb-4">
            <p className="text-white text-center">{error}</p>
            <button 
              onClick={resetScan} 
              className="mt-2 w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg"
            >
              Try Again
            </button>
          </div>
        )}
        
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        )}
        
        {/* Only render the QR reader when scanning is true */}
        {scanning && !loading && !error && (
          <div className="relative">
            {cameraPermission ? (
              <QrReader
                constraints={{ facingMode: 'environment' }}
                onResult={(result, error) => {
                  if (result && !hasProcessedCode.current) {
                    handleScan(result?.text);
                  }
                }}
                onError={handleCameraError}
                style={{ width: '100%' }}
                className="rounded-lg overflow-hidden"
              />
            ) : (
              <div className="bg-red-500/50 p-4 rounded-lg text-center">
                <p>Camera access denied. Please check your browser permissions.</p>
              </div>
            )}
            <p className="text-center mt-2 text-sm">Position the QR code in the frame to scan</p>
          </div>
        )}
        
        {/* Show stem info if authenticated */}
        {stem && isAuthenticated && (
          <div className="mt-4">
            <h2 className="text-xl font-bold">{stem.name}</h2>
            <p className="text-sm opacity-80">By {stem.artist}</p>
            
            <div className="flex justify-between mt-2">
              <span className="bg-purple-500/30 px-3 py-1 rounded-full text-sm">{stem.type}</span>
              <span className="bg-pink-500/30 px-3 py-1 rounded-full text-sm">{stem.key} - {stem.bpm} BPM</span>
            </div>
            
            {stem.fileUrl && (
              <audio controls className="w-full mt-4 rounded-lg">
                <source src={stem.fileUrl} type="audio/wav" />
                Your browser does not support the audio element.
              </audio>
            )}
            
            <div className="mt-4 flex flex-col gap-2">
              {!userHasStem ? (
                <button 
                  onClick={addStemToCollection} 
                  disabled={loading}
                  className="w-full bg-green-500 hover:bg-green-600 py-2 rounded-lg"
                >
                  {loading ? "Adding..." : "Add to My Collection"}
                </button>
              ) : (
                <div className="bg-green-500/20 p-3 rounded-lg text-center">
                  ✅ This stem is in your collection
                </div>
              )}
              
              <button 
                onClick={resetScan} 
                className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg mt-2"
              >
                Scan Another QR Code
              </button>
            </div>
          </div>
        )}
        
        {/* Show login/register options if not authenticated but stem was found */}
        {stem && !isAuthenticated && (
          <div className="mt-4">
            <h2 className="text-xl font-bold">{stem.name}</h2>
            <p className="text-sm opacity-80">By {stem.artist}</p>
            
            <div className="flex justify-between mt-2">
              <span className="bg-purple-500/30 px-3 py-1 rounded-full text-sm">{stem.type}</span>
              <span className="bg-pink-500/30 px-3 py-1 rounded-full text-sm">{stem.key} - {stem.bpm} BPM</span>
            </div>
            
            <div className="bg-white/10 p-4 rounded-lg mt-4">
              <p className="text-center mb-3">Create an account or log in to collect this stem!</p>
              
              <div className="flex flex-col gap-2">
                <button 
                  onClick={goToProfileCreation} 
                  className="w-full bg-purple-500 hover:bg-purple-600 py-2 rounded-lg"
                >
                  Create Account
                </button>
                
                <button 
                  onClick={goToLogin} 
                  className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg"
                >
                  Log In
                </button>
              </div>
            </div>
            
            <button 
              onClick={resetScan} 
              className="w-full bg-white/20 hover:bg-white/30 py-2 rounded-lg mt-4"
            >
              Scan Another QR Code
            </button>
          </div>
        )}
        
        {/* For testing: Manual QR code input */}
        <div className="mt-6 pt-4 border-t border-white/20">
          <h3 className="text-sm font-bold text-center mb-2">Test with QR Code ID</h3>
          <div className="flex">
            <input 
              type="text" 
              placeholder="Enter QR Code ID" 
              className="flex-1 p-2 rounded-l-lg text-black"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && scanning && !hasProcessedCode.current) {
                  handleScan(e.target.value);
                }
              }}
            />
            <button 
              onClick={(e) => {
                if (scanning && !hasProcessedCode.current) {
                  handleScan(e.target.previousSibling.value);
                }
              }}
              className="bg-purple-500 hover:bg-purple-600 px-4 rounded-r-lg"
            >
              Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScanPage;
