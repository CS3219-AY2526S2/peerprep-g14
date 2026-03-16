import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Award, Blocks, CheckCircle } from "lucide-react";
import { TextArea } from "../components/TextArea";
import { Select } from "../components/Select";
import { Button } from "../components/Button";
import "../styles/Layout.css";
import "./ProfileSetup.css";
import { Input } from "../components/Input";
import { MultiSelect } from "../components/MultiSelect";
import { useCurrentUserProfile } from "../hooks/useCurrentUserProfile";
import { Spinner } from "../components/Spinner";
import { useUpdateCurrentUserProfile } from "../hooks/useUpdateCurrentUserProfile";

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
    <div className="linear-gradient-background page-shell">
      <main className="container">
        <div className="setup-card">
          {profileLoading ? (
            <div className="load-profile-container">
              <Spinner size="lg" />
              <h1 className="subtitle">We're getting your profile ready...</h1>
            </div>
          ) : (
            <>
              <div className="title-container">
                <h1 className="title">You're almost there...</h1>
                <p className="subtitle">
                  Tell us a bit about yourself so we can find the best peers for
                  your mock interviews.
                </p>
              </div>
              <div className="thin-line" />

              <div className="form-container">
                <form onSubmit={handleSubmit}>
                  <div>
                    <Input
                      label="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => {
                        if (name.trim() === "") {
                          setName(githubDefaultName);
                        }
                      }}
                    />
                    <p className="form-description">
                      Will default to your Github username.
                    </p>
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
                      size="lg"
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
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
