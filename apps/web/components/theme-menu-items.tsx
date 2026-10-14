"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { DropdownMenuItem } from "./ui/dropdown-menu";
export function ThemeMenuItems() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next); setDark(next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* 禁用存储时只应用本次主题。 */ }
  }
  return <DropdownMenuItem role="menuitemcheckbox" aria-checked={dark} aria-label="深色外观" onSelect={event => { event.preventDefault(); toggle(); }} className="justify-between gap-5">
    <span className="flex items-center gap-2">{dark ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}深色外观</span>
    <span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition-colors ${dark ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-0.5 size-4 rounded-full bg-background transition-transform ${dark ? "translate-x-[18px]" : "translate-x-0.5"}`} /></span>
  </DropdownMenuItem>;
}
