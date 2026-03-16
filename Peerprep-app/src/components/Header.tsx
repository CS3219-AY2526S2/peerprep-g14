import React from "react";
import "./Header.css";
import { Database, Laptop, LogOut, LogOutIcon, UserIcon } from "lucide-react";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile";
import { Spinner } from "./Spinner";
import { Button } from "./Button";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

interface Headers {
  className?: String;
  logo?: boolean;
  brandName?: boolean;
  profile?: boolean;
  signout?: boolean;
  admin?: boolean;
}

export const Header: React.FC<Headers> = ({
  className = "",
  logo = false,
  brandName = false,
  profile = false,
  signout = false,
  admin = false,
}) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    data: user,
    isLoading: profileLoading,
    error: profileError,
  } = useCurrentUserProfile();
  // TODO
  // Handle profileError

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className={`header${admin ? "-admin" : ""} ${className}`}>
      <div className="brand-container">
        {logo && (
          <div className="brand-icon-sm">
            {admin ? (
              <Database className="h-5 w-5 text-white" />
            ) : (
              <Laptop className="h-5 w-5 text-white" />
            )}
          </div>
        )}

        {brandName && (
          <div className="brand-text-header">{`PeerPrep ${admin ? "Admin" : ""}`}</div>
        )}
      </div>

      <div className="right-side">
        {profile && (
          <div className="profile-container">
            {profileLoading && (
              <div className="load-profile-container-row">
                <div className="loading-profile-text">
                  Retrieving your name...
                </div>
                <Spinner size="lg" />
              </div>
            )}

            <>
              {admin ? (
                <div className="user-name">Admin</div>
              ) : (
                <div className="user-name">{user?.name ?? "User Name"}</div>
              )}
              <div className="profile-picture">
                <UserIcon className="h-5 w-5" />
              </div>
            </>
          </div>
        )}

        {signout && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            leftIcon={<LogOutIcon className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        )}
      </div>
    </div>
  );
};
