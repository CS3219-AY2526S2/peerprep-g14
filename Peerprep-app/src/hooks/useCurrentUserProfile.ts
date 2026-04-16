import { useQuery } from "@tanstack/react-query";
import { getCurrentUserProfile } from "../api/user";

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ["currentUserProfile"],
    queryFn: getCurrentUserProfile,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
