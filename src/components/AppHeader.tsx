import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { Moon, Sun } from "lucide-react";
import { Link } from "react-router";

function VaultMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn("size-5", className)}
    >
      <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="M12 5v3.5M12 15.5V19M5 12h3.5M15.5 12H19" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn("text-muted-foreground hover:text-foreground", className)}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export function DevToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-11 shrink-0 items-center rounded-full border px-0.5 transition-colors",
        checked ? "border-foreground bg-foreground" : "border-border bg-transparent",
      )}
      aria-label="Toggle power mode"
    >
      <span
        className={cn(
          "block size-4 rounded-full transition-transform",
          checked ? "translate-x-[18px] bg-background" : "translate-x-0 bg-muted-foreground",
        )}
      />
    </button>
  );
}

interface AppHeaderProps {
  devMode?: boolean;
  onPowerToggle?: (next: boolean) => void;
}

export function AppHeader({ devMode, onPowerToggle }: AppHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link to="/" className="flex items-center gap-2.5 text-foreground">
          <VaultMark />
          <span className="text-[15px] font-medium tracking-tight">Vault Hub</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {devMode !== undefined && onPowerToggle ? (
            <div className="mr-2 hidden items-center gap-2 sm:flex">
              <span className="text-mono-label hidden md:inline">Power</span>
              <DevToggle checked={devMode} onChange={onPowerToggle} />
            </div>
          ) : null}
          <ThemeToggle />
          {!isLoading && !isAuthenticated ? (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link to="/auth">Sign in</Link>
            </Button>
          ) : null}
          {!isLoading && !isAuthenticated ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Open vault</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export { VaultMark };
