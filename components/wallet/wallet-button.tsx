"use client";

import { useMemo } from "react";
import { usePhantomWallet } from "@/contexts/ContextProvider";

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export function WalletButton() {
  const { connected, connecting, address, connect, disconnect } = usePhantomWallet();

  const label = useMemo(() => {
    if (connecting) return "Connecting...";
    if (connected && address) return shortAddr(address);
    return "Connect Phantom";
  }, [connected, connecting, address]);

  return (
    <div className="relative z-50 flex items-center gap-2">
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-60"
        onClick={connected ? disconnect : connect}
        disabled={connecting}
      >
        {connected ? "Disconnect" : label}
      </button>

      {connected && address ? (
        <span className="hidden sm:inline text-xs text-white/70">
          {shortAddr(address)}
        </span>
      ) : null}
    </div>
  );
}
