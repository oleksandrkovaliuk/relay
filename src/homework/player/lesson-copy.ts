/**
 * Homework titles and summaries are written by the teacher's generation prompt,
 * so they carry things a student should never have to read: their own name as a
 * filing prefix, widget tallies, and notes addressed to the teacher. These turn
 * that into an opening screen a student actually wants to look at.
 */

/** Anything from here on in a summary is addressed to the teacher, not the student. */
const TEACHER_NOTE_PATTERN = /\b(teacher note|note to teacher|note for teacher)\b\s*:?/i;
const SENTENCE_PATTERN = /[^.!?]+(?:[.!?]+|$)/g;
/** Two sentences of framing is plenty before the objectives take over. */
const MAXIMUM_LEDE_SENTENCES = 2;
const MAXIMUM_LEDE_LENGTH = 240;
/** Past this, the leading half of a title is the whole title, not a topic. */
const MAXIMUM_TOPIC_LENGTH = 42;

export type LessonTitle = {
  /** The short headline: what the lesson is about. */
  topic: string;
  /** The grammar or skill focus, when the title carried one. */
  focus: string | null;
};

/**
 * Splits `Mira — Work Trip English: Past Simple & Articles` into a short topic
 * and its focus, dropping the student's name — they know who they are.
 */
export function splitLessonTitle(title: string, studentName: string | null): LessonTitle {
  const withoutStudentPrefix = stripStudentPrefix(title.trim(), studentName);
  const separatorIndex = withoutStudentPrefix.indexOf(":");
  if (separatorIndex < 1) return { topic: withoutStudentPrefix, focus: null };

  const topic = withoutStudentPrefix.slice(0, separatorIndex).trim();
  const focus = withoutStudentPrefix.slice(separatorIndex + 1).trim();
  if (!topic || !focus || topic.length > MAXIMUM_TOPIC_LENGTH) {
    return { topic: withoutStudentPrefix, focus: null };
  }
  return { topic, focus };
}

/**
 * The first sentences of the summary, without the teacher-facing tail. Students
 * get the point of the homework; the teacher's notes stay with the teacher.
 */
export function summaryForStudent(summary: string) {
  const teacherNote = TEACHER_NOTE_PATTERN.exec(summary);
  const studentFacing = (teacherNote ? summary.slice(0, teacherNote.index) : summary).trim();
  const sentences = studentFacing.match(SENTENCE_PATTERN);
  if (!sentences) return studentFacing;

  let lede = "";
  for (const sentence of sentences.slice(0, MAXIMUM_LEDE_SENTENCES)) {
    if (lede && lede.length + sentence.length > MAXIMUM_LEDE_LENGTH) break;
    lede += sentence;
  }
  return lede.trim() || studentFacing;
}

function stripStudentPrefix(title: string, studentName: string | null) {
  const firstName = studentName?.trim().split(/\s+/)[0];
  if (!firstName) return title;

  const prefix = new RegExp(`^${escapeForRegExp(firstName)}\\s*[—–:-]\\s*`, "i");
  return title.replace(prefix, "").trim() || title;
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
