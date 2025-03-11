import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/api";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState({ type: "", text: "" });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password });
      localStorage.setItem("token", data.token);
      
      // Check if user is admin and redirect accordingly
      if (data.isAdmin) {
        navigate("/admin");
      } else {
        // Redirect to home screen instead of profile
        navigate("/");
      }
    } catch (err) {
      setError("Invalid credentials. Try again!");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    if (resetEmail) {
      setResetMessage({
        type: "success",
        text: "Password reset link sent to your email"
      });
      setTimeout(() => {
        setForgotPasswordOpen(false);
        setResetMessage({ type: "", text: "" });
      }, 2000);
    } else {
      setResetMessage({
        type: "error",
        text: "Please enter your email address"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A1429] via-[#211937] to-[#06001F] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent mb-2">WarpSong</h1>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-gray-200">
                Username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your username"
                  required
                  className="w-full p-2 pl-10 bg-white/10 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
        
          
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full p-2 pl-10 bg-white/10 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 px-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-purple-500/25 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="border-t border-white/10 my-6"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-[#211937] px-2 text-sm text-gray-400">OR</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-gray-400">
                Don't have an account?
                <button
                  type="button"
                  onClick={() => navigate("/scan")}
                  className="ml-2 text-purple-400 hover:underline"
                >
                  Scan your ticket!
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {forgotPasswordOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#1A1429] rounded-2xl p-6 max-w-md w-full border border-white/10 shadow-xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-white">Reset your password</h3>
              <p className="text-gray-400 text-sm mt-1">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
            
            <form onSubmit={handleForgotPassword}>
              <div className="space-y-4">
                {resetMessage.text && (
                  <div className={`p-3 rounded-lg text-sm ${
                    resetMessage.type === "success" 
                      ? "bg-green-500/20 border border-green-500/50 text-green-200" 
                      : "bg-red-500/20 border border-red-500/50 text-red-200"
                  }`}>
                    {resetMessage.text}
                  </div>
                )}
                
                <div className="space-y-2">
                  <label htmlFor="reset-email" className="text-sm font-medium text-gray-200">
                    Email
                  </label>
                  <div className="relative">
                    <input
                      id="reset-email"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      required
                      className="w-full p-2 pl-10 bg-white/10 border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setForgotPasswordOpen(false)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-purple-500/25"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
