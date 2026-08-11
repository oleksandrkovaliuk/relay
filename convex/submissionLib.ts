import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { describeCorrectAnswer, describeResponse, toPublicContent } from "./content";
import { loadSubmissionFeedback } from "./feedback";

const MAX_QUESTIONS = 40;

export async function loadSubmissionDetail(ctx: QueryCtx, submissionId: Id<"submissions">) {
  const submission = await ctx.db.get("submissions", submissionId);
  if (!submission) return null;

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
    return {
      questionId: question._id,
      order: question.order,
      type: question.type,
      prompt: question.prompt,
      instructions: question.instructions,
      content: question.content,
      publicContent: toPublicContent(question.content),
      skillTags: question.skillTags,
      points: question.points,
      answered: answer !== undefined,
      ...(answer ? { response: answer.response } : {}),
      ...(answer?.pointsAwarded === undefined ? {} : { pointsAwarded: answer.pointsAwarded }),
      ...(answer?.correctness ? { correctness: answer.correctness } : {}),
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
