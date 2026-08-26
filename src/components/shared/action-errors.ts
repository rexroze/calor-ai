/**
 * Server actions throw bare string codes (see lib/contracts.ts). Dev builds
 * surface the message verbatim; production masks it behind a digest, so we
 * match known codes anywhere in the string and fall back to neutral copy.
 */

const CODE_COPY = {
  UNAUTHORIZED: "Your session expired. Please sign in again.",
  MEAL_NOT_FOUND: "That meal no longer exists.",
  INVALID_DATE: "That date looks off. Head back and pick another day.",
  INVALID_EATEN_AT: "That timestamp looks off. Please try again.",
  AI_ANALYSIS_FAILED:
    "Couldn't read that photo. Try again with a clearer, closer shot.",
} as const;

type ActionErrorCode = keyof typeof CODE_COPY;

function isActionErrorCode(value: string): value is ActionErrorCode {
  return value in CODE_COPY;
}

/** Human copy for a thrown server-action error, matched against known codes. */
export function describeActionError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  for (const part of raw.split(/[^A-Z_]+/)) {
    if (isActionErrorCode(part)) {
      return CODE_COPY[part];
    }
  }
  return "Something went wrong. Please try again.";
}
