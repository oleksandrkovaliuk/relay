/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";

import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const ISSUER = "https://relay-tests.clerk.accounts.dev";

function asTeacher(backend: ReturnType<typeof convexTest>, subject: string) {
  return backend.withIdentity({
    issuer: ISSUER,
    subject,
    tokenIdentifier: `${ISSUER}|${subject}`,
    email: `${subject}@example.com`,
  });
}

describe("teacher data ownership", () => {
  test("rejects anonymous access to teacher resources", async () => {
    const backend = convexTest(schema, modules);

    await expect(backend.query(api.students.list)).rejects.toThrow(/authentication required/i);
    await expect(backend.query(api.assignments.listPublished)).rejects.toThrow(
      /authentication required/i,
    );
  });

  test("isolates every private record by Clerk user while public links keep working", async () => {
    const backend = convexTest(schema, modules);
    const owner = asTeacher(backend, "teacher-owner");
    const outsider = asTeacher(backend, "teacher-outsider");
    const ownerUser = await owner.mutation(api.users.ensureCurrent);
    await outsider.mutation(api.users.ensureCurrent);

    const shareToken = "public-owner-homework-00000";
    const seeded = await owner.mutation(internal.seed.demoHomework, {
      shareToken,
      ownerId: ownerUser._id,
    });

    expect(await owner.query(api.students.list)).toHaveLength(1);
    expect(await outsider.query(api.students.list)).toEqual([]);
    expect(await outsider.query(api.students.get, { studentId: seeded.studentId })).toBeNull();
    await expect(
      outsider.mutation(api.students.archive, { studentId: seeded.studentId }),
    ).rejects.toThrow(/student not found/i);

    const publicHomework = await backend.query(api.assignments.getPublic, { shareToken });
    expect(publicHomework?.title).toMatch(/Travel stories/);
    const started = await backend.mutation(api.submissions.start, {
      shareToken,
      resumeToken: "public-resume-token-00000000",
    });
    expect(
      await backend.query(api.submissions.review, {
        submissionId: started.submissionId,
        resumeToken: "public-resume-token-00000000",
      }),
    ).not.toBeNull();
  });
});
