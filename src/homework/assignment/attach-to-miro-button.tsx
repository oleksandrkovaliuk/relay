import { ExternalLink } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { readClaudeModel } from "@/claude/claude-model-preference";
import { getDesktopBridge } from "@/claude/desktop-bridge";
import { useClaudeProgress } from "@/claude/use-claude-progress";
import type { BoardAttachment } from "@/shared/claude";

/**
 * Puts the homework on the student's own board, inside the newest frame — the
 * unit they studied last. Claude does it through the teacher's own Miro MCP
 * server, so Relay never holds a Miro credential. Needs a student with a board;
 * with several, each gets its own button, because picking one silently would be
 * wrong.
 */
export function AttachToMiroButton({
  boards,
  title,
  summary,
  shareUrl,
}: {
  boards: { studentName: string; miroBoardUrl: string }[];
  title: string;
  summary: string;
  shareUrl: string;
}) {
  const bridge = getDesktopBridge();
  const [attachment, setAttachment] = useState<BoardAttachment | null>(null);
  const [pendingBoard, setPendingBoard] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const step = useClaudeProgress(requestId);

  if (!bridge || boards.length === 0) return null;

  async function attach(board: { studentName: string; miroBoardUrl: string }) {
    if (!bridge) return;
    const nextRequestId = crypto.randomUUID();
    setPendingBoard(board.miroBoardUrl);
    setRequestId(nextRequestId);
    setError(null);
    try {
      const result = await bridge.attachHomeworkToBoard({
        model: readClaudeModel(),
        requestId: nextRequestId,
        miroBoardUrl: board.miroBoardUrl,
        title,
        summary,
        shareUrl,
      });
      setAttachment(result.attachment);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Claude could not reach the board. Check that the Miro MCP server is connected.",
      );
    } finally {
      setPendingBoard(null);
      setRequestId(null);
    }
  }

  return (
    <div className="grid gap-2">
      {boards.map((board) => (
        <Button
          key={board.miroBoardUrl}
          variant="outline"
          disabled={pendingBoard !== null}
          onClick={() => void attach(board)}
        >
          {pendingBoard === board.miroBoardUrl ? <Spinner className="size-3.5" /> : null}
          <span className="min-w-0 truncate">
            {pendingBoard === board.miroBoardUrl
              ? (step ?? "Asking Claude")
              : boards.length === 1
                ? "Add to Miro board"
                : `Add to ${board.studentName}'s board`}
          </span>
        </Button>
      ))}

      {attachment ? (
        <p className="text-pretty text-[12.5px] leading-5 text-primary">
          {attachment.note}{" "}
          <a
            href={boards[0]?.miroBoardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-4"
          >
            Open the board <ExternalLink size={11} aria-hidden />
          </a>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12.5px] leading-5 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
