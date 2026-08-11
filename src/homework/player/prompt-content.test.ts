import { describe, expect, it } from "vitest";

import { parseEnumeratedPrompt, parseNumberedPrompt } from "./prompt-content";

describe("parseNumberedPrompt", () => {
  it("separates an instruction from sequential parenthesized items", () => {
    expect(
      parseNumberedPrompt(
        "Rewrite each sentence correctly. 1) She didn't went home. 2) Did you saw it?",
      ),
    ).toEqual({
      instruction: "Rewrite each sentence correctly.",
      items: ["She didn't went home.", "Did you saw it?"],
      marker: "number",
    });
  });

  it("supports sequential period markers", () => {
    expect(parseNumberedPrompt("Review these examples: 1. First example 2. Second example")).toEqual(
      {
        instruction: "Review these examples:",
        items: ["First example", "Second example"],
        marker: "number",
      },
    );
  });

  it("leaves ambiguous or non-sequential prose untouched", () => {
    expect(parseNumberedPrompt("Chapter 1. Review the material 2. Write a response")).toBeNull();
    expect(parseNumberedPrompt("Fix these examples: 1. First 3. Third")).toBeNull();
  });
});

describe("parseEnumeratedPrompt", () => {
  it("turns lettered sub-requirements into a list instead of a wall of bold", () => {
    expect(
      parseEnumeratedPrompt(
        "Write 4-6 sentences about a skill you have been improving recently (a language, a sport, a hobby). Include: (a) one present perfect sentence, (b) one past simple sentence, (c) one second conditional.",
      ),
    ).toEqual({
      instruction:
        "Write 4-6 sentences about a skill you have been improving recently (a language, a sport, a hobby). Include:",
      items: [
        "one present perfect sentence",
        "one past simple sentence",
        "one second conditional.",
      ],
      marker: "letter",
    });
  });

  it("ignores parentheses that merely start with a letter and a space", () => {
    expect(
      parseEnumeratedPrompt("Choose the better option (a hour or an hour) and explain why."),
    ).toBeNull();
  });

  it("requires the letters to run in order", () => {
    expect(
      parseEnumeratedPrompt("Include the following: (a) a question, (c) a negative sentence."),
    ).toBeNull();
  });

  it("prefers numbered items when a prompt has both", () => {
    const parsed = parseEnumeratedPrompt(
      "Correct these sentences: 1. He go home. 2. She (a) likes it (b) like it.",
    );

    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.items[0]).toBe("He go home.");
  });
});
