import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import AppShell from "../components/AppShell";
import Sidebar from "../components/Sidebar";
import { Header } from "../components/Header";
import { useAuth } from "../context/AuthContext";

type LayoutProps = {
  showHeader?: boolean;
  showSidebar?: boolean;
};

const AdminLayout: React.FC<LayoutProps> = ({
  showHeader = true,
  showSidebar = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, userRole } = useAuth();

  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleProfile = async () => {
    navigate("admin/profile");
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const topItems = [
    {
      key: "questions",
      label: "Questions",
      active: location.pathname.startsWith("/admin/questions"),
      onClick: () => navigate("/admin/questions"),
    },
    {
      key: "users",
      label: "Users",
      active: location.pathname.startsWith("/admin/users"),
      onClick: () => navigate("/admin/users"),
    },
    // "Admins" tab is only visible to super admins
    ...(isSuperAdmin
      ? [
          {
            key: "admins",
            label: "Admins",
            active: location.pathname.startsWith("/admin/admins"),
            onClick: () => navigate("/admin/admins"),
          },
        ]
      : []),
  ];

  const pageNameMap: Record<string, string> = {
    "/admin/questions": "Questions",
    "/admin/users": "Users",
    "/admin/admins": "Admins",
  };

  const pageName =
    Object.entries(pageNameMap).find(([path]) =>
      location.pathname.startsWith(path),
    )?.[1] ?? "";

  const bottomItems = [
    {
      key: "logout",
      label: "Logout",
      onClick: handleLogout,
      isLoading: isLoggingOut,
    },
  ];

  return (
    <AppShell
      theme="admin"
      isSidebarOpen={isSidebarOpen}
      onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
      sidebar={
        showSidebar ? (
          <Sidebar
            theme="admin"
            isOpen={isSidebarOpen}
            topItems={topItems}
            bottomItems={bottomItems}
          />
        ) : null
      }
      header={
        showHeader ? (
          <Header
            theme="admin"
            showToggle={showSidebar}
            isSidebarOpen={isSidebarOpen}
            onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
            showProfile
            onClickProfile={handleProfile}
            showProfileName
            showProfilePicture
            pageName={pageName}
          />
        ) : null
      }
    >
      <Outlet />
    </AppShell>
  );
};

export default AdminLayout;
