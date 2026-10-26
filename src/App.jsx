import React, { useState, useEffect } from "react";
import "./App.css";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import Navbar from "./components/Navbar";
import RegistrationPage from "./pages/RegistrationPage";
import RegistrationSuccess from "./pages/RegistrationSuccess";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ScannerPage from "./pages/ScannerPage";
import LoadingSpinner from "./components/LoadingSpinner";

function getNormalizedPath() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path;
}

function AppContent() {
  const { isAuthenticated, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(getNormalizedPath());
  const [confirmedRegistration, setConfirmedRegistration] = useState(null);

  // Synchronize browser history / back / forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(getNormalizedPath());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, "", path);
    }
    setCurrentPath(path);
    window.scrollTo(0, 0);
  };

  if (loading) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LoadingSpinner size="lg" text="Loading Career Launchpad..." />
      </div>
    );
  }

  const handleSuccessRegistration = (regData) => {
    setConfirmedRegistration(regData);
    navigate("/success");
  };

  // Route mapping and protection
  const isAdminLogin = currentPath === "/admin/login";
  const isAdminDashboard = currentPath === "/admin" || currentPath === "/admin/dashboard";
  const isScanner = currentPath === "/admin/scanner";
  const isSuccess = currentPath === "/success";

  return (
    <div className="app-layout">
      <Navbar currentPath={currentPath} onNavigate={navigate} />

      <main className="app-main">
        {isAdminLogin && (
          <AdminLogin
            onLoginSuccess={() => navigate("/admin/dashboard")}
          />
        )}

        {isAdminDashboard && (
          isAuthenticated ? (
            <AdminDashboard onNavigateToScanner={() => navigate("/admin/scanner")} />
          ) : (
            <AdminLogin
              onLoginSuccess={() => navigate("/admin/dashboard")}
            />
          )
        )}

        {isScanner && (
          isAuthenticated ? (
            <ScannerPage onBackToDashboard={() => navigate("/admin/dashboard")} />
          ) : (
            <AdminLogin
              onLoginSuccess={() => navigate("/admin/scanner")}
            />
          )
        )}

        {isSuccess && (
          <RegistrationSuccess
            registration={confirmedRegistration}
            onRegisterAnother={() => navigate("/register")}
          />
        )}

        {!isAdminLogin && !isAdminDashboard && !isScanner && !isSuccess && (
          <RegistrationPage onSuccessRegistration={handleSuccessRegistration} />
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <div>
            <span className="footer-brand">CAREER LAUNCHPAD</span> &copy; 2026. All rights reserved.
          </div>
          <div className="footer-tagline">
            Your next opportunity starts here.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
