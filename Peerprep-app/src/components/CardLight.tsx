import React from "react";
import "./CardLight.css";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const CardLight: React.FC<CardProps> = ({
  children,
  className = "",
  glow = false,
}) => {
  return (
    <div className={`card ${glow ? "card-glow" : ""} ${className}`}>
      {children}
    </div>
  );
};
