import React from "react";
import "./Header.css";
import { Menu, UserIcon } from "lucide-react";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile";
import { Spinner } from "./Spinner";

type HeaderTheme = "user" | "admin";

interface AppShellHeaderProps {
  theme?: HeaderTheme;
  showToggle?: boolean;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  showProfile?: boolean;
  onClickProfile?: () => void;
  showProfileName?: boolean;
  showProfilePicture?: boolean;
  pageName?: string;
  className?: string;
}

export const Header: React.FC<AppShellHeaderProps> = ({
  theme = "user",
  showToggle = true,
  isSidebarOpen = false,
  onToggleSidebar,
  showProfile = true,
  onClickProfile,
  showProfileName = true,
  showProfilePicture = true,
  pageName = "",
  className = "",
}) => {
  const { data: user, isLoading: profileLoading } = useCurrentUserProfile();

  const displayName =
    theme === "admin" ? (user?.name ?? "Admin") : (user?.name ?? "User Name");

  return (
    <div
      className={["app-shell-header", `app-shell-header--${theme}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="app-shell-header__left">
        {showToggle && (
          <button
            type="button"
            className="app-shell-header__toggle"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <Menu size={18} className="app-shell-header__toggle-icon" />
          </button>
        )}

        {pageName && (
          <div className="app-shell-header__page-name">{pageName}</div>
        )}
      </div>

      <div className="app-shell-header__right">
        {showProfile && (
          <div className="app-shell-header__profile">
            {profileLoading && theme !== "admin" ? (
              <div className="app-shell-header__loading">
                <Spinner spinnerTheme={theme} size="sm" />
                <span className="app-shell-header__loading-text">
                  Retrieving your data...
                </span>
              </div>
            ) : (
              <>
                {showProfileName && (
                  <div className="app-shell-header__user-name">
                    {displayName}
                  </div>
                )}

                {showProfilePicture && (
                  <button
                    type="button"
                    className="app-shell-header__profile-picture"
                    onClick={onClickProfile}
                  >
                    <UserIcon className="h-5 w-5" />
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Header;
