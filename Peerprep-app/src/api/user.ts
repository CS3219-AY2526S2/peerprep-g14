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
  const response = await fetch(`/api/user/profile/me`, {
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
  console.log("updateCurrentUserProfile payload:", payload);
  console.log("about to call fetch");

  const response = await fetch(`/api/user/profile`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  console.log("fetch returned");
  console.log("response status:", response.status);
  console.log("response ok:", response.ok);

  const rawText = await response.text();
  console.log("raw response body:", rawText);

  if (!response.ok) {
    throw new Error(rawText || "Failed to update current user profile");
  }

  const data = rawText ? JSON.parse(rawText) : null;
  console.log("parsed response json:", data);

  return data.user ?? data;
}
