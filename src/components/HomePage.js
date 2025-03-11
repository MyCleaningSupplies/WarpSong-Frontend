import React from "react";
import { Link } from "react-router-dom";
// Import the icons you need from Lucide React
import { Camera, Users, Music, Share2, User } from "lucide-react";

const HomePage = () => {
  return (
    <div
      className="
        relative 
        min-h-screen 
        bg-gradient-to-br 
        from-[#1A1429] 
        via-[#211937] 
        to-[#06001F] 
        text-white 
        overflow-hidden
      "
    >
      {/* Top-right profile button */}
      <div className="absolute top-4 right-4">
        <Link
          to="/profile"
          className="
            flex items-center gap-2 
            px-3 py-2 
            rounded-full 
            bg-white/10 
            backdrop-blur-sm 
            hover:bg-white/20 
            transition-colors
          "
        >
          <User size={18} />
          <span className="text-sm">Profile</span>
        </Link>
      </div>

      {/* Main container */}
      <div className="max-w-screen-xl mx-auto px-4 py-16 flex flex-col items-center">
        {/* Festival gradient logo / Title */}
        <h1
          className="
            text-4xl 
            md:text-5xl 
            font-bold 
            bg-gradient-to-r 
            from-[#8B5CF6] 
            to-[#EC4899] 
            bg-clip-text 
            text-transparent 
            mb-4
          "
        >
          WarpSong
        </h1>
        {/* Subtitle */}
        <p className="text-white/80 text-center max-w-lg mb-8">
          Creëer unieke mashups met WarpSong door je QR-code te scannen
        </p>

        {/* Action Buttons (horizontal on desktop, vertical on mobile) */}
        <div className="flex flex-col md:flex-row gap-4 mb-16">
          <Link
            to="/scan"
            className="
              flex items-center gap-2 
              px-6 py-3 
              rounded-full 
              bg-white/10 
              backdrop-blur-sm 
              hover:bg-white/20 
              transition-colors
            "
          >
            <Camera size={20} />
            <span>Start met Scannen</span>
          </Link>

          <Link
            to="/connect"
            className="
              flex items-center gap-2 
              px-6 py-3 
              rounded-full 
              bg-white/10 
              backdrop-blur-sm 
              hover:bg-white/20 
              transition-colors
            "
          >
            <Users size={20} />
            <span>Deelnemen aan Sessie</span>
          </Link>

          <Link
            to="/solo"
            className="
              flex items-center gap-2 
              px-6 py-3 
              rounded-full 
              bg-white/10 
              backdrop-blur-sm 
              hover:bg-white/20 
              transition-colors
            "
          >
            <Music size={20} />
            <span>Solo Mode</span>
          </Link>
        </div>

        {/* Feature Cards (3-column grid on desktop, 1-column on mobile) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
          {/* Card 1: Scan & Ontdek */}
          <div
            className="
              bg-white/5 
              backdrop-blur-sm 
              rounded-xl 
              p-6 
              flex flex-col items-center 
              text-center
              hover:scale-105 
              transition-transform
            "
          >
            <Camera size={32} className="mb-3" />
            <h3 className="text-lg font-semibold mb-2">Scan & Ontdek</h3>
            <p className="text-sm text-white/70">
              Ontgrendel unieke stems van artiesten
            </p>
          </div>

          {/* Card 2: Samen Mixen */}
          <div
            className="
              bg-white/5 
              backdrop-blur-sm 
              rounded-xl 
              p-6 
              flex flex-col items-center 
              text-center
              hover:scale-105 
              transition-transform
            "
          >
            <Users size={32} className="mb-3" />
            <h3 className="text-lg font-semibold mb-2">Samen Mixen</h3>
            <p className="text-sm text-white/70">
              Maak mashups met andere bezoekers
            </p>
          </div>

          {/* Card 3: Deel je Mix */}
          <div
            className="
              bg-white/5 
              backdrop-blur-sm 
              rounded-xl 
              p-6 
              flex flex-col items-center 
              text-center
              hover:scale-105 
              transition-transform
            "
          >
            <Share2 size={32} className="mb-3" />
            <h3 className="text-lg font-semibold mb-2">Deel je Mix</h3>
            <p className="text-sm text-white/70">
              Deel je creaties met andere fans
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;