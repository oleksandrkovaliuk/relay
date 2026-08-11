import {
  Analytics01Icon,
  ArrowUpRight01Icon,
  ClipboardListIcon,
  Edit02Icon,
  HelpCircleIcon,
  InboxIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { CLAUDE_INSTALL_GUIDE_URL } from "@/claude/claude-setup-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ClaudeAvailability } from "@/shared/claude";

const NAVIGATION = [
  { to: "/", label: "Today", icon: InboxIcon },
  { to: "/students", label: "Students", icon: UserGroupIcon },
  { to: "/homework", label: "Homework", icon: ClipboardListIcon },
  { to: "/insights", label: "Insights", icon: Analytics01Icon },
] as const;

const CONTROL_FEEDBACK =
  "transition-[background-color,color,transform] duration-150 active:scale-[.97] motion-reduce:active:scale-100";
const SIDEBAR_ITEM =
  "flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-white/20 lg:justify-start";
const CLAUDE_CONNECTION_CONTROL =
  "flex h-10 w-full items-center justify-center gap-2 rounded-lg px-2 text-left text-white/78 outline-none hover:bg-white/[0.055] hover:text-white focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-wait disabled:text-white/38 lg:justify-start lg:px-3";

export function WorkspaceShell({
  onOpenClaudeSetup,
  availability,
  badgeCount,
  contentKey,
  children,
}: {
  onOpenClaudeSetup: () => void;
  availability: ClaudeAvailability | null;
  badgeCount: number;
  /** Changing this resets the content scroll, the way a page navigation should. */
  contentKey: string;
  children: ReactNode;
}) {
  const isClaudeReady = availability?.isAuthenticated ?? false;
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(function scrollToTopOnNavigation() {
    contentRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  return (
    <div className="grid h-screen grid-cols-[76px_minmax(0,1fr)] bg-[#f7f7f6] text-foreground antialiased lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="drag-region relative z-30 flex min-h-0 flex-col overflow-hidden border-r border-white/[0.07] bg-[#1c1c1e] text-white">
        <div className="no-drag px-3 pb-2 pt-9 lg:px-4">
          <Link
            to="/homework/new"
            aria-label="Create new homework"
            className={cn(
              CONTROL_FEEDBACK,
              SIDEBAR_ITEM,
              "w-full font-medium text-white/82 hover:bg-white/[0.045] hover:text-white",
            )}
          >
            <HugeiconsIcon icon={Edit02Icon} size={17} strokeWidth={1.8} aria-hidden />
            <span className="hidden lg:inline">New homework</span>
          </Link>
        </div>

        <nav className="no-drag mt-3 grid gap-1 px-3 lg:px-4" aria-label="Workspace">
          <p className="mb-1 hidden px-3 text-[11px] font-medium text-white/48 lg:block">
            Workspace
          </p>
          {NAVIGATION.map(({ to, label, icon }) => (
            <Link
              key={to}
              to={to}
              title={label}
              activeOptions={{ exact: to === "/" }}
              className={cn(CONTROL_FEEDBACK, SIDEBAR_ITEM, "relative")}
              activeProps={{ className: "bg-white/[0.075] font-medium text-white" }}
              inactiveProps={{
                className: "text-white/52 hover:bg-white/[0.045] hover:text-white/82",
              }}
            >
              <HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} aria-hidden />
              <span className="hidden flex-1 text-left lg:inline">{label}</span>
              {to === "/" && badgeCount > 0 ? (
                <span className="absolute ml-6 mt-[-22px] min-w-4 text-center text-[10px] font-semibold leading-4 text-emerald-300 numeric lg:static lg:ml-auto lg:mt-0 lg:text-[11px]">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="no-drag mx-3 mb-3 border-t border-white/[0.07] pt-3 lg:mx-4">
          {isClaudeReady ? (
            <button
              type="button"
              className={cn(
                CONTROL_FEEDBACK,
                "relative flex h-10 w-full items-center justify-center gap-2 rounded-lg px-2 text-left text-white/70 outline-none hover:bg-white/[0.045] hover:text-white focus-visible:ring-2 focus-visible:ring-white/20 lg:justify-start lg:px-3",
              )}
              aria-label={`Claude ready. ${availability?.version ? `Local · ${availability.version}` : "Local · authenticated"}. Open local Claude setup.`}
              onClick={onOpenClaudeSetup}
            >
              <span className="hidden truncate text-[12px] font-medium lg:inline">Claude</span>
              <span className="absolute right-2.5 top-2 size-1.5 shrink-0 rounded-full bg-emerald-400 lg:static lg:size-2" />
              <HugeiconsIcon
                className="shrink-0 lg:ml-auto"
                icon={HelpCircleIcon}
                size={16}
                strokeWidth={1.8}
                aria-hidden
              />
            </button>
          ) : availability === null || availability.isInstalled ? (
            <button
              type="button"
              disabled={availability === null}
              className={cn(CONTROL_FEEDBACK, CLAUDE_CONNECTION_CONTROL)}
              aria-label={
                availability === null
                  ? "Checking Claude availability"
                  : "Connect Claude. Open local Claude setup."
              }
              onClick={onOpenClaudeSetup}
            >
              <span className="hidden truncate text-[12px] font-medium lg:inline">
                {availability === null ? "Checking Claude" : "Connect Claude"}
              </span>
              <HugeiconsIcon
                className="shrink-0 lg:ml-auto"
                icon={availability === null ? HelpCircleIcon : ArrowUpRight01Icon}
                size={16}
                strokeWidth={1.8}
                aria-hidden
              />
            </button>
          ) : (
            <a
              href={CLAUDE_INSTALL_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(CONTROL_FEEDBACK, CLAUDE_CONNECTION_CONTROL)}
              aria-label="Connect Claude. Open the Claude Code installation guide."
            >
              <span className="hidden truncate text-[12px] font-medium lg:inline">
                Connect Claude
              </span>
              <HugeiconsIcon
                className="shrink-0 lg:ml-auto"
                icon={ArrowUpRight01Icon}
                size={16}
                strokeWidth={1.8}
                aria-hidden
              />
            </a>
          )}
        </div>
      </aside>

      <ScrollArea
        className="min-w-0"
        viewportClassName="min-w-0 bg-[#f7f7f6]"
        viewportRef={contentRef}
        render={<main />}
      >
        {children}
      </ScrollArea>
    </div>
  );
}

/** Sticky page title block shared by every workspace page. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="drag-region sticky top-0 z-20 border-b border-black/[0.045] bg-[#f7f7f6]/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1480px] items-start justify-between gap-6 px-6 pb-5 pt-9 lg:px-10 xl:pb-6 xl:pt-10">
        <div className="min-w-0">
          <h1 className="text-balance text-[22px] font-semibold leading-7 tracking-[-0.035em] xl:text-[24px] xl:leading-8">
            {title}
          </h1>
          <p className="mt-1 text-pretty text-[13px] leading-5 text-foreground/60 xl:text-[14px] xl:leading-6">
            {description}
          </p>
        </div>
        {action ? <div className="no-drag shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
