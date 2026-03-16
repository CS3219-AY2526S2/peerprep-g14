import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import "./Select.css";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string;
  onChange: (values: string) => void;
  error?: string;
  leftIcon?: React.ReactNode;
  className?: string;
  id?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  placeholder = "Select option",
  options,
  value,
  onChange,
  error,
  leftIcon,
  className = "",
  id,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const generatedId = id || Math.random().toString(36).substring(7);
  const selectedOption = options.find((option) => option.value === value);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={`select-wrapper ${className}`}>
      {label && (
        <label htmlFor={generatedId} className="select-label">
          {label}
        </label>
      )}

      <div ref={containerRef} className="select-container">
        <button
          type="button"
          id={generatedId}
          className={`select-trigger ${error ? "select-error" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <div className="select-trigger-content">
            {leftIcon && <div className="select-icon-left">{leftIcon}</div>}

            <div className={`select-value ${leftIcon ? "pl-6" : ""}`}>
              <span className="select-placeholder">
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </div>
          </div>

          <div className="select-icon-right">
            <ChevronDown className="h-4 w-4 text-muted" />
          </div>
        </button>

        {isOpen && (
          <div className="select-dropdown">
            {options.map((option) => {
              const isSelected = value == option.value;

              return (
                <button
                  type="button"
                  key={option.value}
                  className={`select-option ${isSelected ? "selected" : ""}`}
                  onClick={() => {onChange(option.value);
                    setIsOpen(false)
                  }}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <span className="select-error-msg">{error}</span>}
    </div>
  );
};
