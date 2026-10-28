"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Optional storage may be unavailable; the current page can still switch.
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 text-muted-foreground"
      aria-label={dark ? "切换为浅色外观" : "切换为深色外观"}
      aria-pressed={dark}
      onClick={toggle}
    >
      <Sun className="size-[18px] dark:hidden" aria-hidden="true" />
      <Moon className="hidden size-[18px] dark:block" aria-hidden="true" />
    </Button>
  );
}
