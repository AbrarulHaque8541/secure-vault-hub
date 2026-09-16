import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Braces,
  CircleCheck,
  Eye,
  FileText,
  Link2,
  Lock,
  RefreshCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

/* Glow widget presets — hue pairs for the gradient cards */
const WIDGET_TONES = {
  ember: { a: "oklch(0.62 0.2 25 / 55%)", b: "oklch(0.82 0.14 85 / 45%)" },
  iris: { a: "oklch(0.55 0.22 292 / 50%)", b: "oklch(0.68 0.15 220 / 40%)" },
  mint: { a: "oklch(0.72 0.16 165 / 45%)", b: "oklch(0.86 0.2 128 / 40%)" },
  rose: { a: "oklch(0.62 0.21 350 / 45%)", b: "oklch(0.74 0.16 310 / 40%)" },
} as const;

type Tone = keyof typeof WIDGET_TONES;

function GlowCard({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`glow-card ${className ?? ""}`}
      style={
        {
          "--glow-a": WIDGET_TONES[tone].a,
          "--glow-b": WIDGET_TONES[tone].b,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

const KINDS = [
  { label: "Note", icon: FileText, tone: "ember" as Tone },
  { label: "Link", icon: Link2, tone: "iris" as Tone },
  { label: "Snippet", icon: Braces, tone: "mint" as Tone },
  { label: "Prompt", icon: Sparkles, tone: "rose" as Tone },
  { label: "Task", icon: CircleCheck, tone: "ember" as Tone },
];

const PHASES = [
  {
    phase: "01",
    tone: "ember" as Tone,
    title: "Capture",
    lines: [
      "One bar for everything. Notes, links, snippets, prompts, tasks — a #tag files it for you before your coffee cools.",
    ],
  },
  {
    phase: "02",
    tone: "iris" as Tone,
    title: "Encrypt",
    lines: [
      "AES-256-GCM under a key that is derived on this device and never leaves it. The cloud stores ciphertext and nothing else.",
    ],
  },
  {
    phase: "03",
    tone: "mint" as Tone,
    title: "Model station",
    lines: [
      "A catalog of GGUF models, profiled against your hardware. Fetch what you need, run it on your own silicon.",
    ],
  },
  {
    phase: "04",
    tone: "rose" as Tone,
    title: "Power modes",
    lines: [
      "Tap the build number seven times. The dev layer opens — plugin sandbox, clipboard bridge, a Termux-style shell lane.",
    ],
  },
  {
    phase: "05",
    tone: "ember" as Tone,
    title: "Live updates",
    lines: [
      "Alpha, beta, stable. Pick a channel, check the manifest, hot-swap builds without closing a single tab.",
    ],
  },
];

const FEATURES = [
  {
    title: "Local-first by conviction",
    body: "Entries live in a reactive local store, mirrored to an encrypted index in the cloud. Every write is sealed with your session key before it moves.",
    icon: Lock,
    tone: "text-accent-lime",
  },
  {
    title: "Local model loaders",
    body: "GGUF checkpoints load straight from local storage or Hugging Face, profiled against your device before a single byte is downloaded.",
    icon: FileText,
    tone: "text-accent-iris",
  },
  {
    title: "CLI agent bridge",
    body: "Power modes expose a Termux-style shell and a plugin sandbox: scripted capture, batch pinning, model profiling — all from a prompt.",
    icon: Terminal,
    tone: "text-accent-flare",
  },
  {
    title: "OTA engine",
    body: "A staged-rollout channel with manifest hashing. Alpha, beta, and stable builds switch without a redeploy, mid-session if you like.",
    icon: RefreshCcw,
    tone: "text-accent-lime",
  },
];

function SectionDivider() {
  return <div className="mx-auto h-px w-full max-w-6xl bg-border/70" />;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.45, ease: "easeOut" as const },
};

export default function Landing() {
  return (
    <div className="page-ember relative min-h-screen overflow-x-clip text-foreground">
      <AppHeader floating />

      <main>
        {/* Hero */}
        <section className="relative mx-auto flex w-full max-w-6xl flex-col justify-center px-6 pb-16 pt-14 sm:pt-20">
          {/* ambient blobs */}
          <div className="aurora -z-10 left-[-8rem] top-10 size-[26rem] bg-[oklch(0.62_0.2_25/0.35)]" />
          <div className="aurora -z-10 right-[-6rem] top-64 size-[22rem] bg-[oklch(0.55_0.22_292/0.3)]" />
          <div className="aurora -z-10 bottom-[-6rem] left-1/3 size-[24rem] bg-[oklch(0.77_0.19_128/0.22)]" />

          <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <motion.p {...fadeUp} className="text-mono-label">
                For an audience of exactly one — you
              </motion.p>
              <motion.h1
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.06 }}
                className="text-display mt-6 text-5xl leading-[1.02] sm:text-6xl lg:text-7xl"
              >
                Your second brain.
                <br />
                <span className="text-muted-foreground">Nobody else&apos;s.</span>
              </motion.h1>
              <motion.p
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.12 }}
                className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground"
              >
                Secure Vault Hub is a personal, encrypted AI workspace. One capture bar
                for every stray thought, an AES-256 vault under it, and local models
                behind that — with a developer layer for when you feel dangerous.
              </motion.p>
              <motion.div
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: 0.18 }}
                className="mt-10 flex flex-wrap items-center gap-3"
              >
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full px-8 text-[15px] shadow-[0_0_28px_color-mix(in_oklch,var(--accent-lime)_40%,transparent)]"
                >
                  <Link to="/dashboard">Open your vault</Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="h-12 rounded-full px-6 text-muted-foreground hover:text-foreground"
                >
                  <a href="#how">See how it works</a>
                </Button>
                <span className="ml-1 hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
                  <Eye className="size-3.5" />
                  no observers, no telemetry, no exceptions
                </span>
              </motion.div>
            </div>

            {/* Hero widget stack — floating glow cards */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="relative mx-auto grid w-full max-w-sm grid-cols-2 gap-4 pb-10"
            >
              <GlowCard tone="ember" className="col-span-2 p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm text-foreground/75">Captured this week</p>
                    <p className="font-dot mt-2 text-5xl leading-none text-foreground">
                      12.60
                    </p>
                  </div>
                  <span className="text-mono-label">entries</span>
                </div>
                <div className="mt-4 flex items-end gap-1.5">
                  {[38, 55, 30, 66, 48, 80, 62].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-full bg-foreground/25"
                      style={{ height: `${h * 0.6}px` }}
                    />
                  ))}
                </div>
              </GlowCard>

              <GlowCard tone="rose" className="p-5">
                <p className="text-sm text-foreground/75">Vault key</p>
                <p className="mt-2 flex items-center gap-2">
                  <Lock className="size-4 text-foreground/80" />
                  <span className="font-dot text-2xl text-foreground">AES-256</span>
                </p>
                <p className="mt-3 text-xs leading-relaxed text-foreground/60">
                  Derived on-device. Never transmitted.
                </p>
              </GlowCard>

              <GlowCard tone="iris" className="p-5">
                <p className="text-sm text-foreground/75">Model station</p>
                <p className="font-dot mt-2 text-2xl text-foreground">4</p>
                <p className="mt-3 text-xs leading-relaxed text-foreground/60">
                  GGUF profiles ready to fetch.
                </p>
              </GlowCard>
            </motion.div>
          </div>

          {/* Kind strip */}
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.24 }}
            className="mt-16 grid grid-cols-2 gap-3 sm:grid-cols-5"
          >
            {KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3.5"
                >
                  <Icon
                    className={
                      k.tone === "ember"
                        ? "size-4 text-accent-flare"
                        : k.tone === "iris"
                          ? "size-4 text-accent-iris"
                          : k.tone === "mint"
                            ? "size-4 text-accent-lime"
                            : "size-4 text-accent-flare"
                    }
                  />
                  <span className="text-sm font-medium text-foreground">{k.label}</span>
                </div>
              );
            })}
          </motion.div>
        </section>

        <SectionDivider />

        {/* How it works — tinted bento */}
        <section id="how" className="relative mx-auto w-full max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-mono-label">The loop</p>
              <h2 className="text-display mt-4 max-w-lg text-3xl leading-tight sm:text-4xl">
                Five phases, one surface.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Everything in the Hub maps to one vertical: capture it, seal it, load a
              model, unlock power tools, stay current.
            </p>
          </div>

          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PHASES.map((p, i) => (
              <motion.div
                key={p.phase}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: "easeOut" }}
                className={i === 0 ? "sm:col-span-2 lg:col-span-1" : ""}
              >
                <GlowCard tone={p.tone} className="h-full p-6">
                  <span className="font-dot text-lg text-foreground/80">{p.phase}</span>
                  <h3 className="mt-8 text-base font-medium text-foreground">{p.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground/65">
                    {p.lines[0]}
                  </p>
                </GlowCard>
              </motion.div>
            ))}
          </div>
        </section>

        <SectionDivider />

        {/* Features */}
        <section className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="grid gap-10 md:grid-cols-2 md:gap-16">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="border-t border-border/70 pt-8">
                  <div className="flex items-center gap-2.5">
                    <Icon className={`size-4 ${f.tone}`} />
                    <h3 className="text-sm font-medium">{f.title}</h3>
                  </div>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <SectionDivider />

        {/* CTA */}
        <section className="relative mx-auto w-full max-w-6xl px-6 py-28 text-center">
          <div className="aurora -z-10 left-1/2 top-1/2 size-[30rem] -translate-x-1/2 -translate-y-1/2 bg-[oklch(0.62_0.2_25/0.2)]" />
          <motion.p {...fadeUp} className="text-mono-label">
            Built for one. Yours.
          </motion.p>
          <motion.h2
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.06 }}
            className="text-display mx-auto mt-5 max-w-2xl text-3xl leading-tight sm:text-4xl"
          >
            Your vault is empty.
            <br />
            <span className="text-muted-foreground">It doesn&apos;t have to be.</span>
          </motion.h2>
          <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.12 }}>
            <Button
              asChild
              size="lg"
              className="mt-10 h-12 rounded-full px-9 text-[15px] shadow-[0_0_28px_color-mix(in_oklch,var(--accent-lime)_40%,transparent)]"
            >
              <Link to="/auth">Start capturing</Link>
            </Button>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-xs text-muted-foreground sm:flex-row">
          <span>Secure Vault Hub — personal, encrypted, and entirely yours.</span>
          <span className="font-mono text-[11px] tracking-[0.18em]">AES-256-GCM · OTA · GGUF</span>
        </div>
      </footer>
    </div>
  );
}
