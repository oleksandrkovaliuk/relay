import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { ClaudeConnection } from "@/shared/claude";
import { useClaudeConnections } from "./use-claude-connections";
import { useClaudeLogin, type LoginStage } from "./use-claude-login";

/**
 * Every Claude login the teacher has connected, with who is signed in to each.
 * Switching changes which account generation runs as; the workspace itself is
 * shared, so no homework or student moves with it.
 */
export function ClaudeAccountsSection() {
  const {
    connections,
    problem,
    refresh,
    addConnection,
    activateConnection,
    removeConnection,
  } = useClaudeConnections();
  const login = useClaudeLogin({ onCompleted: refresh });
  const [newLabel, setNewLabel] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  if (!connections) {
    return (
      <div className="grid gap-2">
        <p className="text-pretty text-[13px] leading-5 text-muted-foreground">
          {problem ?? "Reading Claude accounts…"}
        </p>
        {problem ? (
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => void refresh()}
          >
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-xl border border-border">
        {connections.map((connection) => (
          <AccountRow
            key={connection.id}
            connection={connection}
            loginStage={login.stage}
            onUse={() => void activateConnection(connection.id)}
            onSignIn={() => void login.start(connection.id)}
            onCancelSignIn={() => void login.cancel()}
            onSubmitCode={(code) => void login.submitCode(code)}
            onRemove={() => void removeConnection(connection.id)}
          />
        ))}
      </div>

      {isAdding ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (newLabel.trim().length === 0) return;
            void addConnection(newLabel.trim());
            setNewLabel("");
            setIsAdding(false);
          }}
        >
          <Input
            autoFocus
            aria-label="Account name"
            value={newLabel}
            maxLength={60}
            onChange={(event) => setNewLabel(event.target.value)}
            placeholder="Personal account"
          />
          <Button type="submit" disabled={newLabel.trim().length === 0}>
            Add
          </Button>
          <Button type="button" variant="ghost" onClick={() => setIsAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => setIsAdding(true)}
        >
          <Plus size={14} aria-hidden /> Add another account
        </Button>
      )}

      {problem ? (
        <p role="alert" className="text-pretty text-[12.5px] leading-5 text-destructive">
          {problem}
        </p>
      ) : null}

      <p className="text-pretty text-[12px] leading-5 text-muted-foreground">
        Accounts share one workspace. Switching changes which Claude subscription generation
        runs against — your students, homework, and submissions stay exactly where they are.
      </p>
    </div>
  );
}

function AccountRow({
  connection,
  loginStage,
  onUse,
  onSignIn,
  onCancelSignIn,
  onSubmitCode,
  onRemove,
}: {
  connection: ClaudeConnection;
  loginStage: LoginStage;
  onUse: () => void;
  onSignIn: () => void;
  onCancelSignIn: () => void;
  onSubmitCode: (code: string) => void;
  onRemove: () => void;
}) {
  const isSignedIn = Boolean(connection.account?.loggedIn);
  const isSigningIn = loginStage.kind !== "idle" && loginStage.connectionId === connection.id;

  return (
    <div className="border-b border-border/70 last:border-b-0">
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3",
          connection.isActive && "bg-primary-soft/50",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            isSignedIn ? "bg-emerald-500" : "bg-muted-foreground/35",
          )}
        />
        <div className="min-w-[10rem] flex-1">
          <p className="truncate text-[13.5px] font-medium text-foreground">
            {connection.account?.email ?? connection.label}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {describeAccount(connection)}
          </p>
        </div>

        {connection.isActive ? (
          <span className="shrink-0 text-[11.5px] font-medium text-primary">In use</span>
        ) : (
          <Button variant="ghost" size="sm" onClick={onUse}>
            Use
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onSignIn} disabled={isSigningIn}>
          {isSignedIn ? "Sign in again" : "Sign in"}
        </Button>
        {connection.configDir ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${connection.label}`}
            onClick={onRemove}
          >
            <Trash2 size={13} aria-hidden />
          </Button>
        ) : null}
      </div>

      {isSigningIn ? (
        <SignInProgress
          stage={loginStage}
          onCancel={onCancelSignIn}
          onSubmitCode={onSubmitCode}
        />
      ) : null}
    </div>
  );
}

function SignInProgress({
  stage,
  onCancel,
  onSubmitCode,
}: {
  stage: LoginStage;
  onCancel: () => void;
  onSubmitCode: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="border-t border-border/70 bg-muted/35 px-3.5 py-3">
      {stage.kind === "failed" ? (
        <p role="alert" className="text-pretty text-[12.5px] leading-5 text-destructive">
          {stage.message}
        </p>
      ) : stage.kind === "done" ? (
        <p className="text-[12.5px] leading-5 text-primary">Signed in.</p>
      ) : stage.kind === "code" ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length === 0) return;
            onSubmitCode(code);
            setCode("");
          }}
        >
          <p className="text-pretty text-[12.5px] leading-5 text-secondary-foreground">
            Your browser is showing a sign-in code. Paste it here to finish.
          </p>
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              aria-label="Sign-in code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Paste the code from your browser"
              className="font-mono text-[12.5px]"
            />
            <Button type="submit" disabled={code.trim().length === 0}>
              Finish
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2.5">
          <Spinner className="size-3.5 text-primary" />
          <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-secondary-foreground">
            {stage.kind === "submitting" ? "Finishing sign-in…" : "Opening your browser…"}
          </p>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function describeAccount(connection: ClaudeConnection) {
  const account = connection.account;
  if (!account?.loggedIn) {
    return connection.isActive ? "Not signed in · active" : "Not signed in";
  }
  const details = [connection.label, account.orgName, account.subscriptionType].filter(Boolean);
  return details.join(" · ");
}
