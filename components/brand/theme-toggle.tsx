"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Both icons are rendered and toggled with the `dark:` variant, so there's no
 * hydration mismatch and no "mounted" state needed.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Moon strokeWidth={1.5} className="dark:hidden" />
      <Sun strokeWidth={1.5} className="hidden dark:block" />
    </Button>
  );
}
