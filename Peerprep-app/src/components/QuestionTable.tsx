import React from "react";
import "./QuestionTable.css";
import { Spinner } from "./Spinner";

export type QuestionTableTheme = "user" | "admin";
export type QuestionDifficulty = "easy" | "medium" | "hard";

export interface QuestionTableItem {
  id: string;
  title: string;
  topics: string[];
  difficulty: QuestionDifficulty;
}

interface QuestionTableProps {
  theme?: QuestionTableTheme;
  questions: QuestionTableItem[];
  isLoading?: boolean;
  selectedRowId?: string | null;
  emptyText?: string;
  onRowClick?: (question: QuestionTableItem) => void;
  getTopicLabel?: (value: string) => string;
}

const formatQuestionId = (index: number) => String(index + 1).padStart(3, "0");

const defaultTopicLabel = (value: string) => value;

const formatTopicsPreview = (
  topics: string[],
  getTopicLabel: (value: string) => string,
) => {
  const labels = topics.map(getTopicLabel);

  if (labels.length <= 2) {
    return labels.join(", ");
  }

  return `${labels.slice(0, 2).join(", ")}, ...`;
};

const getDifficultyLabel = (difficulty: QuestionDifficulty) =>
  difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

const QuestionTable: React.FC<QuestionTableProps> = ({
  theme = "user",
  questions,
  isLoading = false,
  selectedRowId = null,
  emptyText = "No questions found.",
  onRowClick,
  getTopicLabel = defaultTopicLabel,
}) => {
  return (
    <div className={`question-table question-table--${theme}`}>
      <div className="question-table__header">
        <div className="question-table__header-cell question-table__header-cell--id">
          No.
        </div>
        <div className="question-table__header-cell question-table__header-cell--name">
          Name
        </div>
        <div className="question-table__header-cell question-table__header-cell--topics">
          Topics
        </div>
        <div className="question-table__header-cell question-table__header-cell--difficulty">
          Difficulty
        </div>
      </div>

      {isLoading ? (
        <div className="question-table__status-container">
          <Spinner size="md" variant="light_muted" spinnerTheme={theme} />
          <div className="question-table__status">Loading questions...</div>
        </div>
      ) : questions.length === 0 ? (
        <div className="question-table__status-container">
          <div className="question-table__status">{emptyText}</div>
        </div>
      ) : (
        <div className="question-table__rows">
          {questions.map((question, index) => {
            const isSelected = selectedRowId && selectedRowId === question.id;

            return (
              <button
                key={question.id}
                type="button"
                className={[
                  "question-table__row",
                  isSelected ? "is-selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={onRowClick ? () => onRowClick(question) : undefined}
              >
                <div className="question-table__row-cell question-table__row-cell--id">
                  {formatQuestionId(index)}
                </div>

                <div className="question-table__row-cell question-table__row-cell--name">
                  {question.title}
                </div>

                <div className="question-table__row-cell question-table__row-cell--topics">
                  {formatTopicsPreview(question.topics, getTopicLabel)}
                </div>

                <div className="question-table__row-cell question-table__row-cell--difficulty">
                  <span
                    className={[
                      "question-table__difficulty-pill",
                      `is-${question.difficulty}`,
                      isSelected ? "is-selected" : "is-unselected",
                    ].join(" ")}
                  >
                    {getDifficultyLabel(question.difficulty)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestionTable;
