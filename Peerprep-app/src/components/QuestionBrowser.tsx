import React from "react";
import { Filter, Plus, Trash2 } from "lucide-react";
import QuestionTable, {
  type QuestionDifficulty,
  type QuestionTableTheme,
} from "./QuestionTable";
import InfoCard from "./InfoCard";
import SearchBar from "./SearchBar";
import "./QuestionBrowser.css";
import ToolBarButton from "./ToolBarButton";

export interface QuestionBrowserItem {
  id: string;
  title: string;
  topics: string[];
  difficulty: QuestionDifficulty;
  description?: string;
  constraint?: string;
  expectedOutput?: string;
  imageUrls?: string[];
  matched?: number;
}

interface QuestionBrowserProps {
  theme?: QuestionTableTheme;
  questions: QuestionBrowserItem[];
  selectedQuestionId?: string | null;
  isLoading?: boolean;
  emptyText?: string;
  getTopicLabel?: (value: string) => string;
  onSelectedQuestionChange?: (question: QuestionBrowserItem) => void;
  onEditQuestion?: (question: QuestionBrowserItem) => void;
  onDeleteQuestion?: (question: QuestionBrowserItem) => void;
  onDeleteImage?: (url: string) => void;
  showInfoCard?: boolean;
  infoTitle?: string;

  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  showFilterButton?: boolean;
  onFilterClick?: () => void;

  showAddButton?: boolean;
  onAddClick?: () => void;
}

const defaultTopicLabel = (value: string) => value;

const getDifficultyClass = (difficulty: QuestionDifficulty) => {
  if (difficulty === "easy") return "is-easy";
  if (difficulty === "medium") return "is-medium";
  return "is-hard";
};

const getDifficultyLabel = (difficulty: QuestionDifficulty) =>
  difficulty.charAt(0).toUpperCase() + difficulty.slice(1);

