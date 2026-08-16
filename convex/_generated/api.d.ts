/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as aiJobs from "../aiJobs.js";
import type * as assignments from "../assignments.js";
import type * as content from "../content.js";
import type * as dashboard from "../dashboard.js";
import type * as feed from "../feed.js";
import type * as feedback from "../feedback.js";
import type * as seed from "../seed.js";
import type * as students from "../students.js";
import type * as submissionLib from "../submissionLib.js";
import type * as submissions from "../submissions.js";
import type * as teaching from "../teaching.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  aiJobs: typeof aiJobs;
  assignments: typeof assignments;
  content: typeof content;
  dashboard: typeof dashboard;
  feed: typeof feed;
  feedback: typeof feedback;
  seed: typeof seed;
  students: typeof students;
  submissionLib: typeof submissionLib;
  submissions: typeof submissions;
  teaching: typeof teaching;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
};
