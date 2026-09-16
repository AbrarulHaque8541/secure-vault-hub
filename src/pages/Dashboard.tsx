import { AppHeader, VaultMark } from "@/components/AppHeader";
import { UnlockDialog } from "@/components/UnlockDialog";
import { KINDS, KIND_META, VaultCard, type VaultKind } from "@/components/VaultCard";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { decryptString, encryptString, isVaultError } from "@/lib/crypto";
import { parseCapture, titleFor } from "@/lib/capture";
import { lockVault, unlockVault, useVaultUnlock } from "@/lib/vault-store";
import { cn } from "@/lib/utils";
import {
  ArrowUp,
  Check,
  ChevronDown,
  Download,
  FlaskConical,
  Lock,
  LockOpen,
  Package,
  Plus,
  RefreshCcw,
  Search,
  Terminal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

/* ---------------------------------- utils --------------------------------- */

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/* ------------------------------- model station ---------------------------- */

interface CatalogModel {
  id: string;
  name: string;
  params: string;
  sizeGB: number;
  quant: string;
  ctx: string;
  license: string;
}

const MODEL_CATALOG: CatalogModel[] = [
  { id: "qwen2.5-0.5b", name: "Qwen2.5 0.5B Instruct", params: "0.5B", sizeGB: 0.4, quant: "Q5_K_M", ctx: "32K", license: "Apache-2.0" },
  { id: "llama-3.2-1b", name: "Llama 3.2 1B Instruct", params: "1B", sizeGB: 0.8, quant: "Q4_K_M", ctx: "128K", license: "Llama 3.2" },
  { id: "gemma-2-2b", name: "Gemma 2 2B IT", params: "2B", sizeGB: 1.6, quant: "Q4_K_M", ctx: "8K", license: "Gemma" },
  { id: "phi-3.5-mini", name: "Phi-3.5 Mini", params: "3.8B", sizeGB: 2.2, quant: "Q4_K_M", ctx: "128K", license: "MIT" },
];

type DownloadState = { progress: number; status: "downloading" | "done" };

/* --------------------------------- plugins -------------------------------- */

interface SandboxPlugin {
  id: string;
  name: string;
  desc: string;
  permission: string;
}

const SANDBOX_PLUGINS: SandboxPlugin[] = [
  { id: "clipboard-bridge", name: "Clipboard Bridge", desc: "Capture straight from clipboard watchers.", permission: "clipboard.read" },
  { id: "termux-agent", name: "Termux Agent", desc: "Expose capture + pin verbs to a local shell.", permission: "shell.exec" },
  { id: "auto-tagger", name: "Auto Tagger", desc: "Run a local GGUF model over new captures.", permission: "model.infer" },
];

/* ---------------------------------- OTA ----------------------------------- */

const CHANNELS = ["alpha", "beta", "stable"] as const;
type Channel = (typeof CHANNELS)[number];

const CHANNEL_BUILD: Record<Channel, string> = {
  alpha: "1.5.0-alpha.3",
  beta: "1.5.0-beta.1",
  stable: "1.4.2",
};

/* ================================ component =============================== */

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { passphrase, unlockedAt } = useVaultUnlock();

  const items = useQuery(api.vault.list) ?? [];
  const createItem = useMutation(api.vault.create);
  const updateItem = useMutation(api.vault.update);
  const removeItem = useMutation(api.vault.remove);

  /* ------------------------------ vault state ----------------------------- */

  const [hasKey, setHasKey] = useState(false);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<null | { mode: "set" | "enter" }>(null);
  const pendingRef = useRef<{ capture?: string; reveal?: Id<"vaultItems">; edit?: Doc<"vaultItems"> } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc<"vaultItems"> | null>(null);
  const [editItem, setEditItem] = useState<Doc<"vaultItems"> | null>(null);

  /* ----------------------------- capture state ---------------------------- */

  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(() => parseCapture(raw), [raw]);

  /* ------------------------------ list filters ---------------------------- */

  const [kindFilter, setKindFilter] = useState<"all" | VaultKind | "pinned">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = items;
    if (kindFilter === "pinned") list = list.filter((i) => i.pinned);
    else if (kindFilter !== "all") list = list.filter((i) => i.kind === kindFilter);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((i) => i.title.toLowerCase().includes(q));
    return [...list].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.createdAt - a.createdAt);
  }, [items, kindFilter, search]);

  const pinnedCount = useMemo(() => items.filter((i) => i.pinned).length, [items]);

  /* ------------------------------- dev mode ------------------------------- */

  const [devUnlocked, setDevUnlocked] = useState(() => readLocal("vh-dev") === "1");
  const [powerMode, setPowerMode] = useState(() => readLocal("vh-power") === "1");
  const [taps, setTaps] = useState(0);
  const tapTimer = useRef<number | null>(null);

  const handleVersionTap = () => {
    if (devUnlocked) return;
    setTaps((t) => {
      const next = t + 1;
      if (next >= 7) {
        setDevUnlocked(true);
        writeLocal("vh-dev", "1");
        setPowerMode(true);
        writeLocal("vh-power", "1");
        toast.success("Developer mode enabled", { description: "Model station, sandbox, and OTA unlocked." });
        return 0;
      }
      if (next >= 3) toast(`${next} / 7 taps`);
      return next;
    });
    if (tapTimer.current) window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => setTaps(0), 1600);
  };

  const togglePower = (next: boolean) => {
    setPowerMode(next);
    writeLocal("vh-power", next ? "1" : "0");
  };

  /* ----------------------------- model station ---------------------------- */

  const [downloads, setDownloads] = useState<Record<string, DownloadState>>(() => {
    try {
      return JSON.parse(readLocal("vh-models") ?? "{}");
    } catch {
      return {};
    }
  });
  const intervalsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const ints = intervalsRef.current;
    return () => Object.values(ints).forEach((id) => window.clearInterval(id));
  }, []);

  const startDownload = (model: CatalogModel) => {
    if (downloads[model.id]?.status === "downloading") return;
    setDownloads((d) => ({ ...d, [model.id]: { progress: 0, status: "downloading" } }));
    intervalsRef.current[model.id] = window.setInterval(() => {
      setDownloads((d) => {
        const cur = d[model.id];
        if (!cur || cur.status === "done") return d;
        const progress = Math.min(100, cur.progress + 2 + Math.random() * 5);
        if (progress >= 100) {
          window.clearInterval(intervalsRef.current[model.id]);
          delete intervalsRef.current[model.id];
          const next = { ...d, [model.id]: { progress: 100, status: "done" as const } };
          writeLocal("vh-models", JSON.stringify(next));
          toast.success(`${model.name} ready`, { description: "Loaded into the local GGUF runtime." });
          return next;
        }
        return { ...d, [model.id]: { progress, status: "downloading" } };
      });
    }, 260);
  };

  const loadedCount = useMemo(
    () => Object.values(downloads).filter((d) => d.status === "done").length,
    [downloads],
  );

  /* ----------------------------- plugin sandbox --------------------------- */

  const [installed, setInstalled] = useState<string[]>(() => {
    try {
      return JSON.parse(readLocal("vh-plugins") ?? "[]");
    } catch {
      return [];
    }
  });
  const [log, setLog] = useState<string[]>([
    "[sandbox] runtime ready · seccomp profile: strict",
  ]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  const pushLog = (line: string) => setLog((l) => [...l.slice(-40), line]);

  const togglePlugin = (plugin: SandboxPlugin) => {
    const on = installed.includes(plugin.id);
    if (on) {
      setInstalled((p) => p.filter((id) => id !== plugin.id));
      writeLocal("vh-plugins", JSON.stringify(installed.filter((id) => id !== plugin.id)));
      pushLog(`[sandbox] revoked ${plugin.permission} · unloaded ${plugin.id}`);
    } else {
      setInstalled((p) => [...p, plugin.id]);
      writeLocal("vh-plugins", JSON.stringify([...installed, plugin.id]));
      pushLog(`[sandbox] granted ${plugin.permission} · loaded ${plugin.id}`);
    }
  };

  /* ---------------------------------- OTA --------------------------------- */

  const [channel, setChannel] = useState<Channel>(
    () => (readLocal("vh-channel") as Channel) || "beta",
  );
  const [currentBuild, setCurrentBuild] = useState("1.4.2");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);

  const pickChannel = (ch: Channel) => {
    setChannel(ch);
    writeLocal("vh-channel", ch);
    setAvailable(null);
  };

  const checkForUpdates = () => {
    setChecking(true);
    setAvailable(null);
    window.setTimeout(() => {
      setChecking(false);
      const target = CHANNEL_BUILD[channel];
      if (target !== currentBuild) {
        setAvailable(target);
        toast("Update available", { description: `Build ${target} on the ${channel} channel.` });
      } else {
        toast("You're up to date", { description: `Build ${currentBuild} is the latest on ${channel}.` });
      }
    }, 1100);
  };

  const installUpdate = () => {
    if (!available) return;
    setInstalling(true);
    setInstallProgress(0);
    const id = window.setInterval(() => {
      setInstallProgress((p) => {
        const next = p + 3 + Math.random() * 6;
        if (next >= 100) {
          window.clearInterval(id);
          setInstalling(false);
          setCurrentBuild(available);
          setAvailable(null);
          toast.success("Update applied", { description: `Now running build ${available}. Hot-swapped without restart.` });
          return 100;
        }
        return next;
      });
    }, 220);
  };

  /* ------------------------------- vault ops ------------------------------ */

  const decryptBody = useCallback(
    async (item: Doc<"vaultItems">, key: string): Promise<string | null> => {
      try {
        const payload = JSON.parse(item.ciphertext);
        return await decryptString(payload, key);
      } catch (err) {
        if (isVaultError(err)) {
          lockVault();
          setHasKey(false);
          toast.error("Vault key didn't match", { description: "Enter the key again to decrypt." });
          pendingRef.current = { reveal: item._id };
          setDialog({ mode: "enter" });
        } else {
          toast.error("Couldn't decrypt this entry");
        }
        return null;
      }
    },
    [],
  );

  const handleReveal = async (item: Doc<"vaultItems">) => {
    if (!passphrase) {
      pendingRef.current = { reveal: item._id };
      setDialog({ mode: hasKey ? "enter" : "set" });
      return;
    }
    const body = await decryptBody(item, passphrase);
    if (body !== null) setBodies((b) => ({ ...b, [item._id]: body }));
  };

  const handleUnlockSubmit = async (key: string): Promise<string | null> => {
    const pending = pendingRef.current;
    if (pending?.reveal) {
      const item = items.find((i) => i._id === pending.reveal);
      if (item) {
        try {
          const body = await decryptString(JSON.parse(item.ciphertext), key);
          setBodies((b) => ({ ...b, [item._id]: body }));
        } catch (err) {
          if (isVaultError(err)) return "That key doesn't match this vault.";
          return "Couldn't decrypt this entry.";
        }
      }
    } else if (pending?.capture) {
      try {
        await persistCapture(pending.capture, key);
      } catch (err) {
        if (isVaultError(err)) return "That key doesn't match this vault.";
        return "Couldn't encrypt this capture.";
      }
    } else if (pending?.edit) {
      const item = pending.edit;
      try {
        await decryptString(JSON.parse(item.ciphertext), key);
      } catch (err) {
        if (isVaultError(err)) return "That key doesn't match this vault.";
        return "Couldn't decrypt this entry.";
      }
      setEditItem(item);
    }
    pendingRef.current = null;
    setHasKey(true);
    unlockVault(key);
    return null;
  };

  const persistCapture = async (text: string, key: string) => {
    const { kind, body } = parseCapture(text);
    const payload = await encryptString(body, key);
    await createItem({
      title: titleFor(body),
      kind,
      ciphertext: JSON.stringify(payload),
    });
  };

  const handleCapture = async () => {
    if (!raw.trim()) return;
    if (!passphrase) {
      pendingRef.current = { capture: raw };
      setDialog({ mode: hasKey ? "enter" : "set" });
      return;
    }
    setSaving(true);
    try {
      await persistCapture(raw, passphrase);
      setRaw("");
    } catch {
      toast.error("Capture failed", { description: "Try again in a moment." });
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async (kind: VaultKind, title: string, body: string) => {
    if (!editItem || !passphrase) return;
    const payload = await encryptString(body, passphrase);
    await updateItem({ id: editItem._id, kind, title: titleFor(title), ciphertext: JSON.stringify(payload) });
    setBodies((b) => ({ ...b, [editItem._id]: body }));
    setEditItem(null);
    toast.success("Entry updated");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await removeItem({ id: deleteTarget._id });
    setDeleteTarget(null);
    toast.success("Entry deleted");
  };

  const handleTogglePin = async (item: Doc<"vaultItems">) => {
    const next = !item.pinned;
    await updateItem({
      id: item._id,
      pinned: next,
      pinnedAt: next ? Date.now() : undefined,
    });
  };

  const handleSignOut = async () => {
    lockVault();
    await signOut();
  };

  /* --------------------------------- render ------------------------------- */

  const vaultLocked = !passphrase;

  return (
    <div className="page-ember relative min-h-screen overflow-x-clip text-foreground">
      <AppHeader devMode={devUnlocked} onPowerToggle={togglePower} floating />

      <main className="relative mx-auto w-full max-w-6xl px-6 pb-16 pt-6">
        <div className="aurora -z-10 right-[-8rem] top-[-4rem] size-[24rem] bg-[oklch(0.62_0.2_25/0.22)]" />
        <div className="aurora -z-10 bottom-[10rem] left-[-8rem] size-[22rem] bg-[oklch(0.77_0.19_128/0.16)]" />

        {/* Kiro-style hero: greeting + gradient capture card + stat ring */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_280px]">
          <div>
            <p className="text-sm text-muted-foreground">
              Good to see you{user?.name ? `, ${user.name}` : ""}
            </p>
            <h1 className="text-display mt-1 text-3xl sm:text-4xl">Your vault, sealed and yours.</h1>

            {/* Capture hero card */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCapture();
              }}
              className="glow-card mt-7 p-5 sm:p-6"
              style={{ "--glow-a": "oklch(0.62 0.2 25 / 45%)", "--glow-b": "oklch(0.77 0.19 128 / 30%)" } as React.CSSProperties}
            >
              <div className="flex items-center gap-3">
                <Plus className="size-4 shrink-0 text-foreground/70" />
                <input
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  placeholder="Drop a thought, a link, a snippet — try “deploy checklist #task” or “https://… #link”"
                  className="h-9 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-foreground/40"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!raw.trim() || saving}
                  className="rounded-full bg-foreground/85 text-background hover:bg-foreground"
                >
                  {saving ? "Saving…" : "Capture"}
                </Button>
              </div>
              {raw.trim() ? (
                <div className="mt-4 flex items-center gap-2.5 border-t border-foreground/10 pt-3">
                  <Badge variant="secondary" className="rounded-full font-normal">
                    #{parsed.kind}
                  </Badge>
                  <span className="text-xs text-foreground/55">
                    {vaultLocked ? "Vault locked — you'll be asked for your key" : "Sealed on this device, synced as ciphertext"}
                  </span>
                </div>
              ) : null}
            </form>

            <div className="mt-4 flex items-center justify-between gap-3 rounded-full border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm">
                {vaultLocked ? (
                  <Lock className="size-3.5 text-muted-foreground" />
                ) : (
                  <LockOpen className="size-3.5 text-accent-lime drop-shadow-[0_0_8px_color-mix(in_oklch,var(--accent-lime)_60%,transparent)]" />
                )}
                {vaultLocked ? (
                  <span className="text-muted-foreground">
                    Vault locked{hasKey ? " — session key cleared" : " — no key set yet"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Vault unlocked
                    <span className="ml-2 font-mono text-[11px] text-muted-foreground/70">
                      session key · {unlockedAt ? new Date(unlockedAt).toLocaleTimeString() : ""}
                    </span>
                  </span>
                )}
              </div>
              {vaultLocked ? (
                <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setDialog({ mode: hasKey ? "enter" : "set" })}>
                  Unlock vault
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={lockVault}>
                  Lock
                </Button>
              )}
            </div>
          </div>

          {/* Stat ring card */}
          <div className="glass hidden rounded-3xl p-6 lg:block">
            <div className="mx-auto flex size-40 items-center justify-center rounded-full"
              style={{
                background:
                  "conic-gradient(var(--accent-lime) 0deg, var(--accent-iris) 130deg, var(--accent-flare) 230deg, color-mix(in oklch, var(--foreground) 8%, transparent) 230deg)",
              }}
            >
              <div className="flex size-[8.25rem] flex-col items-center justify-center rounded-full bg-background">
                <span className="font-dot text-4xl leading-none text-foreground">{items.length}</span>
                <span className="text-mono-label mt-1.5">captured</span>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-foreground/4 px-3 py-2.5">
                <p className="font-dot text-xl text-foreground">{pinnedCount}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">pinned</p>
              </div>
              <button
                type="button"
                onClick={handleVersionTap}
                className="rounded-2xl bg-foreground/4 px-3 py-2.5 transition-colors hover:bg-foreground/8"
                aria-label={devUnlocked ? "Developer mode active" : "Build info"}
              >
                {devUnlocked ? (
                  <>
                    <p className="flex items-center justify-center gap-1.5 font-dot text-xl text-accent-lime drop-shadow-[0_0_10px_color-mix(in_oklch,var(--accent-lime)_70%,transparent)]">
                      <FlaskConical className="size-3.5" />
                      DEV
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-accent-lime/80">mode active</p>
                  </>
                ) : (
                  <>
                    <p className="font-dot text-xl text-foreground">v0.5</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {taps > 0 ? `${taps}/7 taps` : "build 42"}
                    </p>
                  </>
                )}
              </button>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? "Light" : "Dark"}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={handleSignOut}>
                Sign out
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile sign-out row */}
        <div className="mt-6 flex items-center justify-end gap-2 lg:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-muted-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", ...KINDS, "pinned"] as const).map((k) => {
              const active = kindFilter === k;
              const label =
                k === "all" ? "All" : k === "pinned" ? "Pinned" : KIND_META[k].label;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKindFilter(k)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles"
              className="h-9 rounded-full bg-card/60 pl-9 text-xs"
            />
          </div>
        </div>

        {/* Cards */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {filtered.map((item) => (
            <VaultCard
              key={item._id}
              item={item}
              body={bodies[item._id] ?? null}
              locked={!(item._id in bodies)}
              onReveal={() => void handleReveal(item)}
              onEdit={() => {
                if (!passphrase) {
                  pendingRef.current = { edit: item };
                  setDialog({ mode: hasKey ? "enter" : "set" });
                } else {
                  setEditItem(item);
                }
              }}
              onDelete={() => setDeleteTarget(item)}
              onTogglePin={() => void handleTogglePin(item)}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <div className="glass mt-5 flex flex-col items-center rounded-3xl px-6 py-16 text-center">
            <VaultMark className="size-6 text-muted-foreground/60" />
            <p className="mt-4 text-sm font-medium">Nothing captured yet</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">
              Use the bar above — every entry is sealed with your key before it leaves this device.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass mt-5 rounded-3xl px-6 py-14 text-center">
            <p className="text-sm text-muted-foreground">No entries match this filter.</p>
          </div>
        ) : null}

        {/* ---------------------------- Power sections ---------------------------- */}
        {devUnlocked && powerMode ? (
          <div className="mt-16 space-y-10 border-t border-border/60 pt-10">
            <div className="flex items-center gap-2.5">
              <Terminal className="size-4 text-accent-lime" />
              <h2 className="text-sm font-medium">Developer layer</h2>
              <span className="text-mono-label ml-1">power mode</span>
            </div>

            {/* Model station */}
            <section>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent-lime">Model station</p>
                  <h3 className="mt-2 text-base font-medium">On-demand GGUF loader</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Profiled against this device, fetched on demand, and loaded into the local GGUF runtime — nothing runs in someone else's cloud.
                </p>
                </div>
                <Badge variant="outline" className="rounded-sm font-normal">
                  {loadedCount}/{MODEL_CATALOG.length} loaded
                </Badge>
              </div>
              <div className="mt-4 divide-y divide-border/50 overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm">
                {MODEL_CATALOG.map((m) => {
                  const dl = downloads[m.id];
                  const done = dl?.status === "done";
                  return (
                    <div key={m.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {m.params} · {m.quant} · {m.ctx} ctx · {m.license}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 sm:justify-end">
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {m.sizeGB.toFixed(1)} GB
                        </span>
                        {done ? (
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Check className="size-3.5" /> Loaded
                          </span>
                        ) : dl?.status === "downloading" ? (
                          <div className="flex w-32 items-center gap-2">
                            <Progress value={dl.progress} className="h-1" />
                            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                              {Math.round(dl.progress)}%
                            </span>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="rounded-md" onClick={() => startDownload(m)}>
                            <Download className="size-3.5" />
                            Fetch
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Plugin sandbox */}
            <section>
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent-iris">Plugin sandbox</p>
              <h3 className="mt-2 text-base font-medium">Capability-scoped extensions</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Each plugin runs against a declared permission. Grant or revoke at any time; the log records every transition.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="divide-y divide-border/50 overflow-hidden rounded-3xl border border-border/60 bg-card/60 backdrop-blur-sm">
                  {SANDBOX_PLUGINS.map((p) => {
                    const on = installed.includes(p.id);
                    return (
                      <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {p.permission} · {p.desc}
                          </p>
                        </div>
                        <Button
                          variant={on ? "secondary" : "outline"}
                          size="sm"
                          className="shrink-0 rounded-md"
                          onClick={() => togglePlugin(p)}
                        >
                          {on ? "Revoke" : "Grant"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <div
                  ref={logRef}
                  className="h-40 overflow-y-auto rounded-3xl border border-border/60 bg-background/60 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground"
                >
                  {log.map((line, i) => (
                    <p key={i}>
                      <span className="text-accent-lime">›</span> {line}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            {/* OTA */}
            <section>
              <p className="text-[11px] font-mono uppercase tracking-[0.22em] text-accent-flare">Live updates</p>
              <h3 className="mt-2 text-base font-medium">OTA channel</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Staged rollouts against a signed manifest. Switching channels re-points the manifest; installs hot-swap in place, no restart required.
              </p>
              <div className="mt-4 rounded-3xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-1">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        onClick={() => pickChannel(ch)}
                        className={cn(
                          "rounded-full px-4 py-1.5 font-mono text-xs transition-colors",
                          channel === ch
                            ? "bg-accent-flare text-background shadow-[0_0_16px_color-mix(in_oklch,var(--accent-flare)_45%,transparent)]"
                            : "text-muted-foreground hover:bg-foreground/8 hover:text-foreground",
                        )}
                      >
                        {ch}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      current {currentBuild}
                      {available ? ` → ${available}` : ""}
                    </span>
                    {available ? (
                      <Button size="sm" className="rounded-md" onClick={installUpdate} disabled={installing}>
                        {installing ? "Installing…" : "Install update"}
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="rounded-md" onClick={checkForUpdates} disabled={checking}>
                        {checking ? <RefreshCcw className="size-3.5 animate-spin" /> : <Package className="size-3.5" />}
                        {checking ? "Checking…" : "Check for updates"}
                      </Button>
                    )}
                  </div>
                </div>
                {installing ? <Progress value={installProgress} className="mt-4 h-1" /> : null}
              </div>
            </section>
          </div>
        ) : null}

        {/* Footer hint */}
        <footer className="mt-16 flex items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <span className="font-mono text-[11px] tracking-[0.18em]">AES-256-GCM · LOCAL-FIRST</span>
          {!devUnlocked ? (
            <span className="flex items-center gap-1 text-muted-foreground/60">
              Seven taps on the build number opens the developer layer
              <ChevronDown className="size-3" />
            </span>
          ) : (
            <button
              type="button"
              className="flex items-center gap-1 hover:text-foreground"
              onClick={() => {
                setDevUnlocked(false);
                writeLocal("vh-dev", "0");
                togglePower(false);
                toast("Developer layer closed");
              }}
            >
              Exit developer mode <ArrowUp className="size-3 rotate-180" />
            </button>
          )}
        </footer>
      </main>

      {/* Dialogs */}
      <UnlockDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            pendingRef.current = null;
            setDialog(null);
          }
        }}
        mode={dialog?.mode ?? "set"}
        title="vault"
        body=""
        onSubmit={handleUnlockSubmit}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="glass max-w-sm gap-0 rounded-3xl border-border/60 p-7 shadow-none sm:rounded-3xl">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="text-display text-lg">Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
              “{deleteTarget?.title}” will be permanently removed. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              className="rounded-full bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditDialog item={editItem} onClose={() => setEditItem(null)} onSave={handleEditSave} />
    </div>
  );
}

/* ------------------------------- edit dialog ------------------------------ */

function EditDialog({
  item,
  onClose,
  onSave,
}: {
  item: Doc<"vaultItems"> | null;
  onClose: () => void;
  onSave: (kind: VaultKind, title: string, body: string) => Promise<void>;
}) {
  const [kind, setKind] = useState<VaultKind>("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setKind(item.kind as VaultKind);
      setTitle(item.title);
      setBody("");
      setBusy(false);
    }
  }, [item]);

  if (!item) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass max-w-md gap-0 rounded-3xl border-border/60 p-7 shadow-none sm:rounded-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="text-display text-lg">Edit entry</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Changes are re-encrypted with your session key before saving.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-[110px_1fr] items-center gap-3">
            <span className="text-mono-label">Kind</span>
            <Select value={kind} onValueChange={(v) => setKind(v as VaultKind)}>
              <SelectTrigger className="h-10 rounded-2xl bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k} className="rounded-xl">
                    {KIND_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[110px_1fr] items-center gap-3">
            <span className="text-mono-label">Title</span>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-2xl bg-background/40" />
          </div>
          <div className="grid grid-cols-[110px_1fr] items-start gap-3">
            <span className="pt-2 text-mono-label">Body</span>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Original body stays encrypted — type replacement text here."
              className="min-h-28 rounded-2xl bg-background/40 text-sm"
            />
          </div>
        </div>
        <DialogFooter className="mt-6 gap-2">
          <Button variant="ghost" onClick={onClose} className="rounded-full text-muted-foreground">
            Cancel
          </Button>
          <Button
            disabled={busy || !title.trim() || !body.trim()}
            onClick={async () => {
              setBusy(true);
              await onSave(kind, title, body);
            }}
            className="rounded-full"
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
