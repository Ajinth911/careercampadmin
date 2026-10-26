import React, { useState } from "react";
import "./AdminLogin.css";
import { useAuth } from "../hooks/useAuth";
import LoadingSpinner from "../components/LoadingSpinner";
import { Lock } from "lucide-react";

export default function AdminLogin({ onLoginSuccess }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await login(email.trim(), password);
      onLoginSuccess();
    } catch (err) {
      setError(err.message || "Failed to authenticate administrator.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = () => {
    setEmail("admin@careerlaunchpad.com");
    setPassword("Admin@123");
    setError("");
  };

  return (
    <div className="login-page-container">
      <div className="login-card">
        <div className="login-header">
          <span className="login-brand-tag">Staff & Security Portal</span>
          <h1 className="login-title">Administrator Sign In</h1>
          <p className="login-subtitle">
            Restricted access for event coordinators and entrance verification staff.
          </p>
        </div>

        {error && (
          <div className="login-error-alert" role="alert">
            {error}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label className="login-label" htmlFor="admin-email">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              className="login-input"
              placeholder="admin@careerlaunchpad.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="admin-pass">
              Password
            </label>
            <input
              id="admin-pass"
              type="password"
              className="login-input"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn-login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <Lock size={15} />
                <span>Sign In to Dashboard</span>
              </>
            )}
          </button>
        </form>

        {Boolean(import.meta.env.DEV) && (
          <div className="login-demo-helper">
            <strong>Default Development Credentials:</strong>
            <div>admin@careerlaunchpad.com / Admin@123</div>
            <button
              type="button"
              className="demo-fill-btn"
              onClick={handleQuickDemoFill}
            >
              Fill Demo Credentials
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
