import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import "./MultiSelect.css";

interface SelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  label?: string;
  options: SelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  error?: string;
  leftIcon?: React.ReactNode;
  placeholder?: string;
  className?: string;
  id?: string;
  theme?: "user" | "admin";
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  options,
  value,
  onChange,
  error,
  leftIcon,
  placeholder = "Select options",
  className = "",
  id,
  theme = "user",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const generatedId = id || Math.random().toString(36).substring(7);
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabels = useMemo(() => {
    return options
      .filter((option) => value.includes(option.value))
      .map((option) => option.label);
  }, [options, value]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className={`multi-select-wrapper ${className}`}>
      {label && (
        <label
          htmlFor={generatedId}
          className={`multi-select-label multi-select-label--${theme}`}
        >
          {label}
        </label>
      )}

      <div ref={containerRef} className="multi-select-container">
        <button
          type="button"
          id={generatedId}
          className={[
            "multi-select-trigger",
            `multi-select-trigger--${theme}`,
            error ? "multi-select-error" : "",
            isOpen ? "is-open" : "",
            selectedLabels.length > 0 ? "has-value" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <div className="multi-select-trigger-content">
            {leftIcon && (
              <div
                className={`multi-select-icon-left multi-select-icon-left--${theme}`}
              >
                {leftIcon}
              </div>
            )}

            <div className={`multi-select-value ${leftIcon ? "pl-8" : ""}`}>
              {selectedLabels.length > 0 ? (
                selectedLabels.map((label) => (
                  <span
                    key={label}
                    className={`multi-select-chip multi-select-chip--${theme}`}
                  >
                    {label}
                  </span>
                ))
              ) : (
                <span className="multi-select-placeholder">{placeholder}</span>
              )}
            </div>
          </div>

          <div
            className={`multi-select-icon-right multi-select-icon-right--${theme}`}
          >
            <ChevronDown className="h-4 w-4" />
          </div>
        </button>

        {isOpen && (
          <div
            className={`multi-select-dropdown multi-select-dropdown--${theme}`}
          >
            {options.map((option) => {
              const isSelected = value.includes(option.value);

              return (
                <button
                  type="button"
                  key={option.value}
                  className={[
                    "multi-select-option",
                    `multi-select-option--${theme}`,
                    isSelected ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => toggleOption(option.value)}
                >
                  <span>{option.label}</span>
                  {isSelected && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error && <span className="multi-select-error-msg">{error}</span>}
    </div>
  );
};
