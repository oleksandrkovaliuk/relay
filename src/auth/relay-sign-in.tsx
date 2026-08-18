import { SignIn } from "@clerk/react";

import { RelayLogo } from "@/components/relay-logo";

export function RelaySignIn() {
  return (
    <main className="grid min-h-screen place-items-center bg-workspace-surface px-5 py-12 text-foreground">
      <section className="grid w-full max-w-[420px] justify-items-center gap-6">
        <div className="grid justify-items-center gap-3 text-center">
          <RelayLogo markSize={25} />
          <p className="max-w-sm text-pretty text-[13.5px] leading-5 text-muted-foreground">
            Sign in to keep your students, homework, and submissions private to your account.
          </p>
        </div>
        <SignIn routing="hash" />
      </section>
    </main>
  );
}
