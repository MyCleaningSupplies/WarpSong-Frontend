import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Camera, Users, Music, Share2, User, Sparkles, QrCode, Play, SquareUserRound } from "lucide-react";
import AuthContext from "../context/AuthContext";

const HomePage = () => {
  const { isAuthenticated } = useContext(AuthContext);
  const navigate = useNavigate();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const onboardingSteps = [
    {
      title: "Welcome to WarpSong!",
      description: "Create your own unique festival mashups by collecting stems from different artists. Start your musical adventure!",
      image: <Music className="w-12 h-12 text-festival-purple mb-4 animate-bounce" />,
      bgClass: "from-festival-purple/20 via-festival-pink/10 to-transparent"
    },
    {
      title: "Collect Stems",
      description: "Scan your QR code at different stages to collect stems from performances. Each artist adds something unique to your mix!",
      image: <QrCode className="w-12 h-12 text-festival-pink mb-4 animate-pulse" />,
      bgClass: "from-festival-pink/20 via-festival-purple/10 to-transparent"
    },
    {
      title: "Create Your First Mix",
      description: "You can only listen to other mixes after creating your first mix. Start scanning to collect your first stems!",
      image: <Play className="w-12 h-12 text-festival-cyan mb-4 animate-bounce" />,
      bgClass: "from-festival-cyan/20 via-festival-pink/10 to-transparent"
    }
  ];

  const handleNextStep = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setShowOnboarding(false);
    }
  };

  // Handle profile click when not authenticated
  const handleProfileClick = (e) => {
    if (!isAuthenticated) {
      e.preventDefault();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-[#1A1429] via-[#211937] to-[#06001F]">
      {/* Profile Button */}
      <div className="absolute top-6 right-6 flex gap-2">
        <Link 
          to="/solo-mode"
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Solo Mode"
        >
          <SquareUserRound className="h-6 w-6" />
        </Link>
        
        {isAuthenticated ? (
          <Link 
            to="/profile"
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Profile"
          >
            <User className="h-6 w-6" />
          </Link>
        ) : (
          <Link 
            to="/login"
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Login"
          >
            <User className="h-6 w-6" />
          </Link>
        )}
      </div>

      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-2xl text-center space-y-12">
        {/* Header Section */}
        <div className="space-y-6">
          
          
          <h1 className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            WarpSong
          </h1>
          
          <p className="text-xl text-gray-400">
            Get in the mix.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link 
            to="/scan"
            className="group flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-purple-500/25"
          >
            <QrCode className="mr-1 h-5 w-5 transition-transform group-hover:scale-110" />
            Start Scanning
          </Link>
          <Link 
            to="/stem-player"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-purple-500/30 text-purple-400 font-medium hover:bg-purple-500/10 transition-all"
          >
            <Users className="mr-1 h-5 w-5" />
            Join Session
          </Link>
          <Link 
            to="/solo-mode"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-cyan-500/30 text-cyan-400 font-medium hover:bg-cyan-500/10 transition-all"
          >
            <SquareUserRound className="mr-1 h-5 w-5" />
            Solo Mode
          </Link>
        </div>

        {/* Feature Cards */}
        <div className="bg-white/5 backdrop-blur-sm rounded-3xl p-8 mt-12 grid grid-cols-1 sm:grid-cols-3 gap-8 border border-white/10">
          <div className="text-center space-y-3 p-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto">
              <QrCode className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Scan & Discover</h3>
            <p className="text-gray-400">Unlock unique stems from artists</p>
          </div>
          
          <div className="text-center space-y-3 p-4">
            <div className="w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Mix Together</h3>
            <p className="text-gray-400">Create mashups with other visitors</p>
          </div>
          
          <div className="text-center space-y-3 p-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Music className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Share Your Mix</h3>
            <p className="text-gray-400">Share your creations with the world</p>
          </div>
        </div>
      </div>

      {/* Onboarding Dialog */}
      {showOnboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative bg-[#1A1429]/95 backdrop-blur-lg rounded-2xl max-w-md w-full overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-radial ${onboardingSteps[currentStep].bgClass} opacity-50`} />
            
            <div className="relative z-10 p-6">
              <div className="relative">
                {/* Progress Indicator */}
                <div className="flex justify-center gap-2 mb-8">
                  {onboardingSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-1 w-8 rounded-full transition-all duration-300 ${
                        index === currentStep ? "bg-purple-500" : "bg-gray-600"
                      }`}
                    />
                  ))}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-cyan-500/20 blur-xl" />
                  </div>
                  <div className="relative flex justify-center">
                    {onboardingSteps[currentStep].image}
                  </div>
                </div>

                <h2 className="text-2xl font-bold mt-6 text-center bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                  {onboardingSteps[currentStep].title}
                </h2>

                <p className="text-center mt-4 text-base leading-relaxed text-gray-300">
                  {onboardingSteps[currentStep].description}
                </p>
              </div>

              <div className="flex flex-col items-center mt-8 gap-4">
                <button 
                  onClick={handleNextStep}
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:opacity-90 transition-all shadow-lg shadow-purple-500/25"
                >
                  {currentStep < onboardingSteps.length - 1 ? "Next" : "Begin Your Adventure"}
                </button>

                {currentStep < onboardingSteps.length - 1 && (
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
