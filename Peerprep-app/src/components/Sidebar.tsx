import React from "react";
import "./Sidebar.css";
import { Button } from "./Button";

type SidebarTheme = "user" | "admin";

export interface SidebarItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  isLoading?: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  theme: SidebarTheme;
  logo?: React.ReactNode;
  topItems?: SidebarItem[];
  bottomItems?: SidebarItem[];
  topSlot?: React.ReactNode;
  bottomSlot?: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  theme = "user",
  logo,
  topItems = [],
  bottomItems = [],
  topSlot,
  bottomSlot,
}) => {
  return (
    <aside
      className={`sidebar sidebar--${theme} ${isOpen ? "is-open" : "is-closed"}`}
      data-open={isOpen}
    >
      <div className="sidebar__logo-container">
        <div className="sidebar__logo">PeerPrep</div>
        {theme === "admin" && <div className="sidebar__logo-admin">Admin</div>}
      </div>

      <div className="sidebar__section">
        {topItems.map((item) => (
          <Button
            key={item.key}
            type="button"
            theme={theme}
            variant="selection"
            size="sm"
            selected={item.active}
            onClick={item.onClick}
            leftIcon={item.icon}
            fullWidth
            title={item.label}
            aria-label={item.label}
          >
            {isOpen ? item.label : ""}
          </Button>
        ))}

        {topSlot}
      </div>

      <div className="sidebar__spacer" />

      <div className="sidebar__section">
        {bottomItems.map((item) => (
          <Button
            key={item.key}
            type="button"
            theme={theme}
            variant="solid"
            size="sm"
            isLoading={item.isLoading}
            selected={item.active}
            onClick={item.onClick}
            leftIcon={item.icon}
            fullWidth
            title={item.label}
            aria-label={item.label}
          >
            {isOpen ? item.label : ""}
          </Button>
        ))}

        {bottomSlot}
      </div>
    </aside>
  );
};

export default Sidebar;
