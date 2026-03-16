import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Matching } from "./pages/Matching";
import { Workspace } from "./pages/Workspace";
import { AdminDashboard } from "./pages/AdminDashboard";
import { ProfileSetup } from "./pages/ProfileSetup";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Query, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";

// A component to protect routes that require authentication
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  adminOnly?: boolean;
}> = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: "100vh", color: "white" }}>
        Loading...
      </div>
    ); // Could replace with a better spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && userRole !== "ADMIN") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

// A component to redirect authenticated users away from public routes (like login)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: "100vh", color: "white" }}>
        Loading...
      </div>
    );
  }

  if (isAuthenticated) {
    return userRole === "ADMIN" ? (
      <Navigate to="/admin" replace />
    ) : (
      <Navigate to="/dashboard" replace />
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  // Adding a simple effect to log that the app initialized successfully
  useEffect(() => {
    console.log("PeerPrep Frontend Initialized - Powered by React & Vite");
  }, []);

  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <div className="app-wrapper">
            <main className="main-content">
              <Routes>
                {/* Public route */}
                <Route
                  path="/"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />

                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/matching"
                  element={
                    <ProtectedRoute>
                      <Matching />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workspace"
                  element={
                    <ProtectedRoute>
                      <Workspace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile-setup"
                  element={
                    <ProtectedRoute>
                      <ProfileSetup />
                    </ProtectedRoute>
                  }
                />

                {/* Admin route */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute adminOnly>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
