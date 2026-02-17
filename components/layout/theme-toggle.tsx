"use client";

import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  return (
    <Button
      variant="ghost"
      size="icon"
      disabled
      className="h-9 w-9 rounded-xl opacity-50 cursor-not-allowed"
      title="Dark mode only"
    >
      <Moon className="h-[18px] w-[18px]" />
      <span className="sr-only">Dark mode only</span>
    </Button>
  );
}
