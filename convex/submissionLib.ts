import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  describeCorrectAnswer,
  describeResponse,
  gradeResponse,
  gradeResponseParts,
  isAutoGradable,
  toPublicContent,
} from "./content";
import { loadSubmissionFeedback } from "./feedback";
import { MAX_QUESTIONS } from "./limits";


/**
 * What this submission is worth, and what it scored, from the questions rather
 * than from the answers that happen to exist.
 *
 * Counting only answered questions is how a score used to grow for free: a
 * student who skipped half a worksheet scored 4/22, and the moment the teacher
 * graded one written answer the denominator shrank to what had been attempted
 * and the same work became 4/10. A skipped gap is a lost point, not a smaller
 * worksheet, so every auto-graded question counts whether or not it was
 * answered. A written answer counts once the teacher has decided it — before
 * that it is pending, and pending work must not drag the score down either.
 */
export async function calculateSubmissionTotals(
  ctx: QueryCtx,
  submission: { _id: Id<"submissions">; assignmentId: Id<"assignments"> },
) {
  const questions = await ctx.db
    .query("assignmentQuestions")
    .withIndex("by_assignmentId_and_order", (q) =>
      q.eq("assignmentId", submission.assignmentId),
    )
    .take(MAX_QUESTIONS);
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
    .take(MAX_QUESTIONS);
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  let score = 0;
  let maxScore = 0;
  let pendingReviewCount = 0;
  for (const question of questions) {
    const answer = answersByQuestionId.get(question._id);
    const isDecided =
      answer?.correctness !== undefined && answer.correctness !== "pending_review";
    if (isAutoGradable(question.content)) {
      maxScore += question.points;
      score += isDecided ? (answer?.pointsAwarded ?? 0) : 0;
      continue;
    }
    // A written activity the student never opened is not waiting for anybody.
    if (!answer) continue;
    if (!isDecided) {
      pendingReviewCount += 1;
      continue;
    }
    maxScore += question.points;
    score += answer.pointsAwarded ?? 0;
  }

  return { score, maxScore, pendingReviewCount };
}

export async function loadSubmissionDetail(
  ctx: QueryCtx,
  submissionId: Id<"submissions">,
  ownerId?: Id<"users">,
) {
  const submission = await ctx.db.get("submissions", submissionId);
  if (!submission || (ownerId && submission.ownerId !== ownerId)) return null;

  const assignment = await ctx.db.get("assignments", submission.assignmentId);
  const questions = await ctx.db
    .query("assignmentQuestions")
    .withIndex("by_assignmentId_and_order", (q) =>
      q.eq("assignmentId", submission.assignmentId),
    )
    .order("asc")
    .take(MAX_QUESTIONS);
  const answers = await ctx.db
    .query("answers")
    .withIndex("by_submissionId", (q) => q.eq("submissionId", submission._id))
    .take(MAX_QUESTIONS);
  const feedback = await loadSubmissionFeedback(ctx, submission._id);
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  const detailedAnswers = questions.map((question) => {
    const answer = answersByQuestionId.get(question._id);
    /**
     * Correctness is written when the student submits, so an attempt still in
     * progress had none — and the teacher's page, which colours the answer from
     * it, drew every picked option in the same affirmative green whether it was
     * right or wrong. The machine can mark an answer the moment it exists, so it
     * does, and the verdict is flagged as not final rather than withheld.
     */
    const provisional =
      answer && !answer.correctness && isAutoGradable(question.content)
        ? gradeResponse(question.content, answer.response, question.points)
        : null;
    return {
      questionId: question._id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      instructions: question.instructions,
      content: question.content,
      publicContent: toPublicContent(question.content),
      ...(question.set ? { set: question.set } : {}),
      skillTags: question.skillTags,
      points: question.points,
      answered: answer !== undefined,
      /**
       * Per-blank, per-gap and per-pair verdicts. The teacher reads the answer
       * inside the widget the student used, so the widget has to know which of
       * its parts went wrong — without this it renders a wrong answer in the
       * same confident green as a right one.
       */
      parts: answer ? gradeResponseParts(question.content, answer.response) : [],
      ...(answer ? { response: answer.response } : {}),
      ...(answer?.pointsAwarded === undefined
        ? provisional
          ? { pointsAwarded: provisional.pointsAwarded }
          : {}
        : { pointsAwarded: answer.pointsAwarded }),
      ...(answer?.correctness
        ? { correctness: answer.correctness }
        : provisional
          ? { correctness: provisional.correctness }
          : {}),
      /** True while the student could still change this answer. */
      isProvisional: provisional !== null,
      responseText: answer ? describeResponse(answer.response, question.content) : "",
      correctAnswer: describeCorrectAnswer(question.content),
      explanation: question.explanation,
      activeMs: answer?.activeMs ?? 0,
      lookupCount: answer?.lookupCount ?? 0,
      revisionCount: answer?.revisionCount ?? 0,
    };
  });

  return {
    _id: submission._id,
    assignmentTitle: assignment?.title ?? "Homework",
    studentName: submission.studentName,
    studentId: submission.studentId ?? null,
    status: submission.status,
    startedAt: submission.startedAt,
    ...(submission.submittedAt ? { submittedAt: submission.submittedAt } : {}),
    ...(submission.score === undefined ? {} : { score: submission.score }),
    maxAutoScore: submission.maxAutoScore,
    activeMs: submission.activeMs ?? 0,
    lookupCount: submission.lookupCount ?? 0,
    ...(submission.aiSummary ? { aiSummary: submission.aiSummary } : {}),
    ...(feedback ? { feedback } : {}),
    answers: detailedAnswers,
  };
}
