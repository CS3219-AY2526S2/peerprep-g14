/** Persist active match request id across refresh / tab close (F9). */
export const PEERPREP_ACTIVE_MATCH_REQUEST_ID_KEY =
  "peerprep_active_match_request_id";

export function setActiveMatchRequestId(id: string): void {
  try {
    localStorage.setItem(PEERPREP_ACTIVE_MATCH_REQUEST_ID_KEY, id);
  } catch {
    /* ignore quota / private mode */
  }
}

export function getActiveMatchRequestId(): string | null {
  try {
    const local = localStorage.getItem(PEERPREP_ACTIVE_MATCH_REQUEST_ID_KEY);
    if (local) return local;
    // Backward-compat for older sessions written before migration.
    return sessionStorage.getItem(PEERPREP_ACTIVE_MATCH_REQUEST_ID_KEY);
  } catch {
    return null;
  }
}

export function clearActiveMatchRequestId(): void {
  try {
    localStorage.removeItem(PEERPREP_ACTIVE_MATCH_REQUEST_ID_KEY);
    sessionStorage.removeItem(PEERPREP_ACTIVE_MATCH_REQUEST_ID_KEY);
  } catch {
    /* ignore */
  }
}
