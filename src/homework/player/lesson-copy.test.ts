import { describe, expect, it } from "vitest";

import { splitLessonTitle, summaryForStudent } from "./lesson-copy";

describe("splitLessonTitle", () => {
  it("drops the student's name and splits the topic from its focus", () => {
    expect(
      splitLessonTitle(
        "Mira — Work Trip English: Past Simple, Present Simple & Articles (Advanced Review)",
        "Mira Petrova",
      ),
    ).toEqual({
      topic: "Work Trip English",
      focus: "Past Simple, Present Simple & Articles (Advanced Review)",
    });
  });

  it("keeps the whole title when there is nothing to split", () => {
    expect(splitLessonTitle("Articles practice", "Mira")).toEqual({
      topic: "Articles practice",
      focus: null,
    });
  });

  it("keeps the whole title when the leading half is a sentence, not a topic", () => {
    const title = "A long warm-up covering everything from last week: articles";
    expect(splitLessonTitle(title, null)).toEqual({ topic: title, focus: null });
  });

  it("leaves a title alone when the name is not a prefix", () => {
    expect(splitLessonTitle("Homework for Mira", "Mira").topic).toBe("Homework for Mira");
  });
});

describe("summaryForStudent", () => {
  it("stops at the teacher note", () => {
    const summary =
      "A 60-minute review built around your two error patterns. TEACHER NOTE: the Miro board could not be read, so review before assigning.";

    expect(summaryForStudent(summary)).toBe(
      "A 60-minute review built around your two error patterns.",
    );
  });

  it("keeps only the opening sentences of a long summary", () => {
    const summary = [
      "A short set on articles.",
      "It doubles as a second attempt at the material scored 20% on.",
      "Widget mix: 4 multiple choice, 3 fill-in-the-blank, 2 matching, 2 rewrite, 1 short answer.",
    ].join(" ");

    const lede = summaryForStudent(summary);
    expect(lede.startsWith("A short set on articles.")).toBe(true);
    expect(lede).not.toContain("Widget mix");
  });

  it("keeps a single long sentence rather than returning nothing", () => {
    const summary = `${"word ".repeat(80)}end.`;
    expect(summaryForStudent(summary)).toContain("end.");
  });
});
