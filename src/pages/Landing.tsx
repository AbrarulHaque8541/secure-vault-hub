import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import {
  Braces,
  CircleCheck,
  FileText,
  Link2,
  Lock,
  RefreshCcw,
  Sparkles,
  Terminal,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const KINDS = [
  { label: "Note", icon: FileText },
  { label: "Link", icon: Link2 },
  { label: "Snippet", icon: Braces },
  { label: "Prompt", icon: Sparkles },
  { label: "Task", icon: CircleCheck },
];

const PHASES = [
  {
    phase: "01",
    title: "Capture",
    lines: [
      "A single bar for everything — notes, links, snippets, prompts, tasks. The vault parses kind and tags from the input, so filing takes zero clicks.",
    ],
  },
  {
    phase: "02",
    title: "Encrypt",
    lines: [
      "AES-256-GCM with a PBKDF2-derived key. Your vault key is derived on-device and never transmitted — the cloud only ever stores opaque ciphertext.",
    ],
  },
  {
    phase: "03",
    title: "Model station",
    lines: [
      "An on-demand catalog of GGUF models. Profiles are sized to your hardware, downloads run in background lanes, and inference stays local.",
    ],
  },
  {
    phase: "04",
    title: "Power modes",
    lines: [
      "A hidden dev menu, unlocked with seven taps. Plugin sandbox, clipboard bridge, and a Termux-style CLI lane for power users.",
    ],
  },
  {
    phase: "05",
    title: "Live updates",
    lines: [
      "Local OTA channel with staged builds — alpha, beta, stable. Hot-swap runtime modules without ever leaving the app.",
    ],
  },
];

const FEATURES = [
  {
    title: "Local-first storage",
    body: "Vault entries live in a reactive local store, mirrored to an encrypted index in the cloud. Every write is signed with the session key.",
    icon: Lock,
  },
  {
    title: "Local model loaders",
    body: "GGUF checkpoints load straight from local storage or Hugging Face, profiled against your device before download.",
    icon: FileText,
  },
  {
    title: "CLI agent bridge",
    body: "Power modes expose a Termux-style shell and plugin sandbox for scripted capture, batch pinning, and model profiling.",
    icon: Terminal,
  },
  {
    title: "OTA engine",
    body: "Staged rollout channel with manifest hashing. Alpha, beta, and stable builds switch without a redeploy.",
    icon: RefreshCcw,
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
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col justify-center px-6 py-20">
          <motion.p {...fadeUp} className="text-mono-label">
            Local-first AI vault
          </motion.p>
          <motion.h1
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.06 }}
            className="mt-6 max-w-3xl text-5xl leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl font-[460]"
          >
            Capture everything.
            <br />
            <span className="text-muted-foreground">Keep nothing readable.</span>
          </motion.h1>
          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.12 }}
            className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground"
          >
            Kindling is a local-first vault and AI workstation. One universal capture
            bar files every thought, link, and snippet — encrypted with a key that
            never leaves your device.
          </motion.p>
          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.18 }}
            className="mt-10 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" className="h-11 rounded-md px-7 text-[15px]">
              <Link to="/dashboard">Open your vault</Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="h-11 rounded-md px-5 text-muted-foreground hover:text-foreground">
              <a href="#how">See how it works</a>
            </Button>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.24 }}
            className="mt-24 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-5"
          >
            {KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className="flex flex-col items-center gap-2.5 bg-background px-4 py-6"
                >
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-foreground">{k.label}</span>
                </div>
              );
            })}
          </motion.div>
        </section>

        <SectionDivider />

        {/* How it works */}
        <section id="how" className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-mono-label">The loop</p>
              <h2 className="text-display mt-4 max-w-lg text-3xl leading-tight sm:text-4xl">
                Five phases, one surface.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Everything in Kindling maps to a single vertical: capture, encrypt, load
              models, unlock power tools, stay current.
            </p>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 md:grid-cols-5">
            {PHASES.map((p, i) => (
              <motion.div
                key={p.phase}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: "easeOut" }}
                className="flex min-h-[240px] flex-col bg-background p-6"
              >
                <span className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
                  {p.phase}
                </span>
                <h3 className="mt-auto pt-16 text-sm font-medium text-foreground">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  {p.lines[0]}
                </p>
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
                    <Icon className="size-4 text-muted-foreground" />
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
        <section className="mx-auto w-full max-w-6xl px-6 py-28 text-center">
          <motion.p {...fadeUp} className="text-mono-label">
            Ready when you are
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
            <Button asChild size="lg" className="mt-10 h-11 rounded-md px-8 text-[15px]">
              <Link to="/auth">Start capturing</Link>
            </Button>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-xs text-muted-foreground sm:flex-row">
          <span>Kindling — a local-first vault and AI workstation.</span>
          <span className="font-mono text-[11px] tracking-[0.18em]">AES-256-GCM · OTA · GGUF</span>
        </div>
      </footer>
    </div>
  );
}
