import type { Doc } from "@/convex/_generated/dataModel";
import { Braces, CircleCheck, FileText, Link2, Lock, Sparkles, Star, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const KIND_META = {
  note: { label: "Note", icon: FileText },
  link: { label: "Link", icon: Link2 },
  snippet: { label: "Snippet", icon: Braces },
  prompt: { label: "Prompt", icon: Sparkles },
  task: { label: "Task", icon: CircleCheck },
} as const;

export type VaultKind = keyof typeof KIND_META;

export const KINDS = Object.keys(KIND_META) as VaultKind[];

export function VaultCard({
  item,
  body,
  locked,
  onReveal,
  onEdit,
  onDelete,
  onTogglePin,
  busy,
}: {
  item: Doc<"vaultItems">;
  body: string | null;
  locked: boolean;
  onReveal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  busy?: boolean;
}) {
  const meta = KIND_META[item.kind];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group relative rounded-lg border border-border/80 bg-card p-5 transition-colors",
        "hover:border-border",
        busy && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            <p className="mt-1 text-mono-label">{meta.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={item.pinned ? "Unpin" : "Pin"}
            onClick={onTogglePin}
            className={cn(
              "flex size-7 items-center justify-center rounded-md transition-colors",
              item.pinned
                ? "text-foreground"
                : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          >
            <Star className={cn("size-3.5", item.pinned && "fill-current")} />
          </button>
          <button
            type="button"
            aria-label="Edit"
            onClick={onEdit}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={onDelete}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-border/60 pt-3">
        {locked ? (
          <button
            type="button"
            onClick={onReveal}
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="size-3" />
            Encrypted — tap to reveal
          </button>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        )}
      </div>
    </div>
  );
}
