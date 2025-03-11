import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QrReader } from "react-qr-reader";
import { ArrowLeft, Camera, LoaderCircle } from "lucide-react";
import axios from "axios";

const ScanPage = () => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleScan = async (qrData) => {
    if (!qrData || scanning) return;

    setScanning(true);
    setError(null);

    console.log("📸 Scanned QR Code:", qrData);

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://localhost:3001/api/stems/scan",
        { qrIdentifier: qrData },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      console.log("✅ Scan successful:", response.data);

      if (response.data.newUser) {
        navigate("/profile-setup");
      } else {
        navigate("/connect");
      }
    } catch (error) {
      console.error("❌ Scan error:", error);
      setError("Ongeldige of reeds geclaimde QR-code.");
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#1a1429] text-white relative">
      {/* Back Button */}
      <button
        className="absolute top-4 left-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="w-6 h-6 text-white" />
      </button>

      {/* Title & Instructions */}
      <h1 className="text-2xl font-bold mb-2">Scan Je QR-code</h1>
      <p className="text-white/60 text-sm text-center max-w-xs">
        Scan de QR-code op je ticket of toegangspas om je unieke stem te ontgrendelen.
      </p>

      {/* QR Scanner Component */}
      <div className="relative w-64 h-64 bg-white/10 rounded-xl overflow-hidden mt-6 flex items-center justify-center">
        {scanning && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 animate-pulse">
            <LoaderCircle className="w-10 h-10 text-white animate-spin" />
          </div>
        )}

<QrReader
  constraints={{ facingMode: "environment" }}
  onResult={(result, error) => {
    if (result) {
      handleScan(result.text);
    }
    if (error) {
      // Optionally, debounce or conditionally log the error
      console.error("QR Scanner Error:", error);
    }
  }}
  className="w-full h-full object-cover"
/>
      </div>

      {/* Scan Button */}
      <button
        onClick={() => setScanning(!scanning)}
        className="mt-6 px-6 py-3 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] text-white rounded-full shadow-lg flex items-center gap-2"
      >
        <Camera className="w-5 h-5" />
        {scanning ? "Scannen..." : "Start Scannen"}
      </button>

      {/* Error Message */}
      {error && <p className="text-red-400 mt-4">{error}</p>}
    </div>
  );
};

export default ScanPage;