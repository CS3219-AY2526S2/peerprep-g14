import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Award, Blocks, CheckCircle, UserIcon } from "lucide-react";
import { TextArea } from "../components/TextArea";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import "../layouts/Layout.css";
import "./ProfileSetup.css";
import { Input } from "../components/Input";
import { MultiSelect } from "../components/MultiSelect";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile";
import { Spinner } from "../components/Spinner";
import { useUpdateCurrentUserProfile } from "../hooks/useUpdateCurrentUserProfile";
import Card from "../components/Card";
import { useRef } from "react";

export const ProfileSetup: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const {
    data: user,
    isLoading: profileLoading,
    error: profileError,
  } = useCurrentUserProfile();
  const updateProfileMutation = useUpdateCurrentUserProfile();

  // TODO
  // Currently just skip to dashboard if error occurs
  // when loading user's profile
  if (profileError) {
    console.error("Profile error:", profileError);
  }

  const githubDefaultName = user?.name ?? "";
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [learningPurpose, setLearningPurpose] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user]);

  const experienceOptions = [
    { value: "beginner", label: "Beginner (< 1 year)" },
    { value: "intermediate", label: "Intermediate (1-3 years)" },
    { value: "advanced", label: "Advanced (> 3 years)" },
  ];

  const purposeOptions = [
    { value: "casual", label: "Casual studying" },
    { value: "interview", label: "Interview preparation" },
  ];

  // Add more states here if needed as required fields
  const completedRequired =
    name.trim() !== "" &&
    experienceLevel.trim() !== "" &&
    learningPurpose.length !== 0;

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("userId", userId!);
    formData.append("image", file);

    const res = await fetch("http://localhost:3001/profile/picture", {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await res.json();
    console.log(data);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await handleUpload(file);

    // reset so user can re-select the same file later
    e.target.value = "";
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!userId) {
      alert("User ID is missing. Please log in again.");
      navigate("/");
      return;
    }

    setIsLoading(true);

    try {
      await updateProfileMutation.mutateAsync({
        userId,
        name,
        experienceLevel,
        learningPurpose,
        bio,
      });

      // Successfully updated
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Just go to dashboard
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="background-default page-shell">
      <div className="dotted-card dotted-card-user">
        <main className="container">
          <Card
            theme="user"
            title="You're almost there..."
            subtitle="Tell us a bit about yourself so we can find the best peers for your mock interviews"
            headerAlign="center"
            showDivider
            floating
            className="setup-card"
            contentClassName="form-container"
            fullWidth={false}
          >
            {profileLoading ? (
              <div className="load-profile-container">
                <Spinner spinnerTheme="user" size="lg" />
                <h1 className="subtitle">
                  We're getting your profile ready...
                </h1>
              </div>
            ) : (
              <>
                <form onSubmit={handleSubmit}>
                  <div>
                    <div className="profile-picture-container">
                      <button
                        type="button"
                        className="profile-picture-avatar"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Edit Profile Picture"
                      >
                        <UserIcon size={72} />
                      </button>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                      />
                    </div>

                    <Input
                      label="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        if (name.trim() === "") {
                          setName(githubDefaultName);
                        }
                      }}
                      variant="solid"
                    />
                    <div className="form-description">
                      Will default to your Github username.
                    </div>
                  </div>

                  <div>
                    <Select
                      label="Experience Level"
                      placeholder="Select Experience Level"
                      options={experienceOptions}
                      value={experienceLevel}
                      onChange={setExperienceLevel}
                      leftIcon={<Award className="h-5 w-5" />}
                    />
                    <p className="form-description">
                      This helps us match you with peers of similar skill
                      levels.
                    </p>
                  </div>

                  <MultiSelect
                    label="Learning Purpose"
                    placeholder="Select Learning Purpose"
                    options={purposeOptions}
                    value={learningPurpose}
                    onChange={setLearningPurpose}
                    leftIcon={<Blocks className="h-5 w-5" />}
                  />

                  <TextArea
                    label="Bio (Optional)"
                    placeholder="I'm a self-taught developer looking to practice my React and Python skills!"
                    onChange={(e) => setBio(e.target.value)}
                  />

                  <div className="button-container">
                    <Button
                      type="submit"
                      variant="solid"
                      size="sm"
                      theme="user"
                      className="w-full"
                      isLoading={isLoading}
                      rightIcon={<CheckCircle className="h-5 w-5" />}
                      disabled={!completedRequired}
                    >
                      Complete Setup
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                    >
                      Skip for now
                    </Button>
                  </div>
                </form>
              </>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
};
