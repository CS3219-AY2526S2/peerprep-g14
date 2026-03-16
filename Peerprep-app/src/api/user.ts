export type CurrentUserProfile = {
  userId: string;
  email: string;
  name: string | null;
  bio: string | null;
  experienceLevel: string | null;
  learningPurpose: string[];
  profilePicUrl: string | null;
  role: string;
};

export type UpdateCurrentUserProfilePayload = {
  userId: string;
  name: string | null;
  experienceLevel: string | null;
  learningPurpose: string[];
  bio: string | null;
};

export async function getCurrentUserProfile(): Promise<CurrentUserProfile> {
  const response = await fetch(`http://localhost/api/user/profile/me`, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Failed to fetch current user profile");
  }

  return response.json();
}

export async function updateCurrentUserProfile(
  payload: UpdateCurrentUserProfilePayload,
): Promise<CurrentUserProfile> {
  const response = await fetch(`http://localhost/api/user/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || "Failed to update current user profile");
  }

  const data = await response.json();
  return data.user;
}
