import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";

export function UnlockDialog({
  open,
  onOpenChange,
  mode,
  title,
  body,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "set" | "enter";
  title: string;
  body: string;
  onSubmit: (passphrase: string) => Promise<string | null>;
}) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPassphrase("");
    setConfirm("");
    setError(null);
    setBusy(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (mode === "set" && passphrase.length < 8) {
      setError("Passphrase must be at least 8 characters.");
      return;
    }
    if (mode === "set" && passphrase !== confirm) {
      setError("Passphrases do not match.");
      return;
    }

    setBusy(true);
    const result = await onSubmit(passphrase);
    setBusy(false);
    if (result) {
      setError(result);
      return;
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="glass max-w-sm gap-0 rounded-3xl border-border/60 p-7 shadow-none sm:rounded-3xl">
        <DialogHeader className="text-left">
          <div className="mb-4 flex size-10 items-center justify-center rounded-2xl bg-accent-lime/12">
            <KeyRound className="size-4 text-accent-lime" />
          </div>
          <DialogTitle className="text-display text-lg">
            {mode === "set" ? "Create vault key" : "Enter vault key"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {mode === "set"
              ? "Choose something memorable — there's no reset link and no recovery email. The key lives on this device and nowhere else."
              : "The vault re-locks whenever you leave. Enter your key to decrypt entries for this session."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="mt-6 space-y-3">
            <Input
              type="password"
              placeholder="Vault key"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              disabled={busy}
              className="h-12 rounded-2xl bg-background/40"
            />
            {mode === "set" ? (
              <Input
                type="password"
                placeholder="Confirm vault key"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                className="h-12 rounded-2xl bg-background/40"
              />
            ) : null}
          </div>

          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="mt-6 h-12 w-full rounded-2xl shadow-[0_0_24px_color-mix(in_oklch,var(--accent-lime)_35%,transparent)]"
            disabled={busy || !passphrase}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "set" ? "Create and unlock" : "Unlock"}
          </Button>
          {title && body ? (
            <p className="mt-3 truncate text-center text-xs text-muted-foreground">
              {title} — {body.slice(0, 40)}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
