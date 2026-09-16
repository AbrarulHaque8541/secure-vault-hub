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
      <DialogContent className="max-w-sm gap-0 rounded-lg border-border/80 p-6 shadow-none sm:rounded-lg">
        <DialogHeader className="text-left">
          <div className="mb-4 flex size-9 items-center justify-center rounded-md border border-border/80">
            <KeyRound className="size-4 text-muted-foreground" />
          </div>
          <DialogTitle className="text-base font-medium tracking-tight">
            {mode === "set" ? "Create vault key" : "Enter vault key"}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
            {mode === "set"
              ? "Your key never leaves this device. Encryption happens locally before anything syncs."
              : "Enter your vault key to decrypt entries for this session."}
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
              className="h-10 rounded-md"
            />
            {mode === "set" ? (
              <Input
                type="password"
                placeholder="Confirm vault key"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={busy}
                className="h-10 rounded-md"
              />
            ) : null}
          </div>

          {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="mt-6 h-10 w-full rounded-md"
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
