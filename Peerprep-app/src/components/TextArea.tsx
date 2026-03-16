import React from "react";
import "./TextArea.css";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  leftIcon,
  className = "",
  id,
  ...props
}) => {
  const generatedId = id || Math.random().toString(36).substring(7);

  return (
    <div className={`text-area-wrapper ${className}`}>
      {label && (
        <label htmlFor={generatedId} className="text-area-label">
          {label}
        </label>
      )}
      <div className="text-area-container">
        {leftIcon && <div className="text-area-icon-left">{leftIcon}</div>}
        <textarea
          id={generatedId}
          className={`text-area-field ${leftIcon ? "pl-10" : ""} ${error ? "text-area-error" : ""}`}
          {...props}
        />
      </div>
      {error && <span className="text-area-error-msg">{error}</span>}
    </div>
  );
};
