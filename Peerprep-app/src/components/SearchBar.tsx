import React from "react";
import { Search, X } from "lucide-react";
import "./SearchBar.css";

type SearchBarTheme = "user" | "admin" | "neutral";

interface SearchBarProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange"
> {
  value: string;
  onChange: (value: string) => void;
  theme?: SearchBarTheme;
  placeholder?: string;
  className?: string;
  onClear?: () => void;
  showClearButton?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  theme = "neutral",
  placeholder = "Search",
  className = "",
  onClear,
  showClearButton = true,
  ...props
}) => {
  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    onChange("");
  };

  return (
    <div
      className={["pp-searchbar", `pp-searchbar--${theme}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="pp-searchbar__icon" aria-hidden="true">
        <Search size={20} />
      </span>

      <input
        {...props}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pp-searchbar__input"
      />

      {showClearButton && value.trim() !== "" && (
        <button
          type="button"
          className="pp-searchbar__clear"
          onClick={handleClear}
          aria-label="Clear search"
          title="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
