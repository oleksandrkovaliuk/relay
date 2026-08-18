import {
  Analytics01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ClipboardListIcon,
  Edit02Icon,
  InboxIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  Settings02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { RelayMark } from "@/components/relay-logo";
import { cn } from "@/lib/utils";
import type { ClaudeAvailability } from "@/shared/claude";

const NAVIGATION = [
  { to: "/", label: "Today", icon: InboxIcon, badge: "awaitingSummary" },
  { to: "/students", label: "Students", icon: UserGroupIcon, badge: null },
  { to: "/homework", label: "Homework", icon: ClipboardListIcon, badge: "draftsReady" },
  { to: "/insights", label: "Insights", icon: Analytics01Icon, badge: null },
] as const;

const CONTROL_FEEDBACK =
  "transition-[background-color,color,transform] duration-150 active:scale-[.97] motion-reduce:active:scale-100";
const SIDEBAR_ITEM =
  "flex h-9 items-center gap-2.5 rounded-lg text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-white/20";
const ACCOUNT_CONTROL =
  "flex min-h-11 w-full items-center gap-2.5 rounded-lg text-left outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/20";
const SIDEBAR_COLLAPSED_STORAGE_KEY = "relay:sidebar-collapsed:v1";

export function WorkspaceShell({
  availability,
  teacher,
  awaitingSummaryCount,
  draftsReadyCount,
  contentKey,
  children,
}: {
  availability: ClaudeAvailability | null;
  /**
   * Who is signed in to Relay. This is the identity the workspace belongs to —
   * the Claude login is a tool it uses, and lives in the status line instead.
   */
  teacher: { name: string | null; email: string | null; imageUrl: string | null } | null;
  awaitingSummaryCount: number;
  /** Drafts finished generating and waiting to be reviewed. */
  draftsReadyCount: number;
  /** Changing this resets the content scroll, the way a page navigation should. */
  contentKey: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(readSidebarCollapsed);
  const router = useRouter();
  const canGoBack = router.history.canGoBack();

  useEffect(function scrollToTopOnNavigation() {
    contentRef.current?.scrollTo({ top: 0 });
  }, [contentKey]);

  function toggleSidebar() {
    setIsSidebarCollapsed((isCurrentlyCollapsed) => {
      const isNextCollapsed = !isCurrentlyCollapsed;
      rememberSidebarState(isNextCollapsed);
      return isNextCollapsed;
    });
  }

  return (
    <div
      className={cn(
        "grid h-screen bg-workspace-surface text-foreground antialiased transition-[grid-template-columns] duration-200 ease-[var(--ease-out)] motion-reduce:transition-none",
        isSidebarCollapsed
          ? "grid-cols-[72px_minmax(0,1fr)]"
          : "grid-cols-[252px_minmax(0,1fr)]",
      )}
    >
      <aside
        id="relay-sidebar"
        className="drag-region relative z-30 flex min-h-0 flex-col overflow-hidden border-r border-white/[0.07] bg-workspace-sidebar text-white"
      >
        {/* macOS draws the traffic lights over the top-left of this row, so
            nothing interactive may sit there: the row is empty on the collapsed
            rail, and its controls stay right-aligned when expanded. */}
        <div
          className={cn(
            "drag-region flex h-[52px] shrink-0 items-center gap-0.5",
            isSidebarCollapsed ? "justify-center px-2" : "justify-end px-2.5",
          )}
        >
          {isSidebarCollapsed ? null : (
            <>
              <SidebarIconButton
                label="Back"
                onClick={() => router.history.back()}
                isDisabled={!canGoBack}
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} size={17} strokeWidth={1.9} aria-hidden />
              </SidebarIconButton>
              <SidebarIconButton label="Forward" onClick={() => router.history.forward()}>
                <HugeiconsIcon icon={ArrowRight01Icon} size={17} strokeWidth={1.9} aria-hidden />
              </SidebarIconButton>
              <SidebarIconButton
                label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                onClick={toggleSidebar}
                controls="relay-sidebar"
                isExpanded={!isSidebarCollapsed}
              >
                <HugeiconsIcon icon={PanelLeftCloseIcon} size={17} strokeWidth={1.7} aria-hidden />
              </SidebarIconButton>
            </>
          )}
        </div>

        {/* Collapsed, the toggle gets its own row clear of the traffic lights. */}
        {isSidebarCollapsed ? (
          <div className="no-drag flex h-9 shrink-0 items-center justify-center">
            <SidebarIconButton
              label="Expand sidebar"
              onClick={toggleSidebar}
              controls="relay-sidebar"
              isExpanded={false}
            >
              <HugeiconsIcon icon={PanelLeftOpenIcon} size={17} strokeWidth={1.7} aria-hidden />
            </SidebarIconButton>
          </div>
        ) : null}

        {/* The product row: mark, name, and the two things worth surfacing above
            everything else — what needs attention, and where to start. */}
        <div
          className={cn(
            "no-drag flex h-10 shrink-0 items-center gap-1",
            isSidebarCollapsed ? "justify-center px-3" : "px-3.5",
          )}
        >
          {isSidebarCollapsed ? (
            <Link to="/" aria-label="Relay home" className="grid size-8 place-items-center text-white">
              <RelayMark size={20} />
            </Link>
          ) : (
            <>
              {/* Branding, not a control: the menu it used to open only repeated
                  links that are already on the rail. */}
              <span className="flex select-none items-center gap-2 pl-1 text-white">
                <RelayMark size={24} />
                <span className="text-[14px] font-semibold leading-none tracking-[-0.04em]">
                  Relay
                </span>
              </span>
              <div className="flex-1" />
              <SidebarIconLink to="/homework/new" label="New homework">
                <HugeiconsIcon icon={Edit02Icon} size={16} strokeWidth={1.8} aria-hidden />
              </SidebarIconLink>
            </>
          )}
        </div>

        <nav
          className={cn("no-drag mt-4 grid gap-0.5", isSidebarCollapsed ? "px-3" : "px-2.5")}
          aria-label="Workspace"
        >
          {NAVIGATION.map(({ to, label, icon, badge }) => {
            const count =
              badge === "awaitingSummary"
                ? awaitingSummaryCount
                : badge === "draftsReady"
                  ? draftsReadyCount
                  : 0;
            return (
              <Link
                key={to}
                to={to}
                title={label}
                activeOptions={{ exact: to === "/" }}
                className={cn(
                  CONTROL_FEEDBACK,
                  SIDEBAR_ITEM,
                  "relative",
                  isSidebarCollapsed ? "justify-center px-0" : "justify-start px-3",
                )}
                activeProps={{ className: "bg-white/[0.07] text-white" }}
                inactiveProps={{
                  className: "text-white/56 hover:bg-white/[0.04] hover:text-white/85",
                }}
              >
                <HugeiconsIcon icon={icon} size={16} strokeWidth={1.7} aria-hidden />
                {isSidebarCollapsed ? null : (
                  <span className="flex-1 text-left">{label}</span>
                )}
                {count > 0 ? (
                  <>
                    {isSidebarCollapsed ? (
                      <span
                        aria-hidden
                        className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-400"
                      />
                    ) : (
                      <span className="text-[11px] font-semibold text-emerald-300 numeric">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <div
          className={cn(
            "no-drag mb-3 grid gap-1",
            isSidebarCollapsed ? "mx-3" : "mx-2.5",
          )}
        >
          {/* The runtime the app depends on, reported where a status belongs:
              under everything, quiet while it works, loud when it needs something. */}
          <ClaudeStatusLine
            availability={availability}
            isSidebarCollapsed={isSidebarCollapsed}
          />

          {/* Always the route to Settings, in every state: appearance, the Relay
              account and the Claude logins all live there. */}
          <Link
            to="/settings"
            className={cn(
              CONTROL_FEEDBACK,
              ACCOUNT_CONTROL,
              isSidebarCollapsed ? "justify-center px-1" : "justify-start px-2.5",
            )}
            aria-label={`Signed in as ${describeTeacher(teacher).primary}. Open settings.`}
            activeProps={{ className: "bg-white/[0.075]" }}
          >
            <TeacherAvatar teacher={teacher} />
            {isSidebarCollapsed ? null : (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] text-white/85">
                  {describeTeacher(teacher).primary}
                </span>
                {describeTeacher(teacher).secondary ? (
                  <span className="block truncate text-[11px] text-white/45">
                    {describeTeacher(teacher).secondary}
                  </span>
                ) : null}
              </span>
            )}
            {isSidebarCollapsed ? null : (
              <HugeiconsIcon
                className="shrink-0 text-workspace-sidebar-icon"
                icon={Settings02Icon}
                size={14}
                strokeWidth={2}
                aria-hidden
              />
            )}
          </Link>
        </div>
      </aside>

      <ScrollArea
        className="min-w-0"
        viewportClassName="min-w-0 bg-workspace-surface"
        viewportRef={contentRef}
        render={<main />}
      >
        {children}
      </ScrollArea>
    </div>
  );
}

/** The chrome row's buttons: history, and the rail toggle. */
function SidebarIconButton({
  label,
  onClick,
  isDisabled,
  controls,
  isExpanded,
  children,
}: {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  controls?: string;
  isExpanded?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={isDisabled}
      aria-controls={controls}
      aria-expanded={isExpanded}
      onClick={onClick}
      className={cn(
        CONTROL_FEEDBACK,
        "no-drag grid size-8 place-items-center rounded-lg text-workspace-sidebar-icon outline-none hover:bg-white/[0.06] hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-35",
      )}
    >
      {children}
    </button>
  );
}

/** A quiet square icon control on the rail, with an optional attention dot. */
function SidebarIconLink({
  to,
  label,
  hasBadge,
  children,
}: {
  to: "/" | "/homework/new";
  label: string;
  hasBadge?: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className={cn(
        CONTROL_FEEDBACK,
        "relative grid size-8 place-items-center rounded-lg text-workspace-sidebar-icon outline-none hover:bg-white/[0.06] hover:text-white/85 focus-visible:ring-2 focus-visible:ring-white/20",
      )}
    >
      {children}
      {hasBadge ? (
        <span
          aria-hidden
          className="absolute right-1 top-1 size-1.5 rounded-full bg-emerald-400 ring-2 ring-workspace-sidebar"
        />
      ) : null}
    </Link>
  );
}

function describeClaudeAvatarState(availability: ClaudeAvailability | null) {
  if (availability === null) return "checking" as const;
  if (availability.isAuthenticated) return "ready" as const;
  if (availability.isInstalled) return "signin" as const;
  return "missing" as const;
}

function readSidebarCollapsed() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function rememberSidebarState(isCollapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isCollapsed));
  } catch {
    // The control still works for the current session when storage is unavailable.
  }
}

function describeClaudeState(availability: ClaudeAvailability | null) {
  if (availability === null) return "Checking Claude…";
  if (availability.isAuthenticated) return "Claude connected";
  if (availability.isInstalled) return "Claude sign-in needed";
  return "Claude not installed";
}

type Teacher = { name: string | null; email: string | null; imageUrl: string | null } | null;

/**
 * Name over email, and never an empty row: a teacher signed in with Google may
 * have given neither, and the rail still has to say who this workspace belongs
 * to. The email moves up to the first line when there is no name, rather than
 * leaving a placeholder above it.
 */
function describeTeacher(teacher: Teacher) {
  const name = teacher?.name?.trim();
  const email = teacher?.email?.trim();
  if (name) return { primary: name, secondary: email ?? null };
  if (email) return { primary: email, secondary: null };
  return { primary: "Relay teacher", secondary: "Not signed in" };
}

function teacherInitials(teacher: Teacher) {
  const { primary } = describeTeacher(teacher);
  const words = primary.split(/[\s@._-]+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0] ?? "");
  return initials.join("").toUpperCase() || "R";
}

/** The signed-in teacher's picture, falling back to their initials. */
function TeacherAvatar({ teacher }: { teacher: Teacher }) {
  const [hasImageFailed, setHasImageFailed] = useState(false);
  const imageUrl = teacher?.imageUrl;

  if (imageUrl && !hasImageFailed) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden
        onError={() => setHasImageFailed(true)}
        className="size-7 shrink-0 rounded-full object-cover ring-1 ring-white/15"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid size-7 shrink-0 place-items-center rounded-full bg-white/[0.09] text-[10.5px] font-semibold text-white/80"
    >
      {teacherInitials(teacher)}
    </span>
  );
}

/**
 * Whether the local Claude runtime can do any work. Collapsed, it is the dot
 * alone; expanded, the dot with what it means. It stays a link to Settings,
 * which is the only place anything about it can be fixed.
 */
function ClaudeStatusLine({
  availability,
  isSidebarCollapsed,
}: {
  availability: ClaudeAvailability | null;
  isSidebarCollapsed: boolean;
}) {
  const state = describeClaudeAvatarState(availability);
  const label = describeClaudeState(availability);
  const dot = (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full",
        // On the collapsed rail the dot is the whole message, so it carries a
        // little more weight than it does beside its own label.
        isSidebarCollapsed ? "size-2" : "size-1.5",
        state === "ready" && "bg-emerald-400",
        state === "signin" && "bg-amber-400",
        state === "missing" && "bg-rose-400",
        state === "checking" && "bg-workspace-sidebar-icon",
      )}
    />
  );

  return (
    <Link
      to="/settings"
      title={label}
      aria-label={label}
      className={cn(
        CONTROL_FEEDBACK,
        "flex min-h-7 items-center gap-2 rounded-lg outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/20",
        isSidebarCollapsed ? "justify-center px-1" : "px-2.5",
      )}
    >
      {dot}
      {isSidebarCollapsed ? null : (
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[11px]",
            // Only a state the teacher has to act on earns colour.
            state === "ready" || state === "checking" ? "text-white/40" : "text-amber-300/90",
          )}
        >
          {label}
        </span>
      )}
    </Link>
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
    <header className="drag-region sticky top-0 z-20 border-b border-border/60 bg-workspace-surface/90 backdrop-blur-xl">
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
