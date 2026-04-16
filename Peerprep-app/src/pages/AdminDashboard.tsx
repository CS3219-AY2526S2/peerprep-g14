import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "../components/Button";
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
import { MultiSelect } from "../components/MultiSelect";
import AppShell from "../components/AppShell";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import QuestionBrowser from "../components/QuestionBrowser";
import QuestionImageManager from "../components/QuestionImageManager";
import { uploadQuestionImage, deleteQuestionImage } from "../firebaseClient";
import { MATCH_TOPIC_OPTIONS } from "../constants/matchTopics";

// --- Types & Constants ---
interface Question {
  id: string;
  title: string;
  topics: string[];
  constraint: string;
  expectedOutput: string;
  difficulty: "easy" | "medium" | "hard";
  description?: string;
  imageUrls: string[];
  matched: number;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarOpen, setIsSideBarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = React.useState<
    string | null
  >(null);
  const dashboardTheme = "admin";

  // Modal States
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Omit<Question, "id">>({
    title: "",
    topics: [],
    difficulty: "easy",
    constraint: "",
    expectedOutput: "",
    description: "",
    imageUrls: [],
    matched: 0,
  });
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(
    null,
  );
  const [searchValue, setSearchValue] = useState("");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    navigate("/");
  };

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
    setNewImageFiles([]);
    setFormData({
      title: "",
      topics: [],
      difficulty: "easy",
      constraint: "",
      expectedOutput: "",
      description: "",
      imageUrls: [],
      matched: 0,
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (q: any) => {
    setEditingId(q.id);
    setNewImageFiles([]);
    setFormData({
      title: q.title,
      topics: [...q.topics],
      difficulty: q.difficulty,
      constraint: q.constraint,
      expectedOutput: q.expectedOutput,
      description: q.description || "",
      imageUrls: q.imageUrls || [],
      matched: q.matched || 0,
    });
    setIsFormModalOpen(true);
  };

  const handleOpenDelete = (q: any) => {
    setQuestionToDelete(q);
    setIsDeleteModalOpen(true);
  };

  const handleImageUrlsChange = (newUrls: string[]) => {
    setFormData((prev) => ({ ...prev, imageUrls: newUrls }));
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
      alert(
        "Failed to save question. Please check the console or backend logs.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (questionToDelete) {
      try {
        await deleteQuestion(questionToDelete.id);
        setIsDeleteModalOpen(false);
        setQuestionToDelete(null);
        await loadQuestions();
      } catch (error) {
        console.error("Error deleting question:", error);
        alert(
          "Failed to delete question. Please check the console or backend logs.",
        );
      }
    }
  };

  // --- Format helper for table display ---
  const getTopicLabel = (value: string) => {
    const topic = MATCH_TOPIC_OPTIONS.find((t) => t.value === value);
    return topic ? topic.label : value;
  };

  const filteredQuestions = questions.filter((question) => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return true;

    return (
      question.title.toLowerCase().includes(q) ||
      question.topics.some((topic) =>
        getTopicLabel(topic).toLowerCase().includes(q),
      )
    );
  });

  const topItems = [
    {
      key: "questions",
      label: "Questions",
      active: location.pathname.startsWith("/admin"),
      onClick: () => navigate("/admin/questions"),
    },
    {
      key: "users",
      label: "Users",
      active: location.pathname.startsWith("/admin/users"),
      onClick: () => navigate("/admin/users"),
    },
  ];

  const bottomItems = [
    {
      key: "logout",
      label: "Logout",
      onClick: () => handleLogout(),
      isLoading: isLoggingOut,
    },
  ];

  return (
    <div className="animate-fade-in">
      <AppShell
        theme={dashboardTheme}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSideBarOpen((prev) => !prev)}
        sidebar={
          <Sidebar
            theme={dashboardTheme}
            isOpen={isSidebarOpen}
            topItems={topItems}
            bottomItems={bottomItems}
          />
        }
        header={
          <Header
            theme={dashboardTheme}
            showProfile
            showProfileName
            showProfilePicture
          />
        }
      >
        <div className="admin-dashboard-shell">
          <QuestionBrowser
            theme="admin"
            questions={filteredQuestions.map((question) => ({
              id: question.id,
              title: question.title,
              topics: question.topics,
              difficulty: question.difficulty,
              constraint: question.constraint,
              expectedOutput: question.expectedOutput,
              description: question.description,
              imageUrls: question.imageUrls,
              attempts: question.matched,
            }))}
            isLoading={isLoading}
            selectedQuestionId={selectedQuestionId}
            onSelectedQuestionChange={(question) =>
              setSelectedQuestionId(question.id)
            }
            onEditQuestion={handleOpenEdit}
            onDeleteQuestion={handleOpenDelete}
            getTopicLabel={getTopicLabel}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search question"
            showFilterButton
            onFilterClick={() => console.log("open filter")}
            showAddButton
            onAddClick={handleOpenCreate}
          />
        </div>
      </AppShell>

      {/* --- Modals --- */}

      {/* Edit Modal */}
      <Modal
        theme="admin"
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingId ? "Edit Question" : "Add New Question"}
        footer={
          <>
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
          </>
        }
      >
        <div className="form-layout">
          <Input
            theme="admin"
            label="Question Title"
            placeholder="e.g. Merge Intervals"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />

          <TextArea
            theme="admin"
            label="Description"
            placeholder="Provide a detailed description of the problem..."
            value={formData.description ?? ""}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />

          <MultiSelect
            theme="admin"
            label="Topics"
            placeholder="Select Topics"
            options={MATCH_TOPIC_OPTIONS}
            value={formData.topics}
            onChange={(topics) => setFormData((prev) => ({ ...prev, topics }))}
          />

          <Select
            theme="admin"
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
            <QuestionImageManager
              imageUrls={formData.imageUrls}
              onChangeImageUrls={handleImageUrlsChange}
              newFiles={newImageFiles}
              onChangeNewFiles={setNewImageFiles}
            />
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
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
        <div className="delete-confirmation">
          <div className="alert-icon-wrapper">
            <AlertCircle className="h-10 w-10" />
          </div>
          <p>
            Are you sure you want to delete{" "}
            <strong>{questionToDelete?.title}</strong> ? This action is
            permanent and cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  );
};
