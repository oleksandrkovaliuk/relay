import { describe, expect, it } from "vitest";

import { readShareToken } from "./read-share-token";

const VALID_TOKEN = "4a04f8af-10e7-4301-a8dc-e0231923faaa";

describe("readShareToken", () => {
  it("reads the token from a path segment", () => {
    expect(readShareToken({ pathname: `/h/${VALID_TOKEN}`, search: "" })).toBe(VALID_TOKEN);
  });

  it("reads the token from a query string", () => {
    expect(readShareToken({ pathname: "/", search: `?h=${VALID_TOKEN}` })).toBe(VALID_TOKEN);
  });

  it("prefers the query token when both are present", () => {
    expect(readShareToken({ pathname: "/h/ignored", search: `?h=${VALID_TOKEN}` })).toBe(
      VALID_TOKEN,
    );
  });

  it("rejects paths that are not share tokens", () => {
    expect(readShareToken({ pathname: "/", search: "" })).toBeNull();
    expect(readShareToken({ pathname: "/index.html", search: "" })).toBeNull();
    expect(readShareToken({ pathname: "/h/short", search: "" })).toBeNull();
  });
});
