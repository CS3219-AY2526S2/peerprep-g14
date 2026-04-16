import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateCurrentUserProfile,
  type UpdateCurrentUserProfilePayload,
} from "../api/user";

export function useUpdateCurrentUserProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateCurrentUserProfilePayload) =>
      updateCurrentUserProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["currentUserProfile"],
      });
    },
  });
}
