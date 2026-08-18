/**
 * Read limits shared by every function that walks a homework set. One worksheet
 * is now ten or more items per activity type, so a limit that was copied into
 * five files and raised in three of them is how a long set silently loses its
 * last section from a score, a summary or a chart.
 */
export const MAX_QUESTIONS = 150;

/** Assignees on one homework. */
export const MAX_ASSIGNEES = 200;

/** Rows a teacher-facing list reads before it needs paginating. */
export const MAX_ASSIGNMENTS = 100;
