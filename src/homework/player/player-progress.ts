import type { Id } from "@convex/_generated/dataModel";
import { UNSELECTED_OPTION, type AnswerResponse, type PlayerQuestion } from "./answer-types";

export const PLAYER_STORAGE_VERSION = 1 as const;
const PLAYER_STORAGE_KEY_PREFIX = "erm:homework-player:v1:";

export interface PlayerSession {
  submissionId: Id<"submissions">;
  resumeToken: string;
  studentName: string;
}

export interface PlayerResult {
  score: number;
  maxAutoScore: number;
  percentage: number;
  pendingReviewCount: number;
}

export interface StoredPlayerProgress {
  version: typeof PLAYER_STORAGE_VERSION;
  session: PlayerSession;
  index: number;
  responses: Record<string, AnswerResponse>;
  result?: PlayerResult;
}

export interface RestoredQuestionState {
  index: number;
  responses: Record<string, AnswerResponse>;
}

export function createStoredPlayerProgress(session: PlayerSession): StoredPlayerProgress {
  return {
    version: PLAYER_STORAGE_VERSION,
    session,
    index: 0,
    responses: {},
  };
}

export function readStoredPlayerProgress(shareToken: string): StoredPlayerProgress | null {
  if (typeof window === "undefined") return null;

  const storageKey = getPlayerStorageKey(shareToken);
  try {
    const serializedProgress = window.localStorage.getItem(storageKey);
    if (!serializedProgress) return null;

    const parsedProgress = parseStoredPlayerProgress(serializedProgress);
    if (parsedProgress) return parsedProgress;

    window.localStorage.removeItem(storageKey);
    return null;
  } catch {
    return null;
  }
}

export function parseStoredPlayerProgress(serializedProgress: string): StoredPlayerProgress | null {
  try {
    const parsedProgress: unknown = JSON.parse(serializedProgress);
    return isStoredPlayerProgress(parsedProgress) ? parsedProgress : null;
  } catch {
    return null;
  }
}

export function writeStoredPlayerProgress(
  shareToken: string,
  progress: StoredPlayerProgress,
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getPlayerStorageKey(shareToken), JSON.stringify(progress));
  } catch {
    // The player stays usable in private mode or when storage is full.
  }
}

export function writeStoredPlayerResult(shareToken: string, result: PlayerResult) {
  const progress = readStoredPlayerProgress(shareToken);
  if (!progress) return;
  writeStoredPlayerProgress(shareToken, { ...progress, result });
}

export function clearStoredPlayerProgress(shareToken: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(getPlayerStorageKey(shareToken));
  } catch {
    // A stale snapshot is harmless when storage is unavailable.
  }
}

export function restoreQuestionState(
  progress: StoredPlayerProgress | null,
  questions: PlayerQuestion[],
): RestoredQuestionState {
  if (!progress) return { index: 0, responses: {} };

  const responses: Record<string, AnswerResponse> = {};
  for (const question of questions) {
    const storedResponse = progress.responses[question._id];
    if (storedResponse && isResponseCompatible(question, storedResponse)) {
      responses[question._id] = storedResponse;
    }
  }

  const lastQuestionIndex = Math.max(0, questions.length - 1);
  return { index: Math.min(progress.index, lastQuestionIndex), responses };
}

function getPlayerStorageKey(shareToken: string) {
  return `${PLAYER_STORAGE_KEY_PREFIX}${shareToken}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAnswerResponse(value: unknown): value is AnswerResponse {
  if (!isRecord(value) || typeof value.kind !== "string") return false;

  switch (value.kind) {
    case "choice":
      return typeof value.choiceIndex === "number" && Number.isInteger(value.choiceIndex);
    case "choices":
      return (
        Array.isArray(value.choiceIndices) &&
        value.choiceIndices.every((choice) => Number.isInteger(choice))
      );
    case "blanks":
      return isStringArray(value.values);
    case "matches":
      return isStringArray(value.rights);
    case "selections":
      return (
        Array.isArray(value.selectedOptions) &&
        value.selectedOptions.every((option) => Number.isInteger(option))
      );
    case "text":
      return typeof value.text === "string";
    default:
      return false;
  }
}

function isPlayerSession(value: unknown): value is PlayerSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.submissionId === "string" &&
    typeof value.resumeToken === "string" &&
    typeof value.studentName === "string"
  );
}

function isPlayerResult(value: unknown): value is PlayerResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.score === "number" &&
    typeof value.maxAutoScore === "number" &&
    typeof value.percentage === "number" &&
    typeof value.pendingReviewCount === "number"
  );
}

function isStoredPlayerProgress(value: unknown): value is StoredPlayerProgress {
  if (!isRecord(value)) return false;
  if (value.version !== PLAYER_STORAGE_VERSION) return false;
  if (!isPlayerSession(value.session)) return false;
  if (typeof value.index !== "number" || !Number.isInteger(value.index) || value.index < 0) {
    return false;
  }
  if (!isRecord(value.responses)) return false;
  if (!Object.values(value.responses).every(isAnswerResponse)) return false;
  return value.result === undefined || isPlayerResult(value.result);
}

function isResponseCompatible(question: PlayerQuestion, response: AnswerResponse) {
  switch (question.content.kind) {
    case "multiple_choice":
      if (response.kind === "choice") {
        return response.choiceIndex >= -1 && response.choiceIndex < question.content.choices.length;
      }
      const { choices } = question.content;
      return (
        response.kind === "choices" &&
        response.choiceIndices.every(
          (choiceIndex) => choiceIndex >= 0 && choiceIndex < choices.length,
        )
      );
    case "fill_blank":
      return response.kind === "blanks" && response.values.length === question.content.blankCount;
    case "select_cloze": {
      const { gaps } = question.content;
      return (
        response.kind === "selections" &&
        response.selectedOptions.length === gaps.length &&
        response.selectedOptions.every(
          (option, gapIndex) =>
            option === UNSELECTED_OPTION ||
            (option >= 0 && option < (gaps[gapIndex]?.options.length ?? 0)),
        )
      );
    }
    case "matching": {
      const availableRights = question.content.rights;
      return (
        response.kind === "matches" &&
        response.rights.length === question.content.lefts.length &&
        response.rights.every((right) => right.length === 0 || availableRights.includes(right))
      );
    }
    case "proofread":
      return (
        response.kind === "blanks" &&
        response.values.length === question.content.errors.length
      );
    // Both are answered by typing, so a saved answer restores the same way.
    case "error_fix":
    case "open_response":
      return response.kind === "text";
  }
}
