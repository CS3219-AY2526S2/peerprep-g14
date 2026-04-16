import React, { useEffect, useState } from 'react';

interface TranslationNotificationProps {
  language: string | null;
  onDismiss: () => void;
}

const LANG_DISPLAY: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
};

export const TranslationNotification: React.FC<TranslationNotificationProps> = ({
  language,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (language) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [language, onDismiss]);

  if (!isVisible || !language) return null;

  const langDisplay = LANG_DISPLAY[language.toLowerCase()] || language;

  return (
    <div className="translation-notification">
      <div className="translation-notification__content">
        <span className="translation-notification__icon">🔄</span>
        <span>Code translated to <strong>{langDisplay}</strong> by your peer</span>
      </div>
    </div>
  );
};
