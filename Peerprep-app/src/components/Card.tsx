import React from "react";
import "./Card.css";

type CardTheme = "user" | "admin" | "neutral";
type CardHoverTone = "theme" | "light" | "none";
type CardHeaderAlignment = "center" | "left";

interface CardProps {
  children: React.ReactNode;
  logo?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAlign?: CardHeaderAlignment;
  theme?: CardTheme;
  showDivider?: boolean;
  hoverTone?: CardHoverTone;
  floating?: boolean;
  className?: string;
  contentClassName?: string;
  fullWidth?: boolean;
  fullHeight?: boolean;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  theme = "neutral",
  children,
  logo,
  title,
  subtitle,
  headerAlign = "left",
  showDivider = false,
  hoverTone = "theme",
  floating = false,
  className = "",
  contentClassName = "",
  fullWidth = true,
  fullHeight = false,
  onClick,
}) => {
  const classes = [
    "pp-card",
    `pp-card--${theme}`,
    `pp-card--hover-${hoverTone}`,
    `pp-card--header-${headerAlign}`,
    fullWidth ? "pp-card--full-width" : "",
    fullHeight ? "pp-card--full-height" : "",
    floating ? "pp-card--floating" : "",
    onClick ? "pp-card--clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} onClick={onClick}>
      {(title || subtitle) && (
        <div className="pp-card--header">
          <div className="pp-card--title-container">
            {logo && <div className="pp-card--title-logo">{logo}</div>}

            <div className="pp-card--title">{title}</div>
          </div>
          <div className="pp-card--subtitle">{subtitle}</div>
        </div>
      )}
      {showDivider && (
        <div className="pp-card--divider-container">
          <div className="pp-card--divider" />
        </div>
      )}

      <div className={`pp-card--content ${contentClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
};

export default Card;
