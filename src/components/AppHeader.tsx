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
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 4v4.4M12 15.6V20M4 12h4.4M15.6 12H20" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
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
      className={cn(
        "size-8 rounded-full text-muted-foreground hover:text-foreground",
        className,
      )}
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
        "flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors",
        checked ? "bg-accent-lime" : "bg-foreground/12",
      )}
      aria-label="Toggle power mode"
    >
      <span
        className={cn(
          "block size-5 rounded-full transition-transform",
          checked
            ? "translate-x-[14px] bg-[oklch(0.16_0.01_130)] shadow-[0_0_10px_var(--accent-lime)]"
            : "translate-x-0 bg-muted-foreground",
        )}
      />
    </button>
  );
}

interface AppHeaderProps {
  devMode?: boolean;
  onPowerToggle?: (next: boolean) => void;
  floating?: boolean;
}

export function AppHeader({ devMode, onPowerToggle, floating }: AppHeaderProps) {
  const { isAuthenticated, isLoading } = useAuth();
  return (
    <div className={cn("sticky top-0 z-40", floating && "top-4 z-40 px-4")}>
      <header
        className={cn(
          "mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-4 px-2 sm:px-5",
          floating
            ? "glass rounded-full"
            : "border-b border-border/60 bg-background/80 backdrop-blur-md",
        )}
      >
        <Link to="/" className="flex items-center gap-2.5 text-foreground">
          <span className="flex size-7 items-center justify-center rounded-lg bg-foreground/5 dark:bg-white/8">
            <VaultMark className="size-4" />
          </span>
          <span className="text-[15px] font-medium tracking-tight">Vault Hub</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {devMode !== undefined && onPowerToggle ? (
            <div className="mr-1 hidden items-center gap-2 sm:flex">
              <span className="text-mono-label hidden md:inline">Power</span>
              <DevToggle checked={devMode} onChange={onPowerToggle} />
            </div>
          ) : null}
          <ThemeToggle />
          {!isLoading && !isAuthenticated ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-full text-muted-foreground hover:text-foreground"
              >
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-full shadow-[0_0_18px_color-mix(in_oklch,var(--accent-lime)_38%,transparent)]"
              >
                <Link to="/dashboard">Open vault</Link>
              </Button>
            </>
          ) : null}
        </div>
      </header>
    </div>
  );
}

export { VaultMark };
