import React, { useEffect, useMemo, useState } from "react";
import { House, Pencil, User as UserIcon, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Card from "../components/Card";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Input } from "../components/Input";
import { Select } from "../components/Select";
import { MultiSelect } from "../components/MultiSelect";
import { TextArea } from "../components/TextArea";
import { Spinner } from "../components/Spinner";

import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile";

import "./ProfileCustomisation.css";
import { useUpdateCurrentUserProfile } from "../hooks/useUpdateCurrentUserProfile";
import { useAuth } from "../context/AuthContext";

type Theme = "user" | "admin";

interface ProfileFormData {
  name: string;
  email: string;
  experienceLevel: string;
  learningPurpose: string[];
  bio: string;
}

const experienceOptions = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const learningPurposeOptions = [
  { value: "casual", label: "Casual" },
  { value: "interview", label: "Interview" },
];

const toDisplayExperience = (value: string) => {
  const match = experienceOptions.find((option) => option.value === value);
  return match?.label ?? "Not set";
};

const toDisplayPurposes = (values: string[]) => {
  if (!values.length) return ["Not set"];

  return values.map((value) => {
    const match = learningPurposeOptions.find(
      (option) => option.value === value,
    );
    return match?.label ?? value;
  });
};

export const ProfileCustomisation: React.FC = () => {
  const navigate = useNavigate();
  const { userId, userRole } = useAuth();
  const {
    data: user,
    isLoading: profileLoading,
    error: profileError,
  } = useCurrentUserProfile();
  const updateProfileMutation = useUpdateCurrentUserProfile();

  const theme: Theme =
    userRole === "ADMIN" || userRole === "SUPER_ADMIN" ? "admin" : "user";
  const homePath = theme === "admin" ? "/admin/questions" : "/user/dashboard";

  const initialForm = useMemo<ProfileFormData>(
    () => ({
      name: user?.name ?? "",
      email: user?.email ?? "",
      experienceLevel: user?.experienceLevel ?? "beginner",
      learningPurpose: user?.learningPurpose ?? ["casual"],
      bio: user?.bio ?? "",
    }),
    [user],
  );

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>(initialForm);

  useEffect(() => {
    setFormData(initialForm);
  }, [initialForm]);

  const displayName =
    user?.name ?? (theme === "admin" ? "Admin User" : "User Name");

  const displayRole =
    userRole === "SUPER_ADMIN"
      ? "Super Admin"
      : userRole === "ADMIN"
        ? "Admin"
        : "User";

  const handleOpenEdit = () => {
    setFormData(initialForm);
    setIsEditModalOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditModalOpen(false);
    setFormData(initialForm);
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      alert("User ID is missing. Please log in again.");
      navigate("/");
      return;
    }

    setIsSaving(true);

    try {
      await updateProfileMutation.mutateAsync({
        userId: userId,
        name: formData.name,
        experienceLevel: formData.experienceLevel,
        learningPurpose: formData.learningPurpose,
        bio: formData.bio,
      });

      setIsEditModalOpen(false);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className={`profile-page profile-page--${theme}`}>
        <div className="profile-page__loading">
          <Spinner spinnerTheme={theme} size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={`profile-page profile-page--${theme}`}>
      <header
        className={`app-shell-header app-shell-header--${theme} profile-page__header`}
      >
        <div className="app-shell-header__left">
          <button
            type="button"
            className="app-shell-header__toggle profile-page__home-btn"
            onClick={() => navigate(homePath)}
            aria-label="Go to home"
          >
            <House size={18} className="app-shell-header__toggle-icon" />
          </button>

          <div className="app-shell-header__page-name">Profile</div>
        </div>

        <div className="app-shell-header__right" />
      </header>

      <div className="profile-page__body">
        <div className="profile-page__grid">
          <Card
            theme={theme}
            fullHeight
            className="profile-page__card profile-page__card--left"
            contentClassName="profile-page__card-content profile-page__card-content--left"
          >
            <div className="profile-sidebar">
              <div
                className={`profile-sidebar__avatar profile-sidebar__avatar--${theme}`}
              >
                <UserIcon size={72} />
              </div>

              <div className="profile-sidebar__identity">
                <h2 className="profile-sidebar__name">{displayName}</h2>
                <p className="profile-sidebar__role">{displayRole}</p>
              </div>

              <div className="profile-sidebar__divider" />

              <Button
                theme={theme}
                variant="selection"
                size="sm"
                selected
                fullWidth
              >
                Personal Information
              </Button>
            </div>
          </Card>

          <Card
            theme={theme}
            fullHeight
            className="profile-page__card profile-page__card--right"
            contentClassName="profile-page__card-content profile-page__card-content--right"
          >
            <div className="profile-details">
              <div className="profile-details__header">
                <h2 className="profile-details__title">Personal Information</h2>

                <Button
                  theme={theme}
                  variant="solid"
                  size="sm"
                  leftIcon={<Pencil size={16} />}
                  onClick={handleOpenEdit}
                >
                  Edit
                </Button>
              </div>

              <div className="profile-details__divider" />

              <div className="profile-details__scroll">
                <div className="profile-details__section">
                  <label className="profile-details__label">Name</label>
                  <div
                    className={`profile-details__field profile-details__field--${theme}`}
                  >
                    {formData.name || "Not set"}
                  </div>
                </div>

                <div className="profile-details__section">
                  <label className="profile-details__label">Email</label>
                  <div
                    className={`profile-details__field profile-details__field--${theme}`}
                  >
                    {formData.email || "Not set"}
                  </div>
                </div>

                {userRole === "USER" && (
                  <>
                    <div className="profile-details__section">
                      <label className="profile-details__label">
                        Experience Level
                      </label>
                      <div
                        className={`profile-details__field profile-details__field--${theme}`}
                      >
                        {toDisplayExperience(formData.experienceLevel)}
                      </div>
                    </div>

                    <div className="profile-details__section">
                      <label className="profile-details__label">
                        Learning Purpose
                      </label>
                      <div
                        className={`profile-details__field profile-details__field--${theme}`}
                      >
                        <div className="profile-details__chips">
                          {toDisplayPurposes(formData.learningPurpose).map(
                            (purpose) => (
                              <span
                                key={purpose}
                                className={`profile-details__chip profile-details__chip--${theme}`}
                              >
                                {purpose}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="profile-details__section profile-details__section--bio">
                      <label className="profile-details__label">Bio</label>
                      <div
                        className={`profile-details__field profile-details__field--${theme} profile-details__field--textarea`}
                      >
                        {formData.bio || "No bio added yet."}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        theme={theme}
        isOpen={isEditModalOpen}
        onClose={handleCloseEdit}
        title="Edit Profile"
        titleAlign="center"
        hasCloseButton={false}
        footer={
          <>
            <Button
              theme={theme}
              variant="ghost"
              onClick={handleCloseEdit}
              disabled={isSaving}
            >
              Cancel
            </Button>

            <Button
              theme={theme}
              variant="solid"
              onClick={handleSaveProfile}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="profile-edit-modal">
          <div className="profile-edit-modal__form">
            <div className="profile-edit-modal__avatar-block">
              <div
                className={`profile-sidebar__avatar profile-sidebar__avatar--${theme} profile-edit-modal__avatar`}
              >
                <UserIcon size={64} />
              </div>
              <div className="profile-edit-modal__avatar-text">
                Profile Picture
              </div>
            </div>

            <Input
              theme={theme}
              label="Name"
              placeholder="Enter your name"
              value={formData.name}
              leftIcon={<UserIcon size={16} />}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              onBlur={() => {
                if (formData.name.trim() === "") {
                  setFormData((prev) => ({ ...prev, name: displayName }));
                }
              }}
            />

            {userRole === "USER" && (
              <>
                <Select
                  theme={theme}
                  label="Experience Level"
                  options={experienceOptions}
                  value={formData.experienceLevel}
                  leftIcon={<Briefcase size={16} />}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, experienceLevel: value }))
                  }
                />

                <MultiSelect
                  theme={theme}
                  label="Learning Purpose"
                  options={learningPurposeOptions}
                  value={formData.learningPurpose}
                  onChange={(values) =>
                    setFormData((prev) => ({
                      ...prev,
                      learningPurpose: values,
                    }))
                  }
                  placeholder="Select learning purpose"
                />

                <TextArea
                  theme={theme}
                  label="Bio"
                  placeholder="Write something about yourself..."
                  rows={5}
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, bio: e.target.value }))
                  }
                />
              </>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
