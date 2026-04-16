import React from "react";
import "./TextArea.css";

type TextAreaTheme = "user" | "admin";
type TextAreaVariant = "solid" | "outline";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  theme?: TextAreaTheme;
  variant?: TextAreaVariant;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  leftIcon,
  rightIcon,
  theme = "user",
  variant = "solid",
  className = "",
  id,
  ...props
}) => {
  const generatedId = id || Math.random().toString(36).substring(7);

  return (
    <div className={`text-area-wrapper ${className}`}>
      {label && (
        <label
          htmlFor={generatedId}
          className={`text-area-label text-area-label--${theme}`}
        >
          {label}
        </label>
      )}

      <div className="text-area-container">
        {leftIcon && (
          <div
            className={`text-area-icon text-area-icon-left text-area-icon--${theme}`}
          >
            {leftIcon}
          </div>
        )}

        <textarea
          id={generatedId}
          className={[
            "text-area-field",
            `text-area-field--${theme}`,
            `text-area-field--${variant}`,
            leftIcon ? "text-area-field--has-left-icon" : "",
            rightIcon ? "text-area-field--has-right-icon" : "",
            error ? "text-area-error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {rightIcon && (
          <div
            className={`text-area-icon text-area-icon-right text-area-icon--${theme}`}
          >
            {rightIcon}
          </div>
        )}
      </div>

      {error && <span className="text-area-error-msg">{error}</span>}
    </div>
  );
};
