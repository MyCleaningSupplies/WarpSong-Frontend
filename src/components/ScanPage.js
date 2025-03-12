import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { QrReader } from "react-qr-reader";
import { Scan, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "../config/api";
import { useGamification } from "../context/GamificationContext"; // Import the Gamification Context

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
  const [showScanSuccess, setShowScanSuccess] = useState(false);
  const { updateStats } = useGamification(); // Get updateStats from context

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
  
      // Call the QR code lookup endpoint
      const response = await axios.get(`${API_BASE_URL}/api/qrcode/lookup?qrCodeId=${qrCodeId}`, {
        headers: isAuthenticated ? { Authorization: `Bearer ${localStorage.getItem("token")}` } : {}
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
        } else if (response.data.userHasStem) {
          // Only show success dialog if user already has the stem
          setShowScanSuccess(true);
        }
        // If user doesn't have the stem yet, we don't show the success dialog
        // They'll see the "Add to My Collection" button instead
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
    setError("Failed to access camera. Please check your browser permissions.");
  };

  const addStemToCollection = async () => {
    try {
      setLoading(true);
  
      if (!isAuthenticated) {
        // If not authenticated, store QR code and redirect to login
        localStorage.setItem("scannedQrCodeId", scannedData);
        navigate("/login", { state: { redirectAfterLogin: "/scan" } });
        return;
      }
  
      // API call to add stem to user's collection
      const response = await axios.post(`${API_BASE_URL}/api/user/add-stem`,
        { stemId: stem.stemId },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
      );
  
      setUserHasStem(true);
      
      // Now show the success modal after successfully adding the stem
      setShowScanSuccess(true);
  
      // Update gamification stats
      await updateStats(); // Call updateStats to refresh gamification context data
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
    setShowScanSuccess(false);
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

  const handleScanComplete = () => {
    setShowScanSuccess(false);
    navigate("/stem-player");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-6 bg-gradient-to-br from-[#1A1429] via-[#211937] to-[#06001F] text-white">
      {/* Background Gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-4 md:p-6">
        <button
          onClick={() => navigate("/")}
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </button>
      </div>

      <div className="max-w-md w-full space-y-6 md:space-y-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Scan Your QR Code</h2>
        <p className="text-gray-400">Place the QR code in front of the camera</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 p-4 rounded-xl">
            <p className="text-white text-center">{error}</p>
            <button
              onClick={resetScan}
              className="mt-4 w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg transition-colors"
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
          <div className="relative aspect-square max-w-xs md:max-w-sm mx-auto my-4 md:my-8">
            <div className="absolute inset-0 rounded-3xl overflow-hidden border-2 border-purple-500/30">
              {cameraPermission ? (
                <QrReader
                  constraints={{ facingMode: 'environment' }}
                  onResult={(result, error) => {
                    if (result && !hasProcessedCode.current) {
                      handleScan(result?.text);
                    }
                  }}
                  onError={handleCameraError}
                  style={{ width: '100%', height: '100%' }}
                  className="rounded-3xl overflow-hidden"
                />
              ) : (
                <div className="bg-red-500/20 p-4 rounded-lg text-center h-full flex items-center justify-center">
                  <p>Camera access denied. Please check your browser permissions.</p>
                </div>
              )}
              <div className="absolute inset-0 border-2 border-white/20 rounded-3xl pointer-events-none"></div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-purple-500 rounded-lg"></div>
              </div>
            </div>
          </div>
        )}

        {/* Show stem info if authenticated */}
        {stem && isAuthenticated && !showScanSuccess && (
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 text-left">
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
                  className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add to My Collection"}
                </button>
              ) : (
                <div className="bg-green-500/20 border border-green-500/50 p-3 rounded-lg text-center text-green-200">
                  ✅ This stem is in your collection
                </div>
              )}

              <button
                onClick={resetScan}
                className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg transition-colors"
              >
                Scan Another QR Code
              </button>
            </div>
          </div>
        )}

        {/* Show login/register options if not authenticated but stem was found */}
        {stem && !isAuthenticated && !showScanSuccess && (
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 text-left">
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
                  className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-purple-500/25"
                >
                  Create Account
                </button>

                <button
                  onClick={goToLogin}
                  className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg transition-colors"
                >
                  Log In
                </button>
              </div>
            </div>

            <button
              onClick={resetScan}
              className="w-full bg-white/10 hover:bg-white/20 py-2 rounded-lg mt-4 transition-colors"
            >
              Scan Another QR Code
            </button>
          </div>
        )}

        {/* For testing: Manual QR code input */}
        {scanning && !loading && !error && (
          <div className="mt-6 pt-4 border-t border-white/20">
            <h3 className="text-sm font-bold text-center mb-2">Test with QR Code ID</h3>
            <div className="flex">
              <input
                type="text"
                placeholder="Enter QR Code ID"
                className="flex-1 p-2 rounded-l-lg bg-white/10 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                className="bg-purple-500 hover:bg-purple-600 px-4 rounded-r-lg transition-colors"
              >
                Test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scan Success Dialog */}
      {showScanSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1429]/95 backdrop-blur-lg rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-xl">
            <div className="text-center">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                QR Code Scanned!
              </h3>
              <p className="text-gray-300 mt-2">
                You have unlocked a new stem!
              </p>

              {stem && (
                <div className="mt-4 bg-white/5 p-4 rounded-xl text-white border border-white/10">
                  <h4 className="font-bold">{stem.name}</h4>
                  <p className="text-sm text-gray-300">By {stem.artist}</p>
                </div>
              )}
            </div>

            <div className="flex justify-center mt-6">
              <button
                onClick={handleScanComplete}
                className="py-2 px-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-purple-500/25"
              >
                Go to Sessions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
