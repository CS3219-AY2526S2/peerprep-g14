import React from "react";
import "./InfoCard.css";

type InfoCardTheme = "user" | "admin";

interface InfoCardAction {
  key: string;
  label?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "danger" | "ghost";
  ariaLabel?: string;
}

interface InfoCardProps {
  theme?: InfoCardTheme;
  title: React.ReactNode;
  actions?: InfoCardAction[];
  children: React.ReactNode;
  className?: string;
  empty?: boolean;
}

const InfoCard: React.FC<InfoCardProps> = ({
  theme = "user",
  title,
  actions = [],
  children,
  className = "",
  empty = false,
}) => {
  return (
    <section
      className={[
        "info-card",
        `info-card--${theme}`,
        empty ? "is-empty" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="info-card__header">
        <div className="info-card__title-container">
          <div className="info-card__title">{title}</div>
        </div>

        {actions.length > 0 && (
          <div className="info-card__actions">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                className={[
                  "info-card__action",
                  `info-card__action--${action.variant ?? "ghost"}`,
                ].join(" ")}
                onClick={action.onClick}
                aria-label={action.ariaLabel ?? action.label}
                title={action.label}
              >
                {action.icon && (
                  <span className="info-card__action-icon">{action.icon}</span>
                )}
                {action.label && (
                  <span className="info-card__action-label">
                    {action.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="info-card__divider" />

      <div className="info-card__body">{children}</div>
    </section>
  );
};

export default InfoCard;
