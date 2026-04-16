import React from 'react';

interface ExplainModalProps {
  explanation: string;
  onClose: () => void;
  isVisible: boolean;
}

export const ExplainModal: React.FC<ExplainModalProps> = ({
  explanation,
  onClose,
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className="translation-modal-overlay">
      <div className="translation-modal" style={{ maxWidth: '600px' }}>
        <div className="translation-modal__header">
          <h2 className="translation-modal__title">
            Code Explanation
          </h2>
        </div>

        <div className="translation-modal__body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '0.95rem', color: '#e2e8f0' }}>
            {explanation}
          </div>
        </div>

        <div className="translation-modal__actions" style={{ justifyContent: 'flex-end' }}>
          <button
            className="translation-modal__btn translation-modal__btn--approve"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
