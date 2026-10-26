import React from "react";
import "./Navbar.css";
import { useAuth } from "../hooks/useAuth";

export default function Navbar({ currentPath, onNavigate }) {
  const { adminUser, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate("/admin/login");
  };

  const isRegisterActive = currentPath === "/" || currentPath === "/register";
  const isDashboardActive = currentPath === "/admin" || currentPath === "/admin/dashboard";
  const isScannerActive = currentPath === "/admin/scanner";

  return (
    <header className="navbar">
      <div className="navbar-brand" onClick={() => onNavigate("/register")}>
        <div className="brand-icon">CL</div>
        <div className="brand-info">
          <span className="brand-title">CAREER LAUNCHPAD</span>
          <span className="brand-subtitle">Your next opportunity starts here.</span>
        </div>
      </div>

      <nav className="navbar-nav">
        <button
          type="button"
          className={`nav-link ${isRegisterActive ? "active" : ""}`}
          onClick={() => onNavigate("/register")}
        >
          Registration
        </button>

        {!isAuthenticated ? (
          <button
            type="button"
            className={`nav-link ${currentPath.startsWith("/admin") ? "active" : ""}`}
            onClick={() => onNavigate("/admin/login")}
          >
            Admin Portal
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`nav-link ${isDashboardActive ? "active" : ""}`}
              onClick={() => onNavigate("/admin/dashboard")}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`nav-link ${isScannerActive ? "active" : ""}`}
              onClick={() => onNavigate("/admin/scanner")}
            >
              QR Scanner
            </button>
            <div className="nav-admin-badge" title={adminUser?.email || "Admin"}>
              <span className="admin-dot" />
              <span>Admin: {adminUser?.fullName?.split(" ")[0] || "User"}</span>
            </div>
            <button
              type="button"
              className="nav-logout-btn"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
