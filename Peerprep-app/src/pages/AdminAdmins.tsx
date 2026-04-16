import React, { useState, useEffect } from "react";
import { Edit2, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import InfoCard from "../components/InfoCard";
import SearchBar from "../components/SearchBar";
import ToolBarButton from "../components/ToolBarButton";
import { Spinner } from "../components/Spinner";
import "./AdminAdmins.css";
import "./Questions.css";

interface AdminRecord {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const AdminAdmins: React.FC = () => {
  const [admins, setAdmins] = useState<AdminRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAdmin, setSelectedAdmin] = useState<AdminRecord | null>(null);
  const [searchValue, setSearchValue] = useState("");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    name: "",
    password: "",
    role: "ADMIN",
  });
  const [isCreating, setIsCreating] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);

  const loadAdmins = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/user/admin/admins", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch admins");
      setAdmins(await res.json());
    } catch (err) {
      console.error("Load admins error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, []);

  const filteredAdmins = admins.filter((a) => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return true;
    return (
      (a.name ?? "").toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );
  });

  const handleOpenEdit = () => {
    if (!selectedAdmin) return;
    setEditName(selectedAdmin.name ?? "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedAdmin) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/user/admin/admins/${selectedAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) throw new Error("Failed to update admin");
      const data = await res.json();
      setAdmins((prev) =>
        prev.map((a) => (a.id === selectedAdmin.id ? data.admin : a)),
      );
      setSelectedAdmin(data.admin);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error("Save edit error:", err);
      alert("Failed to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCreate = () => {
    setCreateForm({ email: "", name: "", password: "", role: "ADMIN" });
    setCreatedPassword(null);
    setIsCreateModalOpen(true);
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.password) {
      alert("Email and password are required.");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/user/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.message ?? "Failed to create account.");
        return;
      }
      const data = await res.json();
      setAdmins((prev) => [data.admin, ...prev]);
      setCreatedPassword(createForm.password);
    } catch (err) {
      console.error("Create admin error:", err);
      alert("Failed to create account.");
    } finally {
      setIsCreating(false);
    }
  };

  const getRolePillClass = (role: string) =>
    role === "SUPER_ADMIN"
      ? "admin-admins__role-pill admin-admins__role-pill--super"
      : "admin-admins__role-pill admin-admins__role-pill--admin";

  const hasInfoCard = selectedAdmin !== null;

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
              placeholder="Search accounts…"
            />
          </div>
          <div className="question-browser__toolbar-actions">
            <ToolBarButton
              theme="admin"
              onClick={handleOpenCreate}
              title="Create account"
              aria-label="Create account"
            >
              <Plus size={24} />
            </ToolBarButton>
          </div>
        </div>

        {/* Table */}
        <div className="question-browser__table">
          <div className="question-table question-table--admin admin-table">
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
                Role
              </div>
            </div>

            {/* Rows */}
            {isLoading ? (
              <div className="question-table__status-container">
                <Spinner size="md" variant="light_muted" spinnerTheme="admin" />
                <div className="question-table__status">Loading accounts…</div>
              </div>
            ) : filteredAdmins.length === 0 ? (
              <div className="question-table__status-container">
                <div className="question-table__status">No accounts found.</div>
              </div>
            ) : (
              <div className="question-table__rows">
                {filteredAdmins.map((a, index) => {
                  const isSelected = selectedAdmin?.id === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      className={[
                        "question-table__row",
                        isSelected ? "is-selected" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => setSelectedAdmin(a)}
                    >
                      <div className="question-table__row-cell question-table__row-cell--id">
                        {String(index + 1).padStart(3, "0")}
                      </div>
                      <div className="question-table__row-cell question-table__row-cell--name">
                        {a.name ?? "—"}
                      </div>
                      <div className="question-table__row-cell question-table__row-cell--topics">
                        {a.email}
                      </div>
                      <div className="question-table__row-cell question-table__row-cell--difficulty">
                        <span className={getRolePillClass(a.role)}>
                          {a.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                        </span>
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
      {selectedAdmin && (
        <div className="question-browser__info">
          <InfoCard
            theme="admin"
            title="Account Details"
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
                  {selectedAdmin.id}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Name</div>
                <div className="question-browser__value">
                  {selectedAdmin.name ?? "—"}
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Email</div>
                <div className="question-browser__value">{selectedAdmin.email}</div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Role</div>
                <div className="question-browser__value">
                  <span className={getRolePillClass(selectedAdmin.role)}>
                    {selectedAdmin.role === "SUPER_ADMIN" ? "Super Admin" : "Admin"}
                  </span>
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Password</div>
                <div className="question-browser__value" style={{ letterSpacing: "0.12em", opacity: 0.5 }}>
                  ••••••••••••
                </div>
              </div>
              <div className="question-browser__section">
                <div className="question-browser__label">Joined</div>
                <div className="question-browser__value">
                  {formatDate(selectedAdmin.createdAt)}
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
        title="Edit Account"
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
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
          />
          <div className="admin-admins__readonly-group">
            <label className="admin-admins__readonly-label">Email</label>
            <div className="admin-admins__readonly-value">
              {selectedAdmin?.email}
            </div>
          </div>
          <div className="admin-admins__readonly-group">
            <label className="admin-admins__readonly-label">Password</label>
            <div className="admin-admins__readonly-value" style={{ opacity: 0.5, letterSpacing: "0.12em" }}>
              ••••••••••••
            </div>
          </div>
        </div>
      </Modal>

      {/* Create Modal */}
      <Modal
        theme="admin"
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Account"
        footer={
          createdPassword ? (
            <Button
              theme="admin"
              variant="solid"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Done
            </Button>
          ) : (
            <Button theme="admin" variant="solid" onClick={handleCreate}>
              {isCreating ? "Creating…" : "Create Account"}
            </Button>
          )
        }
      >
        {createdPassword ? (
          <div className="admin-admins__success">
            <div className="admin-admins__success-icon">✓</div>
            <p className="admin-admins__success-title">Account Created!</p>
            <p className="admin-admins__success-sub">
              Share this one-time password with the new user. It will not be
              shown again.
            </p>
            <div className="admin-admins__password-reveal">{createdPassword}</div>
          </div>
        ) : (
          <div className="questions-form-layout">
            <Input
              theme="admin"
              label="Email"
              placeholder="admin@example.com"
              value={createForm.email}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <Input
              theme="admin"
              label="Name"
              placeholder="Display name (optional)"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <Input
              theme="admin"
              label="Temporary Password"
              placeholder="Set an initial password"
              value={createForm.password}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, password: e.target.value }))
              }
            />
            <Select
              theme="admin"
              label="Role"
              value={createForm.role}
              onChange={(v) =>
                setCreateForm((prev) => ({ ...prev, role: v }))
              }
              options={[
                { value: "ADMIN", label: "Admin" },
                { value: "SUPER_ADMIN", label: "Super Admin" },
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminAdmins;