const QuestionBrowser: React.FC<QuestionBrowserProps> = ({
  theme = "user",
  questions,
  selectedQuestionId,
  isLoading = false,
  emptyText = "No questions found.",
  getTopicLabel = defaultTopicLabel,
  onSelectedQuestionChange,
  onEditQuestion,
  onDeleteQuestion,
  showInfoCard = true,
  infoTitle = "Selected Question",
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search question",
  showFilterButton = false,
  onFilterClick,
  showAddButton = false,
  onAddClick,
}) => {
  const selectedQuestion =
    questions.find((question) => question.id === selectedQuestionId) ?? null;

  return (
    <div
      className={[
        "question-browser",
        `question-browser--${theme}`,
        showInfoCard && selectedQuestion ? "has-info-card" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="question-browser__main">
        <div className="question-browser__toolbar">
          <div className="question-browser__search">
            <SearchBar
              theme={theme}
              value={searchValue}
              onChange={(value) => onSearchChange?.(value)}
              placeholder={searchPlaceholder}
            />
          </div>

          <div className="question-browser__toolbar-actions">
            {showFilterButton && (
              <ToolBarButton
                theme={theme}
                onClick={onFilterClick}
                aria-label="Open filters"
                title="Filter"
              >
                <Filter size={24} />
              </ToolBarButton>
            )}

            {showAddButton && (
              <ToolBarButton
                theme={theme}
                onClick={onAddClick}
                aria-label="Add question"
                title="Add question"
              >
                <Plus size={24} />
              </ToolBarButton>
            )}
          </div>
        </div>

        <div className="question-browser__table">
          <QuestionTable
            theme={theme}
            questions={questions}
            isLoading={isLoading}
            emptyText={emptyText}
            selectedRowId={selectedQuestion?.id ?? null}
            onRowClick={onSelectedQuestionChange}
            getTopicLabel={getTopicLabel}
          />
        </div>
      </div>

      {showInfoCard && selectedQuestion && (
        <div className="question-browser__info">
          <InfoCard
            theme={theme}
            title={infoTitle}
            actions={
              selectedQuestion
                ? [
                    ...(onEditQuestion
                      ? [
                          {
                            key: "edit",
                            label: "Edit",
                            onClick: () => onEditQuestion(selectedQuestion),
                            variant: "primary" as const,
                          },
                        ]
                      : []),
                    ...(onDeleteQuestion
                      ? [
                          {
                            key: "delete",
                            icon: <Trash2 size={18} />,
                            onClick: () => onDeleteQuestion(selectedQuestion),
                            variant: "danger" as const,
                            ariaLabel: "Delete question",
                          },
                        ]
                      : []),
                  ]
                : []
            }
          >
            <div className="question-browser__details">
              {theme === "admin" && (
                <div className="question-browser__section">
                  <div className="question-browser__label">ID</div>
                  <div className="question-browser__value">
                    {selectedQuestion.id}
                  </div>
                </div>
              )}

              <div className="question-browser__section">
                <div className="question-browser__label">Name</div>
                <div className="question-browser__value">
                  {selectedQuestion.title}
                </div>
              </div>

              <div className="question-browser__section">
                <div className="question-browser__label">Description</div>
                <div className="question-browser__value question-browser__value--multiline">
                  {selectedQuestion.description?.trim() ||
                    "No description provided."}
                </div>
              </div>

              <div className="question-browser__section">
                <div className="question-browser__label">Constraints</div>
                <div className="question-browser__value question-browser__value--multiline">
                  {selectedQuestion.constraint?.trim() ||
                    "No constraint provided."}
                </div>
              </div>

              <div className="question-browser__section">
                <div className="question-browser__label">Expected Output</div>
                <div className="question-browser__value question-browser__value--multiline">
                  {selectedQuestion.expectedOutput?.trim() ||
                    "No expected output provided."}
                </div>
              </div>

              <div className="question-browser__section">
                <div className="question-browser__label">Topics</div>
                <div className="question-browser__tags">
                  {selectedQuestion.topics.map((topic) => (
                    <span key={topic} className="question-browser__tag">
                      {getTopicLabel(topic)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="question-browser__section">
                <div className="question-browser__label">Difficulty</div>
                <div
                  className={[
                    "question-browser__difficulty",
                    getDifficultyClass(selectedQuestion.difficulty),
                  ].join(" ")}
                >
                  {getDifficultyLabel(selectedQuestion.difficulty)}
                </div>
              </div>

              {selectedQuestion.imageUrls &&
                selectedQuestion.imageUrls.length > 0 && (
                  <div className="question-browser__section">
                    <div className="question-browser__label">Images</div>

                    {theme === "admin" ? (
                      <div className="question-browser__tags">
                        {selectedQuestion.imageUrls.map((url, i) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="question-browser__tag"
                            style={{
                              background: "var(--accent-primary)",
                              color: "white",
                              textDecoration: "none",
                            }}
                          >
                            View Image {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.75rem",
                          marginTop: "0.5rem",
                        }}
                      >
                        {selectedQuestion.imageUrls.map((url, i) => (
                          <div
                            key={url}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.25rem",
                            }}
                          >
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: "block",
                                borderRadius: "8px",
                                overflow: "hidden",
                                border: "1px solid var(--border-color)",
                                backgroundColor: "var(--bg-secondary)",
                              }}
                              title={`View full image ${i + 1}`}
                            >
                              <img
                                src={url}
                                alt={`Reference for ${selectedQuestion.title} ${i + 1}`}
                                style={{
                                  width: "100%",
                                  height: "auto",
                                  maxHeight: "300px",
                                  objectFit: "contain",
                                  display: "block",
                                }}
                              />
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              <div className="question-browser__section">
                <div className="question-browser__label">
                  Number of Attempts
                </div>
                <div className="question-browser__value">
                  {selectedQuestion.matched ?? 0}
                </div>
              </div>
            </div>
          </InfoCard>
        </div>
      )}
    </div>
  );
};

export default QuestionBrowser;
