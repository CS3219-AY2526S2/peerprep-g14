import React, { useState, useEffect } from "react";
import { Edit2 } from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { MultiSelect } from "../components/MultiSelect";
import InfoCard from "../components/InfoCard";
import SearchBar from "../components/SearchBar";
import { Spinner } from "../components/Spinner";
import "./AdminUsers.css";
import "./Questions.css";

interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  authProvider: string | null;
  bio: string | null;
  experienceLevel: string | null;
  learningPurpose: string[];
  createdAt: string;
}

interface EditFormData {
  name: string;
  bio: string;
  experienceLevel: string;
  learningPurpose: string[];
}

const learningPurposeOptions = [
  { value: "interview_prep", label: "Interview Prep" },
  { value: "skill_building", label: "Skill Building" },
  { value: "competitive_programming", label: "Competitive Programming" },
  { value: "academic", label: "Academic" },
  { value: "fun", label: "Fun" },
];

const experienceLevelOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const getExpLevelLabel = (v: string | null) =>
  experienceLevelOptions.find((o) => o.value === v)?.label ?? v ?? "—";

const getLearningPurposeLabel = (v: string) =>
  learningPurposeOptions.find((o) => o.value === v)?.label ?? v;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    name: "",
    bio: "",
    experienceLevel: "",
    learningPurpose: [],
  });

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/user/admin/users", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch users");
      setUsers(await res.json());
    } catch (err) {
      console.error("Load users error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const handleOpenEdit = () => {
    if (!selectedUser) return;
    setEditForm({
      name: selectedUser.name ?? "",
      bio: selectedUser.bio ?? "",
      experienceLevel: selectedUser.experienceLevel ?? "",
      learningPurpose: selectedUser.learningPurpose ?? [],
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/user/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error("Failed to update user");
      const data = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? data.user : u)),
      );
      setSelectedUser(data.user);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Save edit error:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasInfoCard = selectedUser !== null;

  return (
    <div
      style={{ padding: "2rem" }}
      className={[
        "question-browser",
        "question-browser--admin",
        hasInfoCard ? "has-info-card" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ── Left: table panel ── */}
      <div className="question-browser__main">
        {/* Toolbar */}
        <div className="question-browser__toolbar">
          <div className="question-browser__search">
            <SearchBar
              theme="admin"
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search users…"
            />
          </div>
        </div>

        {/* Table */}
        <div className="question-browser__table">
          <div className="question-table question-table--admin user-table">
            {/* Header */}
            <div className="question-table__header">
              <div className="question-table__header-cell question-table__header-cell--id">
                No.
              </div>
              <div className="question-table__header-cell question-table__header-cell--name">
                Name
              </div>
              <div className="question-table__header-cell question-table__header-cell--topics">
                Email
              </div>
              <div className="question-table__header-cell question-table__header-cell--difficulty">
                Experience
              </div>
            </div>

            {/* Rows */}
            {isLoading ? (
              <div className="question-table__status-container">
                <Spinner size="md" variant="light_muted" spinnerTheme="admin" />
                <div className="question-table__status">Loading users…</div>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="question-table__status-container">
                <div className="question-table__status">No users found.</div>
              </div>
            ) : (
              <div className="question-table__rows">
                {filteredUsers.map((u, index) => {
                  const isSelected = selectedUser?.id === u.id;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      className={[
                        "question-table__row",
                        isSelected ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedUser(u)}
                    >
                      <div className="question-table__row-cell question-table__row-cell--id">
                        {String(index + 1).padStart(3, "0")}
                      </div>
                      <div className="question-table__row-cell question-table__row-cell--name">
                        {u.name ?? "—"}
                      </div>
                      <div className="question-table__row-cell question-table__row-cell--topics">
                        {u.email}
                      </div>
                      <div className="question-table__row-cell question-table__row-cell--difficulty">
                        {u.experienceLevel ? (
                          <span
                            className={[
                              "question-table__difficulty-pill",
                              "is-exp",
                              isSelected ? "is-selected" : "is-unselected",
                            ].join(" ")}
                          >
                            {getExpLevelLabel(u.experienceLevel)}
                          </span>
                        ) : (
                          <span
                            className={[
                              "question-table__difficulty-pill",
                              isSelected ? "is-selected" : "is-unselected",
                            ].join(" ")}
                            style={{ opacity: 0.35 }}
                          >
                            —
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right: InfoCard ── */}
      {selectedUser && (
        <div className="question-browser__info">
          <InfoCard
            theme="admin"
            title="User Details"
            actions={[
              {
                key: "edit",
                label: "Edit",
                icon: <Edit2 size={15} />,
                onClick: handleOpenEdit,
                variant: "primary",
              },
            ]}
          >
            <div className="question-browser__details">
              <div className="question-browser__section">
                <div className="question-browser__label">ID</div>
                <div
                  className="question-browser__value"
                  style={{ fontFamily: "monospace", fontSize: "0.8rem", opacity: 0.7 }}
                >
                  {selectedUser.id}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Name</div>
                <div className="question-browser__value">
                  {selectedUser.name ?? "—"}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Email</div>
                <div className="question-browser__value">{selectedUser.email}</div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Auth Provider</div>
                <div className="question-browser__value">
                  {selectedUser.authProvider ?? "—"}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Bio</div>
                <div className="question-browser__value question-browser__value--multiline">
                  {selectedUser.bio?.trim() || "—"}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Experience Level</div>
                <div className="question-browser__value">
                  {getExpLevelLabel(selectedUser.experienceLevel)}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Learning Purpose</div>
                <div className="question-browser__tags">
                  {selectedUser.learningPurpose?.length > 0
                    ? selectedUser.learningPurpose.map((v) => (
                      <span key={v} className="question-browser__tag">
                        {getLearningPurposeLabel(v)}
                      </span>
                    ))
                    : <div className="question-browser__value">—</div>}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Joined</div>
                <div className="question-browser__value">
                  {formatDate(selectedUser.createdAt)}
                </div>
              </div>
            </div>
          </InfoCard>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        theme="admin"
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit User"
        footer={
          <Button theme="admin" variant="solid" onClick={handleSaveEdit}>
            {isSaving ? "Saving…" : "Save Changes"}
          </Button>
        }
      >
        <div className="questions-form-layout">
          <Input
            theme="admin"
            label="Name"
            placeholder="Display name"
            value={editForm.name}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <Input
            theme="admin"
            label="Bio"
            placeholder="Short bio"
            value={editForm.bio}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, bio: e.target.value }))
            }
          />
          <Select
            theme="admin"
            label="Experience Level"
            value={editForm.experienceLevel}
            onChange={(v) =>
              setEditForm((prev) => ({ ...prev, experienceLevel: v }))
            }
            options={[
              { value: "", label: "Not specified" },
              ...experienceLevelOptions,
            ]}
          />
          <MultiSelect
            theme="admin"
            label="Learning Purpose"
            placeholder="Select purposes"
            options={learningPurposeOptions}
            value={editForm.learningPurpose}
            onChange={(learningPurpose) =>
              setEditForm((prev) => ({ ...prev, learningPurpose }))
            }
          />
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsers;
