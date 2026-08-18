import { describe, expect, test } from "vitest";

import {
  renderFailedRelayAuthPage,
  renderSuccessfulRelayAuthPage,
} from "./relay-auth-callback-page";

describe("Relay auth callback page", () => {
  test("renders a branded successful return state", () => {
    const page = renderSuccessfulRelayAuthPage("https://images.example.com/teacher.jpg?a=1&b=2");

    expect(page).toContain("You’re signed in");
    expect(page).toContain("Relay is open and ready");
    expect(page).toContain("window.close()");
    expect(page).toContain("relay-mark-mask");
    expect(page).toContain("https://images.example.com/teacher.jpg?a=1&amp;b=2");
  });

  test("falls back to the success icon for an unsafe profile image URL", () => {
    const page = renderSuccessfulRelayAuthPage('javascript:alert("nope")');

    expect(page).not.toContain("<img");
    expect(page).not.toContain("javascript:");
    expect(page).toContain('class="status"');
  });

  test("renders a helpful failure state without claiming success", () => {
    const page = renderFailedRelayAuthPage();

    expect(page).toContain("Sign-in didn’t finish");
    expect(page).not.toContain("You’re signed in");
  });
});
