import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useState } from "react";

import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAXIMUM_STYLE_NOTES_LENGTH = 4_000;
const PLACEHOLDER = `Avoid generic textbook sentences. Avoid formal or academic language.
Tie every sentence to a real working context.
Communicative method: controlled practice first, then freer practice.`;

/**
 * The rules a teacher would otherwise retype into every prompt. Claude starts
 * each run with no memory of the last one, so this is the part of their taste
 * the app has to carry for them — and the part no amount of reading their past
 * sets can infer.
 */
export function TeachingStyleSection() {
  const profile = useQuery(api.teaching.styleProfile);
  const setStyleNotes = useMutation(api.teaching.setStyleNotes);
  const [draft, setDraft] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(function adoptSavedNotes() {
    if (profile && draft === null) setDraft(profile.styleNotes);
  }, [draft, profile]);

  const value = draft ?? "";
  const isDirty = profile !== undefined && value !== profile.styleNotes;

  async function save() {
    setIsSaving(true);
    setError(null);
    try {
      await setStyleNotes({ styleNotes: value });
      setHasSaved(true);
      window.setTimeout(() => setHasSaved(false), 2_000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your teaching preferences.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-3">
      <Textarea
        rows={5}
        value={value}
        maxLength={MAXIMUM_STYLE_NOTES_LENGTH}
        aria-label="How you like homework written"
        placeholder={PLACEHOLDER}
        onChange={(event) => setDraft(event.target.value)}
        className="min-h-28 text-[13.5px]"
      />
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-pretty text-[12.5px] leading-5 text-muted-foreground">
          {profile && profile.editInstructions.length > 0
            ? `Relay also passes on the ${profile.editInstructions.length} ${
                profile.editInstructions.length === 1 ? "change" : "changes"
              } you last applied. They guide relevant future edits.`
            : "Anything you write here goes into every generation and every activity edit."}
        </p>
        <Button size="sm" disabled={!isDirty || isSaving} onClick={() => void save()}>
          {isSaving ? "Saving…" : hasSaved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}
