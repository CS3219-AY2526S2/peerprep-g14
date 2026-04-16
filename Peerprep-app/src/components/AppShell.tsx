import React from "react";
import "./AppShell.css";

type ShellTheme = "user" | "admin" | "neutral";

interface AppShellProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  className?: string;
  theme?: ShellTheme;
}

const AppShell: React.FC<AppShellProps> = ({
  sidebar,
  header,
  children,
  isSidebarOpen = false,
  onToggleSidebar,
  className = "",
  theme = "neutral",
}) => {
  const hasSidebar = Boolean(sidebar);

  return (
    <div
      className={["app-shell", `app-shell--${theme}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="app-shell__bg" />

      {hasSidebar && (
        <aside
          className={`app-shell__sidebar ${
            isSidebarOpen ? "is-open" : "is-closed"
          }`}
        >
          {sidebar}
        </aside>
      )}

      <div
        className={[
          "app-shell__main",
          theme === "user"
            ? "dotted-card-user"
            : theme === "admin"
              ? "dotted-card-admin"
              : "",
          hasSidebar ? "has-sidebar" : "",
          hasSidebar && isSidebarOpen ? "sidebar-open" : "",
          hasSidebar && !isSidebarOpen ? "sidebar-closed" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {header && (
          <header className="app-shell__header">
            <div className="app-shell__header-content">{header}</div>
          </header>
        )}

        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
