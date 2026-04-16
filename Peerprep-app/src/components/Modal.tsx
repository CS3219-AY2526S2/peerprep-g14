import React, { useEffect } from "react";
import { X } from "lucide-react";
import "./Modal.css";

type ModalTheme = "admin" | "user" | "neutral";
type TitleAlign = "center" | "left";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleAlign?: TitleAlign;
  children: React.ReactNode;
  footer?: React.ReactNode;
  theme?: ModalTheme;
  hasCloseButton?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  titleAlign = "left",
  hasCloseButton = true,
  children,
  footer,
  theme = "neutral",
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay modal-overlay--${theme} animate-fade-in`}
      onClick={onClose}
    >
      <div
        className={`modal-container modal-container--${theme}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          className={`modal-header modal-header-${hasCloseButton ? "" : titleAlign}`}
        >
          <h2 id="modal-title" className="modal-title">
            {title}
          </h2>

          {hasCloseButton && (
            <button
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="modal-content">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};
