import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const navigate = useNavigate();
  
  return (
    <header className="rounded-xl p-4 mb-8 flex items-center justify-between bg-white/5 backdrop-blur-sm">
      <button onClick={() => navigate(-1)} className="hover:scale-105 transition-transform">
        <span className="text-xl">← Terug</span>
      </button>
      <div className="w-12" /> {/* For balance */}
    </header>
  );
};

export default Header;
