import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post("http://localhost:3001/api/auth/login", { username, password });
      localStorage.setItem("token", data.token);
      navigate("/profile"); // Redirect to profile on success
    } catch (err) {
      setError("Invalid credentials. Try again!");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-b from-blue-700 to-indigo-500 p-6 text-white">
      <h1 className="text-3xl font-bold">🔑 Login</h1>

      <form onSubmit={handleLogin} className="w-full max-w-md mt-6 bg-white/10 backdrop-blur-lg p-6 rounded-2xl shadow-xl">
        {error && <p className="text-red-500">{error}</p>}

        <input 
          type="text" 
          placeholder="Username" 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          className="w-full p-2 mt-4 rounded-lg text-black"
          required 
        />

        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="w-full p-2 mt-4 rounded-lg text-black"
          required 
        />

        <button 
          type="submit" 
          className="w-full mt-6 bg-green-500 hover:bg-green-600 py-2 rounded-lg"
        >
          🚀 Login
        </button>

        <button 
          onClick={() => navigate("/register")} 
          className="mt-4 text-sm text-gray-300"
        >
          ➕ Create Account
        </button>
      </form>
    </div>
  );
};

export default Login;