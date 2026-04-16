import React from "react";
import "./ToolBarButton.css";

type ToolbarButtonTheme = "user" | "admin" | "neutral";

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  theme?: ToolbarButtonTheme;
  children: React.ReactNode;
  className?: string;
}

const ToolBarButton: React.FC<ToolbarButtonProps> = ({
  theme = "neutral",
  children,
  className = "",
  type = "button",
  ...props
}) => {
  return (
    <button
      type={type}
      className={["toolbar-button", `toolbar-button--${theme}`, className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </button>
  );
};

export default ToolBarButton;
