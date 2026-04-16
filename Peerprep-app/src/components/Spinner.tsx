import React from "react";
import { Loader2 } from "lucide-react";
import "./Spinner.css";

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  variant?: "light" | "light_muted" | "white";
  spinnerTheme: "user" | "admin" | "neutral";
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = "md",
  variant = "white",
  className = "",
  spinnerTheme = "neutral",
}) => {
  const sizeMap = {
    sm: "1rem",
    md: "1.5rem",
    lg: "2.5rem",
    xl: "4rem",
  };

  const variantClassMap = {
    light: "text-light",
    light_muted: "text-light-muted",
    white: "text-white",
  };

  const currentSize = sizeMap[size];
  const currentVariantClass = variantClassMap[variant];

  return (
    <div className={`spinner-container spinner--${spinnerTheme} ${className}`}>
      <Loader2
        style={{ width: currentSize, height: currentSize }}
        className={`animate-spin ${currentVariantClass}`}
      />
    </div>
  );
};
