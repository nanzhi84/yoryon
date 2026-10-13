"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { DropdownMenuItem } from "./ui/dropdown-menu";

function applyTheme(theme: "light" | "dark" | "system") {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  if (theme === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", theme);
}

/** 与账户菜单共享同一焦点和键盘导航，不再嵌套第二个下拉菜单。 */
export function ThemeMenuItems() {
  return <>
    <DropdownMenuItem onSelect={() => applyTheme("light")}><Sun className="mr-2 size-4" aria-hidden="true" />浅色</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => applyTheme("dark")}><Moon className="mr-2 size-4" aria-hidden="true" />深色</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => applyTheme("system")}><Monitor className="mr-2 size-4" aria-hidden="true" />跟随系统</DropdownMenuItem>
  </>;
}
