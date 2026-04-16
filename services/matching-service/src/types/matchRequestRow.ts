/**
 * Scalar shape of `MatchRequest` — mirrors `prisma/schema.prisma`.
 * Used for DTO mapping so we do not rely on editor resolution of generated Prisma types.
 */
export type MatchRequestRow = {
  id: string;
  userId: string;
  topic: string;
  difficulty: string;
  programmingLanguage: string;
  allowLowerDifficultyMatch: boolean;
  timeAvailableMinutes: number | null;
  status:
    | "PENDING"
    | "MATCHED"
    | "CANCELLED"
    | "TIMED_OUT"
    | "RECONNECT_EXPIRED";
  peerUserId: string | null;
  peerMatchRequestId: string | null;
  peerRequestedDifficulty: string | null;
  peerTimeAvailableMinutes: number | null;
  matchingPairType: "SAME_DIFFICULTY" | "DOWNWARD" | null;
  disconnectedAt: Date | null;
  reconnectDeadlineAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
