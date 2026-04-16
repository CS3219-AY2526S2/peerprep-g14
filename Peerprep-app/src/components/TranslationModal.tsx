import React from 'react';

interface TranslationModalProps {
  translatedCode: string;
  targetLanguage: string;
  onReject: () => void;
  onApprove: () => void;
  isVisible: boolean;
}

const LANG_DISPLAY: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
};

export const TranslationModal: React.FC<TranslationModalProps> = ({
  translatedCode,
  targetLanguage,
  onReject,
  onApprove,
  isVisible,
}) => {
  if (!isVisible) return null;

  const langDisplay = LANG_DISPLAY[targetLanguage.toLowerCase()] || targetLanguage;

  return (
    <div className="translation-modal-overlay">
      <div className="translation-modal">
        <div className="translation-modal__header">
          <h2 className="translation-modal__title">
            Translated Code → {langDisplay}
          </h2>
        </div>

        <div className="translation-modal__body">
          <pre className="translation-modal__code">{translatedCode}</pre>
        </div>

        <div className="translation-modal__actions">
          <button
            className="translation-modal__btn translation-modal__btn--reject"
            onClick={onReject}
          >
            Reject
          </button>
          <button
            className="translation-modal__btn translation-modal__btn--approve"
            onClick={onApprove}
          >
            Approve &amp; Save
          </button>
        </div>
      </div>
    </div>
  );
};
