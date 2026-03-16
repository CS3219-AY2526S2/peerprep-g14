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

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
        <label htmlFor={generatedId} className="multi-select-label">
          {label}
        </label>
      )}

      <div ref={containerRef} className="multi-select-container">
        <button
          type="button"
          id={generatedId}
          className={`multi-select-trigger ${error ? "multi-select-error" : ""}`}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <div className="multi-select-trigger-content">
            {leftIcon && (
              <div className="multi-select-icon-left">{leftIcon}</div>
            )}

            <div className={`multi-select-value ${leftIcon && "pl-6"}`}>
              {selectedLabels.length > 0 ? (
                selectedLabels.map((label) => (
                  <span key={label} className="multi-select-chip">
                    {label}
                  </span>
                ))
              ) : (
                <span className="multi-select-placeholder">{placeholder}</span>
              )}
            </div>
          </div>

          <div className="select-icon-right">
            <ChevronDown className="h-4 w-4 text-muted" />
          </div>
        </button>

        {isOpen && (
          <div className="multi-select-dropdown">
            {options.map((option) => {
              const isSelected = value.includes(option.value);

              return (
                <button
                  type="button"
                  key={option.value}
                  className={`multi-select-option ${isSelected ? "selected" : ""}`}
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
