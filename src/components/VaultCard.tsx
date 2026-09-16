import type { Doc } from "@/convex/_generated/dataModel";
import {
  Braces,
  CircleCheck,
  FileText,
  Link2,
  Lock,
  Pencil,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const KIND_META = {
  note: { label: "Note", icon: FileText, tone: "text-accent-flare", chip: "bg-accent-flare/12" },
  link: { label: "Link", icon: Link2, tone: "text-accent-iris", chip: "bg-accent-iris/12" },
  snippet: { label: "Snippet", icon: Braces, tone: "text-accent-lime", chip: "bg-accent-lime/12" },
  prompt: { label: "Prompt", icon: Sparkles, tone: "text-accent-iris", chip: "bg-accent-iris/12" },
  task: { label: "Task", icon: CircleCheck, tone: "text-accent-flare", chip: "bg-accent-flare/12" },
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
        "group relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 backdrop-blur-sm transition-colors hover:border-border/90",
        busy && "opacity-60",
      )}
    >
      {/* per-kind tint wash */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 opacity-60",
          meta.chip,
        )}
        style={{ maskImage: "linear-gradient(to bottom, black, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)" }}
      />

      <div className="relative flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", meta.chip)}>
            <Icon className={cn("size-4", meta.tone)} />
          </span>
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
              "flex size-7 items-center justify-center rounded-full transition-colors",
              item.pinned
                ? "text-accent-lime drop-shadow-[0_0_8px_color-mix(in_oklch,var(--accent-lime)_70%,transparent)]"
                : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          >
            <Star className={cn("size-3.5", item.pinned && "fill-current")} />
          </button>
          <button
            type="button"
            aria-label="Edit"
            onClick={onEdit}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:text-foreground"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={onDelete}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="relative border-t border-border/50 px-5 pb-4 pt-3">
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
