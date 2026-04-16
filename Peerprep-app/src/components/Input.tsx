import React from "react";
import "./Input.css";

type InputTheme = "user" | "admin";
type InputVariant = "solid" | "outline";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  theme?: InputTheme;
  variant?: InputVariant;
}

export const Input: React.FC<InputProps> = ({
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
    <div className={`input-wrapper ${className}`}>
      {label && (
        <label
          htmlFor={generatedId}
          className={`input-label input-label--${theme}`}
        >
          {label}
        </label>
      )}

      <div className="input-container">
        {leftIcon && (
          <div className={`input-icon input-icon-left input-icon--${theme}`}>
            {leftIcon}
          </div>
        )}

        <input
          id={generatedId}
          className={[
            "input-field",
            `input-field--${theme}`,
            `input-field--${variant}`,
            leftIcon ? "input-field--has-left-icon" : "",
            rightIcon ? "input-field--has-right-icon" : "",
            error ? "input-field--error" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {rightIcon && (
          <div className={`input-icon input-icon-right input-icon--${theme}`}>
            {rightIcon}
          </div>
        )}
      </div>

      {error && <span className="input-error-msg">{error}</span>}
    </div>
  );
};
