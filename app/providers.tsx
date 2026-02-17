"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { WalletProvider } from "@/contexts/ContextProvider";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <WalletProvider>{children}</WalletProvider>
    </ThemeProvider>
  );
}
