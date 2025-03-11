import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Camera, Users, Music, Share2, User, Sparkles, QrCode, Play, SquareUserRound } from "lucide-react";

const HomePage = () => {
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);

  const onboardingSteps = [
    {
      title: "Welkom bij WarpSong!",
      description: "Maak je eigen unieke festival mashups door stems te verzamelen van verschillende artiesten. Begin je muzikale avontuur!",
      image: <Music className="w-12 h-12 text-festival-purple mb-4 animate-bounce" />,
      bgClass: "from-festival-purple/20 via-festival-pink/10 to-transparent"
    },
    {
      title: "Verzamel Stems",
      description: "Scan je QR-code bij verschillende podia om stems van optredens te verzamelen. Elke artiest voegt iets unieks toe aan jouw mix!",
      image: <QrCode className="w-12 h-12 text-festival-pink mb-4 animate-pulse" />,
      bgClass: "from-festival-pink/20 via-festival-purple/10 to-transparent"
    },
    {
      title: "Maak je Eerste Mix",
      description: "Net als bij BeReal, kun je pas andere mixen beluisteren nadat je je eerste eigen mix hebt gemaakt. Begin met scannen om je eerste stems te verzamelen!",
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden bg-gradient-to-br from-[#1A1429] via-[#211937] to-[#06001F]">
      {/* Profile Button */}
      <div className="absolute top-6 right-6 flex gap-2">
        <Link 
          to="/solo"
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Solo Mode"
        >
          <SquareUserRound className="h-6 w-6" />
        </Link>
        <Link 
          to="/profile"
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Profile"
        >
          <User className="h-6 w-6" />
        </Link>
      </div>

      {/* Background Gradient Orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/4 -left-48 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse" />
      </div>

      <div className="max-w-2xl text-center space-y-12">
        {/* Header Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 text-sm font-medium text-purple-400 space-x-2">
            <Sparkles className="w-4 h-4" />
            <span>WarpSong</span>
          </div>
          
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
            Start met Scannen
          </Link>
          <Link 
            to="/connect"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-purple-500/30 text-purple-400 font-medium hover:bg-purple-500/10 transition-all"
          >
            <Users className="mr-1 h-5 w-5" />
            Deelnemen aan Sessie
          </Link>
          <Link 
            to="/solo"
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
            <h3 className="text-lg font-semibold">Scan & Ontdek</h3>
            <p className="text-gray-400">Ontgrendel unieke stems van artiesten</p>
          </div>
          
          <div className="text-center space-y-3 p-4">
            <div className="w-14 h-14 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Samen Mixen</h3>
            <p className="text-gray-400">Maak mashups met andere bezoekers</p>
          </div>
          
          <div className="text-center space-y-3 p-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Music className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">Deel je Mix</h3>
            <p className="text-gray-400">Deel je creaties met de wereld</p>
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
                  {currentStep < onboardingSteps.length - 1 ? "Volgende" : "Begin je Avontuur"}
                </button>

                {currentStep < onboardingSteps.length - 1 && (
                  <button
                    onClick={() => setShowOnboarding(false)}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Overslaan
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
