import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { Input } from "../components/Input";
import { Button } from "../components/Button";
import { useAuth } from "../context/AuthContext";
import "./LoginLight.css";
import "../layout/Layout.css";

export const LoginLight: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // --- ADD THESE STATES ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // This is for user login with github
  const handleLogin = () => {
    setIsLoading(true);
    window.location.href = "/user/auth/github";
  };

  // This is for admin login only. The code is WRONG.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Determine which endpoint to call
    const endpoint = "/user/admin/login";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Ensure cookies are saved
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      console.log("API Response:", data); // Debugging log
      if (!response.ok) {
        throw new Error(data.message || "Authentication failed");
      }

      // PeerPrep logic: Redirect based on admin status
      if (data.user?.role === "ADMIN" || isAdminMode) {
        login(data.user.id, data.user.role);
        navigate("/admin");
      } else {
        login(data.user.id, data.user.role);
        navigate("/dashboard");
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="linear-gradient-background page-shell">
      <div className="dotted-card">
        <div className="brand-panel">
          <h1 className="brand-text">PeerPrep</h1>
          <h4 className="subtittle-text">
            Preparing you for your next interview
          </h4>
          <img src="/PeerPrep.png" alt="PeerPrep Logo" className="brand-logo" />
        </div>
        <div className="auth-panel">
          <h1 className="welcome-text">Welcome!</h1>
          <h3 className="welcome-text">
            {isAdminMode
              ? "Ready to manage PeerPrep?"
              : "Ready to prep for your next interview?"}
          </h3>
          <div className="welcome-line" />

          {/* Role selector */}
          <div className="role-select-container">
            <button
              type="button"
              className={`role-btn ${!isAdminMode ? "active" : ""}`}
              onClick={() => setIsAdminMode(false)}
            >
              User
            </button>
            <button
              className={`role-btn ${isAdminMode ? "active" : ""}`}
              onClick={() => setIsAdminMode(true)}
            >
              Admin
            </button>
          </div>

          {/* Info form */}
          <form className="login-form">
            {!isAdminMode && (
              <>
                <Button
                  type="button" // Important: prevents handleSubmit from firing
                  onClick={handleLogin} // Your window.location.href function
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 smaller-font-size"
                  variant="secondary"
                  isLoading={isLoading}
                >
                  <span>Sign in with GitHub</span>
                </Button>
              </>
            )}

            {isAdminMode && (
              <>
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@peerprep.com"
                  leftIcon={<Mail className="h-5 w-5" />}
                  required
                />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-5 w-5" />}
                  required
                />
              </>
            )}
          </form>

          {/* Footer */}
          <div className="login-footer">
            {!isAdminMode ? (
              <p className="text-xs text-center text-secondary">
                Secure login provided by GitHub OAuth
              </p>
            ) : (
              <Button
                type="submit"
                size="lg"
                variant="secondary"
                className="w-full flex items-center justify-center smaller-font-size"
                isLoading={isLoading}
                onClick={handleSubmit}
              >
                Sign in
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
