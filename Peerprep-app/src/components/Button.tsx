import React from "react";
import "./Button.css";

type ButtonTheme = "user" | "admin" | "neutral";
type ButtonVariant = "solid" | "selection" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  children: React.ReactNode;
  theme?: ButtonTheme;
  variant?: ButtonVariant;
  size?: ButtonSize;
  selected?: boolean;
  fullWidth?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  type?: "button" | "submit" | "reset";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  theme = "neutral",
  variant = "solid",
  size = "md",
  selected = false,
  fullWidth = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  className = "",
  disabled,
  type = "button",
  ...props
}) => {
  const classes = [
    "pp-btn",
    `pp-btn--${theme}`,
    `pp-btn--${variant}`,
    `pp-btn--${size}`,
    selected ? "is-selected" : "",
    fullWidth ? "pp-btn--full-width" : "",
    isLoading ? "is-loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || isLoading}
      aria-pressed={variant === "selection" ? selected : undefined}
      {...props}
    >
      {leftIcon && <span className="pp-btn__icon">{leftIcon}</span>}
      <span className="pp-btn__label">{children}</span>
      {rightIcon && <span className="pp-btn__icon">{rightIcon}</span>}
    </button>
  );
};
