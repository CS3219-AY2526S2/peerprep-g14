import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, AlertCircle, Upload, X } from "lucide-react";
import { Button } from "../components/Button";
import { Table } from "../components/Table";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import {
  fetchQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} from "../../BackendClient";
import "./AdminDashboard.css";
import { Header } from "../components/Header";
import { TextArea } from "../components/TextArea";
import { Spinner } from "../components/Spinner";
import { MultiSelect } from "../components/MultiSelect";

// --- Types & Constants ---
interface Question {
  id: string;
  title: string;
  topics: string[];
  difficulty: "easy" | "medium" | "hard";
  description?: string;
  mediaUrl?: string;
}

const availabelTopics = [
  { value: "binary_search", label: "Binary Search" },
  { value: "depth_first_search", label: "Depth First Search" },
  { value: "breadth_first_search", label: "Breadth First Search" },
  { value: "singly_linked_list", label: "Singly Linked List" },
  { value: "doubly_linked_list", label: "Doubly Linked List" },
];

export const AdminDashboard: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<Question, "id">>({
    title: "",
    topics: [],
    difficulty: "easy",
    description: "",
    mediaUrl: "",
  });
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(
    null,
  );

  // Fetch initial data
  const loadQuestions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchQuestions();
      setQuestions(data);
    } catch (error) {
      console.error("Error loading questions:", error);
    } finally {
      setIsLoading(false);
    }
    console.log("questionpayload:", questions);
    console.log("formdata:", formData);
  };

  useEffect(() => {
    loadQuestions();
  }, []);

  // --- Handlers ---
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      title: "",
      topics: [],
      difficulty: "easy",
      description: "",
      mediaUrl: "",
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (q: Question) => {
    setEditingId(q.id);
    setFormData({
      title: q.title,
      topics: [...q.topics],
      difficulty: q.difficulty,
      description: q.description || "",
      mediaUrl: q.mediaUrl || "",
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDelete = (q: Question) => {
    setQuestionToDelete(q);
    setIsDeleteModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setFormData((prev) => ({ ...prev, mediaUrl: url }));
    }
  };

  const handleRemoveMedia = () => {
    setFormData((prev) => ({ ...prev, mediaUrl: "" }));
  };

  // const handleTopicSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
  //     const selectedTopic = e.target.value;
  //     if (selectedTopic && !formData.topics.includes(selectedTopic)) {
  //         setFormData(prev => ({ ...prev, topics: [...prev.topics, selectedTopic] }));
  //     }
  //     e.target.value = '';
  // };
  const handleTopicSelect = (selectedTopic: string) => {
    if (selectedTopic && !formData.topics.includes(selectedTopic)) {
      setFormData((prev) => ({
        ...prev,
        topics: [...prev.topics, selectedTopic],
      }));
    }
  };

  const handleRemoveTopic = (topicToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      topics: prev.topics.filter((t) => t !== topicToRemove),
    }));
  };

  const handleSaveQuestion = async () => {
    if (!formData.title || formData.topics.length === 0) return;

    try {
      if (editingId) {
        await updateQuestion(editingId, formData);
      } else {
        await createQuestion(formData);
      }
      setIsFormModalOpen(false);
      await loadQuestions(); // refresh table after saving
    } catch (error) {
      console.error("Error saving question:", error);
      alert(
        "Failed to save question. Please check the console or backend logs.",
      );
    }
  };

        try {
            if (editingId) {
                console.log('Updating ID:', editingId);
                console.log('Payload:', formData);
                await updateQuestion(editingId, formData);
                const result = await updateQuestion(editingId, formData);
                console.log('Update result:', result);
            } else {
                await createQuestion(formData);
            }
            setIsFormModalOpen(false);
            await loadQuestions(); // refresh table after saving
        } catch (error) {
            console.error("Error saving question:", error);
            alert("Failed to save question. Please check the console or backend logs.");
        }
    };

    const handleConfirmDelete = async () => {
        if (questionToDelete) {
            try {
                await deleteQuestion(questionToDelete.id);
                setIsDeleteModalOpen(false);
                setQuestionToDelete(null);
                await loadQuestions(); // refresh table after deleting
            } catch (error) {
                console.error("Error deleting question:", error);
                alert("Failed to delete question. Please check the console or backend logs.");
            }
        }
    };

  // --- Format helper for table display ---
  const getTopicLabel = (value: string) => {
    const topic = availabelTopics.find((t) => t.value === value);
    return topic ? topic.label : value;
  };

  // --- Table Configuration ---
  const columns = [
    {
      header: "Title",
      accessorKey: "title" as const,
      cell: (item: Question) => (
        <span className="font-medium text-primary">{item.title}</span>
      ),
    },
    {
      header: "Topics",
      accessorKey: "topics" as const,
      cell: (item: Question) => (
        <div className="flex flex-wrap gap-1">
          {item.topics.map((topicValue) => (
            <span key={topicValue} className="tag-sm custom-tag text-accent">
              {getTopicLabel(topicValue)}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Difficulty",
      accessorKey: "difficulty" as const,
      cell: (item: Question) => {
        const colorClass =
          item.difficulty === "easy"
            ? "text-success bg-success-light"
            : item.difficulty === "medium"
              ? "text-warning bg-warning-light"
              : "text-danger bg-danger-light";
        return (
          <span className={`tag-sm custom-tag ${colorClass}`}>
            {item.difficulty}
          </span>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id" as const,
      cell: (item: Question) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(item)}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleOpenDelete(item)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-layout animate-fade-in">
      <Header logo brandName profile signout admin />

      {/* Main Content */}
      <main className="admin-content container">
        <div className="admin-header">
          <div>
            <h1 className="admin-title">Question Repository</h1>
            <p className="admin-subtitle">
              Manage the global database of interview questions.
            </p>
          </div>
        </div>

        <Button
          onClick={handleOpenCreate}
          leftIcon={<Plus className="h-5 w-5" />}
        >
          Add Question
        </Button>

        <div className="table-wrapper mt-8">
          {isLoading ? (
            <div className="p-8 text-center text-secondary">
              <Spinner />
              Loading questions...
            </div>
          ) : (
            <Table data={questions} columns={columns} />
          )}
        </div>
      </main>

      {/* --- Modals --- */}

      {/* Form Modal (Create / Edit) */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? "Edit Question" : "Add New Question"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsFormModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion}>
              {editingId ? "Save Changes" : "Create Question"}
            </Button>
          </>
        }
      >
        <div className="form-layout">
          <Input
            label="Question Title"
            placeholder="e.g. Merge Intervals"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />

          <TextArea
            label="Description"
            placeholder="Provide a detailed description of the problem..."
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />

          <MultiSelect
            label="Topics"
            placeholder="Select Topics"
            options={availabelTopics}
            value={selectedTopics}
            onChange={setSelectedTopics}
          />
          {/* <div className="form-group">
            <label className="form-label">Topics</label>
            <Select
              options={[
                { value: "", label: "Select a topic..." },
                ...AVAILABLE_TOPICS.map((t) => ({
                  value: t.value,
                  label: t.label,
                })),
              ]}
              onChange={handleTopicSelect}
              value=""
            />
            {formData.topics.length > 0 && (
              <div className="selected-topics-container">
                {formData.topics.map((topicValue) => (
                  <div key={topicValue} className="selected-topic-tag">
                    <span>{getTopicLabel(topicValue)}</span>
                    <button
                      type="button"
                      className="topic-remove-btn"
                      onClick={() => handleRemoveTopic(topicValue)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div> */}

          <Select
            label="Difficulty Level"
            value={formData.difficulty}
            onChange={(value) =>
              setFormData({
                ...formData,
                difficulty: value as Question["difficulty"],
              })
            }
            options={[
              { value: "easy", label: "Easy" },
              { value: "medium", label: "Medium" },
              { value: "hard", label: "Hard" },
            ]}
          />

          <div className="form-group">
            <label className="form-label">Media / Photos (Optional)</label>
            {!formData.mediaUrl ? (
              <div className="media-upload-container">
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="media-upload-input"
                  onChange={handleFileUpload}
                />
                <Upload className="h-8 w-8 text-accent mx-auto mb-2 opacity-80" />
                <p className="text-sm text-secondary">
                  Click or drag file to upload
                </p>
              </div>
            ) : (
              <div className="media-preview-wrapper">
                <img
                  src={formData.mediaUrl}
                  alt="Uploaded Media"
                  className="media-preview"
                />
                <button
                  className="remove-media-btn"
                  onClick={handleRemoveMedia}
                  title="Remove Media"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Deletion"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </>
        }
      >
        <div className="delete-confirmation">
          <div className="alert-icon-wrapper">
            <AlertCircle className="h-10 w-10 text-danger" />
          </div>
          <p>
            Are you sure you want to delete{" "}
            <strong>{questionToDelete?.title}</strong>? This action is permanent
            and cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};
