import React from "react";
import { BrowserRouter as Router, Route, Routes, Link } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPanel from "./components/AdminPanel";
import Login from "./components/Login";
import StemPlayer from './components/StemPlayer';
import HomePage from "./components/HomePage";
import ScanPage from "./components/ScanPage";
import SoloModePlayer from "./components/SoloModePlayer";
import ProfileCreation from "./components/ProfileCreation";
import Connect from "./components/Connect";
import Profile from "./components/Profile";
import MashupSuccess from "./components/MashupSuccess";

import { API_BASE_URL, SOCKET_URL } from './config/api';

console.log("API_BASE_URL:", API_BASE_URL);
console.log("SOCKET_URL:", SOCKET_URL);

const App = () => {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/profile-creation" element={<ProfileCreation />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/stem-player" element={<StemPlayer />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/solo-mode" element={<SoloModePlayer />} />
            
            {/* Protect the profile route */}
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            
            {/* Protect the mashup success route */}
            <Route
              path="/mashup-success"
              element={
                <ProtectedRoute>
                  <MashupSuccess />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
};

export default App;
