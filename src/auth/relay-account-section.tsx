import { useClerk, useUser } from "@clerk/electron/react";

import { Button } from "@/components/ui/button";

export function RelayAccountSection() {
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/70 bg-card px-4 py-3.5">
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-medium">{user?.fullName ?? "Relay teacher"}</p>
        <p className="truncate text-[12.5px] text-muted-foreground">
          {user?.primaryEmailAddress?.emailAddress ?? "Signed in with Google"}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
