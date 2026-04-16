-- Baseline: MatchRequest + enums (includes F9 reconnect grace columns and RECONNECT_EXPIRED status).
-- Clean slate when types/table already exist (e.g. old migrations on Supabase, empty tables).
DROP TABLE IF EXISTS "MatchRequest" CASCADE;
DROP TYPE IF EXISTS "MatchingPairType" CASCADE;
DROP TYPE IF EXISTS "MatchRequestStatus" CASCADE;

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "MatchRequestStatus" AS ENUM (
  'PENDING',
  'MATCHED',
  'CANCELLED',
  'TIMED_OUT',
  'RECONNECT_EXPIRED'
);

CREATE TYPE "MatchingPairType" AS ENUM ('SAME_DIFFICULTY', 'DOWNWARD');

CREATE TABLE "MatchRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "programmingLanguage" TEXT NOT NULL,
    "allowLowerDifficultyMatch" BOOLEAN NOT NULL DEFAULT false,
    "timeAvailableMinutes" INTEGER,
    "status" "MatchRequestStatus" NOT NULL DEFAULT 'PENDING',
    "peerUserId" TEXT,
    "peerMatchRequestId" TEXT,
    "peerRequestedDifficulty" TEXT,
    "peerTimeAvailableMinutes" INTEGER,
    "matchingPairType" "MatchingPairType",
    "disconnectedAt" TIMESTAMP(3),
    "reconnectDeadlineAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MatchRequest_topic_programmingLanguage_idx" ON "MatchRequest"("topic", "programmingLanguage");

CREATE INDEX "MatchRequest_status_topic_programmingLanguage_difficulty_idx" ON "MatchRequest"("status", "topic", "programmingLanguage", "difficulty");

CREATE UNIQUE INDEX "MatchRequest_one_pending_per_user" ON "MatchRequest"("userId") WHERE ("status" = 'PENDING');
