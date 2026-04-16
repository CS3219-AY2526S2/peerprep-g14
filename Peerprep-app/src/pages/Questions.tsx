import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

import QuestionBrowser from "../components/QuestionBrowser";
import QuestionImageManager from "../components/QuestionImageManager";
import { uploadQuestionImage, deleteQuestionImage } from "../firebaseClient";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { TextArea } from "../components/TextArea";
import { MultiSelect } from "../components/MultiSelect";

import {
  fetchQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../../BackendClient";

import "./Questions.css";
import { MATCH_TOPIC_OPTIONS } from "../constants/matchTopics";

type QuestionsTheme = "admin" | "user";

interface QuestionsPageProps {
  theme?: QuestionsTheme;
}

interface Question {
  id: string;
  title: string;
  topics: string[];
  difficulty: "easy" | "medium" | "hard";
  description?: string;
  constraint?: string;
  expectedOutput?: string;
  imageUrls: string[];
  matched: number;
}

const Questions: React.FC<QuestionsPageProps> = ({ theme = "user" }) => {
  const isAdmin = theme === "admin";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null,
  );
  const [searchValue, setSearchValue] = useState("");

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(
    null,
  );

  const [formData, setFormData] = useState<Omit<Question, "id">>({
    title: "",
    topics: [],
    difficulty: "easy",
    description: "",
    constraint: "",
    expectedOutput: "",
    imageUrls: [],
    matched: 0,
  });

  const getTopicLabel = (value: string) => {
    const topic = MATCH_TOPIC_OPTIONS.find((t) => t.value === value);
    return topic ? topic.label : value;
  };

  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchQuestions();
      setQuestions(data);
      console.log(data);
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  const filteredQuestions = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return questions;

    return questions.filter((question) => {
      return (
        question.title.toLowerCase().includes(q) ||
        question.topics.some((topic) =>
          getTopicLabel(topic).toLowerCase().includes(q),
        )
      );
    });
  }, [questions, searchValue]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setNewImageFiles([]);
    setFormData({
      title: "",
      topics: [],
      difficulty: "easy",
      description: "",
      constraint: "",
      expectedOutput: "",
      imageUrls: [],
      matched: 0,
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (question: any) => {
    setEditingId(question.id);
    setNewImageFiles([]);
    setFormData({
      title: question.title,
      topics: [...question.topics],
      difficulty: question.difficulty,
      description: question.description || "",
      constraint: question.constraint || "",
      expectedOutput: question.expectedOutput || "",
      imageUrls: question.imageUrls || [],
      matched: question.matched || 0,
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDelete = (question: any) => {
    setQuestionToDelete(question);
    setIsDeleteModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!formData.title || formData.topics.length === 0) return;

    setIsSaving(true);
    try {
      let finalId = editingId;
      const storageId = finalId || uuidv4();

      const originalUrls = editingId
        ? questions.find((q) => q.id === editingId)?.imageUrls || []
        : [];
      const removedUrls = originalUrls.filter(
        (url) => !formData.imageUrls.includes(url),
      );

      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) {
        const uploads = newImageFiles.map((file) =>
          uploadQuestionImage(storageId, file),
        );
        uploadedUrls = await Promise.all(uploads);
      }

      if (removedUrls.length > 0) {
        await Promise.all(
          removedUrls.map((url) =>
            deleteQuestionImage(url).catch(console.error),
          ),
        );
      }

      const finalImageUrls = [...formData.imageUrls, ...uploadedUrls];
      const payload = { ...formData, imageUrls: finalImageUrls };

      if (editingId) {
        await updateQuestion(editingId, payload);
      } else {
        await createQuestion(payload);
      }

      setIsFormModalOpen(false);
      await loadQuestions();
    } catch (error) {
      console.error("Error saving question:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!questionToDelete) return;

    try {
      await deleteQuestion(questionToDelete.id);
      setIsDeleteModalOpen(false);
      setQuestionToDelete(null);
      await loadQuestions();
    } catch (error) {
      console.error("Error deleting question:", error);
    }
  };

  const handleImageUrlsChange = (newUrls: string[]) => {
    setFormData((prev) => ({ ...prev, imageUrls: newUrls }));
  };

  return (
    <div className={`questions-page questions-page--${theme}`}>
      <QuestionBrowser
        theme={theme}
        questions={filteredQuestions.map((question) => ({
          id: question.id,
          title: question.title,
          topics: question.topics,
          difficulty: question.difficulty,
          description: question.description,
          constraint: question.constraint,
          expectedOutput: question.expectedOutput,
          imageUrls: question.imageUrls,
          matched: question.matched,
        }))}
        isLoading={isLoading}
        selectedQuestionId={selectedQuestionId}
        onSelectedQuestionChange={(question) =>
          setSelectedQuestionId(question.id)
        }
        onEditQuestion={isAdmin ? handleOpenEdit : undefined}
        onDeleteQuestion={isAdmin ? handleOpenDelete : undefined}
        getTopicLabel={getTopicLabel}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search question"
        showFilterButton={true}
        onFilterClick={() => console.log("open filter")}
        showAddButton={isAdmin}
        onAddClick={handleOpenCreate}
      />

      {isAdmin && (
        <>
          <Modal
            theme="admin"
            isOpen={isFormModalOpen}
            onClose={() => setIsFormModalOpen(false)}
            title={editingId ? "Edit Question" : "Add New Question"}
            footer={
              <Button
                theme="admin"
                variant="solid"
                onClick={handleSaveQuestion}
                disabled={isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : editingId
                    ? "Save Changes"
                    : "Create Question"}
              </Button>
            }
          >
            <div className="questions-form-layout">
              <Input
                theme="admin"
                label="Question Title"
                placeholder="e.g. Merge Intervals"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
              />

              <TextArea
                theme="admin"
                label="Description"
                placeholder="Provide a detailed description of the problem..."
                value={formData.description ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />

              <TextArea
                theme="admin"
                label="Constraints"
                placeholder="Provide constraints of the problem..."
                value={formData.constraint ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    constraint: e.target.value,
                  }))
                }
              />

              <TextArea
                theme="admin"
                label="Expected Output"
                placeholder="Provide the expected output of the problem..."
                value={formData.expectedOutput ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    expectedOutput: e.target.value,
                  }))
                }
              />

              <MultiSelect
                theme="admin"
                label="Topics"
                placeholder="Select Topics"
                options={MATCH_TOPIC_OPTIONS}
                value={formData.topics}
                onChange={(topics) =>
                  setFormData((prev) => ({ ...prev, topics }))
                }
              />

              <Select
                theme="admin"
                label="Difficulty Level"
                value={formData.difficulty}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    difficulty: value as Question["difficulty"],
                  }))
                }
                options={[
                  { value: "easy", label: "Easy" },
                  { value: "medium", label: "Medium" },
                  { value: "hard", label: "Hard" },
                ]}
              />

              <div className="questions-form-group">
                <QuestionImageManager
                  imageUrls={formData.imageUrls}
                  onChangeImageUrls={handleImageUrlsChange}
                  newFiles={newImageFiles}
                  onChangeNewFiles={setNewImageFiles}
                />
              </div>
            </div>
          </Modal>

          <Modal
            theme="admin"
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            title="Confirm Deletion"
            titleAlign="center"
            hasCloseButton={false}
            footer={
              <>
                <Button
                  theme="admin"
                  variant="solid"
                  onClick={() => setIsDeleteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  theme="admin"
                  variant="ghost"
                  className="text-danger"
                  onClick={handleConfirmDelete}
                >
                  Delete
                </Button>
              </>
            }
          >
            <div className="questions-delete-confirmation">
              <div className="questions-alert-icon-wrapper">
                <AlertCircle className="h-10 w-10 text-danger" />
              </div>

              <p>
                Are you sure you want to delete{" "}
                <strong>{questionToDelete?.title}</strong>? This action is
                permanent and cannot be undone.
              </p>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
};

export default Questions;
