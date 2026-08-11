import { SectionHeading } from "@/components/section-heading";
import { HomeworkWizard } from "@/homework/player/homework-wizard";

const PLANNED_ACTIVITY_FLOW = ["Warm up", "Focused practice", "Use it yourself"];
const MAXIMUM_VISIBLE_SKILLS = 3;
const MAXIMUM_PREVIEW_SENTENCE_LENGTH = 150;

/**
 * A placeholder run of the real wizard, so the teacher sees the exact frame
 * their student will get before a single activity has been generated.
 */
export function BuilderPreview({
  studentName,
  lessonNotes,
  targetSkills,
  durationMinutes,
  difficulty,
  isGenerating,
}: {
  studentName: string | null;
  lessonNotes: string;
  targetSkills: string;
  durationMinutes: number;
  difficulty: string;
  isGenerating: boolean;
}) {
  const skills = parseSkills(targetSkills);
  const hasBrief = lessonNotes.trim().length > 0 || skills.length > 0;
  const previewTitle = skills[0] ? `${capitalize(skills[0])} practice` : "Lesson practice";
  const previewPrompt = lessonNotes.trim()
    ? firstSentence(lessonNotes)
    : "Your activity prompts will appear here once the brief is generated.";
  const visibleSkills = skills.slice(0, MAXIMUM_VISIBLE_SKILLS);
  const remainingSkillCount = Math.max(0, skills.length - visibleSkills.length);

  return (
    <aside className="min-w-0 2xl:sticky 2xl:top-[calc(var(--page-header-height)+1rem)] 2xl:self-start">
      <SectionHeading
        title="Student preview"
        description="The exact wizard your student will work through."
        action={
          <span className="text-[13px] text-muted-foreground">
            {isGenerating ? "Generating…" : "Before generation"}
          </span>
        }
        className="mb-3"
      />

      <HomeworkWizard
        currentStep={1}
        totalSteps={PLANNED_ACTIVITY_FLOW.length}
        eyebrow={studentName ? `Prepared for ${studentName}` : "Independent practice"}
        meta={
          <span className="capitalize numeric">
            {durationMinutes} min · {difficulty}
          </span>
        }
        prompt={
          <h3 className="mt-2.5 max-w-3xl text-balance text-[24px] font-semibold leading-snug tracking-[-0.03em] xl:text-[27px]">
            {previewTitle}
          </h3>
        }
        instructions={previewPrompt}
      >
        {skills.length > 0 ? (
          <p className="text-pretty text-[13px] leading-5 text-muted-foreground xl:text-sm">
            <span className="font-medium text-foreground">Focus:</span> {visibleSkills.join(", ")}
            {remainingSkillCount > 0 ? ` + ${remainingSkillCount} more` : ""}
          </p>
        ) : null}

        <div className={skills.length > 0 ? "mt-6" : undefined}>
          <p className="text-[13px] font-medium text-foreground xl:text-sm">Activity flow</p>
          <ol className="mt-3 grid gap-2">
            {PLANNED_ACTIVITY_FLOW.map((label, index) => (
              <li
                key={label}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-border/70 bg-muted/35 px-3.5"
              >
                <span className="w-5 text-[12px] font-medium text-muted-foreground numeric">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[14px] font-medium xl:text-[15px]">{label}</span>
                <span className="ml-auto text-[12px] text-muted-foreground xl:text-[13px]">
                  {hasBrief ? "Planned" : "Preview"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </HomeworkWizard>

      <p className="mt-3 text-pretty text-[13px] leading-5 text-muted-foreground">
        You’ll review every prompt and answer key before publishing.
      </p>
    </aside>
  );
}

function parseSkills(value: string) {
  return value
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function firstSentence(value: string) {
  const [sentence] = value.trim().split(/(?<=[.!?])\s+/);
  if (!sentence) return "Your activity prompts will appear here after generation.";
  if (sentence.length <= MAXIMUM_PREVIEW_SENTENCE_LENGTH) return sentence;
  return `${sentence.slice(0, MAXIMUM_PREVIEW_SENTENCE_LENGTH - 3).trimEnd()}…`;
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
