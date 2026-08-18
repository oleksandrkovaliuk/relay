import { ConvexError } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function requireCurrentUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError("Authentication required.");
  const user = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (query) =>
      query.eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .unique();
  if (!user) throw new ConvexError("Relay account setup is not complete.");
  return user;
}

export function requireOwned<T extends { ownerId?: Doc<"users">["_id"] }>(
  value: T | null,
  ownerId: Doc<"users">["_id"],
  notFoundMessage: string,
): T {
  if (!value || value.ownerId !== ownerId) throw new ConvexError(notFoundMessage);
  return value;
}
