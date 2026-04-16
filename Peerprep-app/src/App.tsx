import React, { useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Dashboard } from "./pages/Dashboard";
import { Matching } from "./pages/Matching";
import { Workspace } from "./pages/Workspace";
import { ProfileSetup } from "./pages/ProfileSetup";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./App.css";
import { Login } from "./pages/Login";
import Questions from "./pages/Questions";
import AdminUsers from "./pages/AdminUsers";
import AdminAdmins from "./pages/AdminAdmins";
import UserLayout from "./layouts/UserLayout";
import AdminLayout from "./layouts/AdminLayout";
import { ProfileCustomisation } from "./pages/ProfileCustomisation";

// Helper: is the role an admin-level role?
const isAdminRole = (role: string | null) =>
  role === "ADMIN" || role === "SUPER_ADMIN";

// A component to protect routes that require authentication
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}> = ({ children, adminOnly = false, superAdminOnly = false }) => {
  const { isAuthenticated, isLoading, userRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: "100vh", color: "white" }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (superAdminOnly && userRole !== "SUPER_ADMIN") {
    return <Navigate to="/admin/questions" replace />;
  }

  if (adminOnly && !isAdminRole(userRole)) {
    return <Navigate to="/user/dashboard" replace />;
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
    return isAdminRole(userRole) ? (
      <Navigate to="/admin/questions" replace />
    ) : (
      <Navigate to="/user/dashboard" replace />
    );
  }

  return <>{children}</>;
};

const App: React.FC = () => {
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

                {/* User routes w/ AppShell (Header & Sidebar) */}
                <Route element={<UserLayout showHeader showSidebar />}>
                  {/* User routes */}
                  <Route
                    path="/user/dashboard"
                    element={
                      <ProtectedRoute>
                        <Dashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/user/questions"
                    element={
                      <ProtectedRoute>
                        <Questions theme="user" />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* User routes w/ AppShell (no Header & sidebar) */}
                <Route
                  element={
                    <UserLayout showHeader={false} showSidebar={false} />
                  }
                >
                  <Route
                    path="user/profile"
                    element={
                      <ProtectedRoute>
                        <ProfileCustomisation />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* User routes w/o AppShell */}
                <Route>
                  <Route
                    path="/profile-setup"
                    element={
                      <ProtectedRoute>
                        <ProfileSetup />
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
                </Route>

                {/* User routes w/ AppShell (Header & Sidebar) */}
                <Route element={<AdminLayout showHeader showSidebar />}>
                  <Route
                    path="/admin/questions"
                    element={
                      <ProtectedRoute adminOnly>
                        <Questions theme="admin" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <ProtectedRoute adminOnly>
                        <AdminUsers />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin/admins"
                    element={
                      <ProtectedRoute superAdminOnly>
                        <AdminAdmins />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* Admin routes w/ AppShell (no Header & sidebar) */}
                <Route
                  element={
                    <AdminLayout showHeader={false} showSidebar={false} />
                  }
                >
                  <Route
                    path="admin/profile"
                    element={
                      <ProtectedRoute>
                        <ProfileCustomisation />
                      </ProtectedRoute>
                    }
                  />
                </Route>

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
