import { VaultMark } from "@/components/AppHeader";
import { ThemeToggle } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(returnTo: string | null, fallback = "/dashboard") {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(searchParams.get("returnTo"), redirectAfterAuth);

  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
    } catch (err) {
      console.error("Email sign-in error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to send verification code. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("The verification code you entered is incorrect.");
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (err) {
      console.error("Guest login error:", err);
      setError(
        `Failed to sign in as guest: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-ember relative min-h-screen overflow-x-clip text-foreground">
      <div className="aurora -z-10 left-[-10rem] top-[-6rem] size-[30rem] bg-[oklch(0.62_0.2_25/0.3)]" />
      <div className="aurora -z-10 bottom-[-8rem] right-[-6rem] size-[26rem] bg-[oklch(0.77_0.19_128/0.2)]" />

      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-7 items-center justify-center rounded-lg bg-foreground/5 dark:bg-white/8">
            <VaultMark className="size-4" />
          </span>
          <span className="text-[15px] font-medium tracking-tight">Vault Hub</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-6 lg:grid-cols-[1fr_420px] lg:gap-16">
        {/* Manifesto panel */}
        <section className="relative order-2 lg:order-1">
          <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center">
            {/* Ember orb */}
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 42%, oklch(0.62 0.2 25 / 70%) 0%, oklch(0.55 0.22 292 / 40%) 48%, transparent 72%)",
                filter: "blur(8px)",
              }}
            />
            <div className="absolute inset-6 rounded-full border border-white/10" />
            <div className="absolute inset-16 rounded-full border border-white/5" />
            <div className="relative z-10 max-w-xs text-center">
              <ShieldCheck className="mx-auto size-5 text-accent-lime" />
              <p className="font-dot mt-5 text-4xl leading-tight text-foreground">
                0
                <br />
                keys
                <br />
                leave
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Your vault key is derived on this device with PBKDF2 and never
                transmitted. The server stores ciphertext — and that is all it will
                ever see.
              </p>
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
            {[
              { k: "AES-256", v: "GCM encryption" },
              { k: "210k", v: "PBKDF2 rounds" },
              { k: "1", v: "person. you." },
            ].map((s) => (
              <div key={s.k} className="glass rounded-2xl px-3 py-4">
                <p className="font-dot text-lg text-foreground">{s.k}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Form card */}
        <section className="order-1 lg:order-2">
          <div className="glass glow-card rounded-3xl p-7 sm:p-8" style={{ "--glow-a": "oklch(0.62 0.2 25 / 40%)", "--glow-b": "oklch(0.77 0.19 128 / 28%)" } as React.CSSProperties}>
            {step === "signIn" ? (
              <>
                <p className="text-mono-label">Secure Vault Hub</p>
                <h1 className="text-display mt-3 text-2xl">Open your vault</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  One account, one vault — yours. Enter your email and we&apos;ll send
                  a six-digit sign-in code.
                </p>

                <form onSubmit={handleEmailSubmit}>
                  <div className="mt-7 space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        className="h-12 rounded-2xl bg-background/40 pl-11"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    {error ? <p className="text-xs text-destructive">{error}</p> : null}
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-2xl shadow-[0_0_24px_color-mix(in_oklch,var(--accent-lime)_35%,transparent)]"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/70" />
                  <span className="text-mono-label">or</span>
                  <div className="h-px flex-1 bg-border/70" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="mt-6 h-12 w-full rounded-2xl bg-background/30"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <UserX className="size-4" />
                  Continue as guest
                </Button>

                <p className="mt-7 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Your vault key is derived on this device and never leaves it.
                </p>
              </>
            ) : (
              <>
                <p className="text-mono-label">Verification</p>
                <h1 className="text-display mt-3 text-2xl">Check your email</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  We sent a six-digit code to {step.email}.
                </p>

                <form onSubmit={handleOtpSubmit}>
                  <div className="mt-7">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            form?.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error ? (
                      <p className="mt-3 text-center text-xs text-destructive">{error}</p>
                    ) : null}

                    <Button
                      type="submit"
                      className="mt-6 h-12 w-full rounded-2xl shadow-[0_0_24px_color-mix(in_oklch,var(--accent-lime)_35%,transparent)]"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="mt-3 h-11 w-full rounded-2xl text-muted-foreground"
                    >
                      Use a different email
                    </Button>
                    <p className="mt-4 text-center text-xs text-muted-foreground">
                      Didn&apos;t receive a code?{" "}
                      <button
                        type="button"
                        className="text-foreground underline underline-offset-4"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </button>
                    </p>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
