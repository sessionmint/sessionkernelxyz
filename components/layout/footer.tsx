"use client";

import Link from "next/link";
import { Github, X, Globe } from "lucide-react";

export function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Social links */}
          <div className="flex items-center gap-1">
            <FooterLink
              href="https://x.com/sessionmintlabs"
              icon={<X className="h-4 w-4" />}
            />
            <FooterLink
              href="https://t.me/SessionMint"
              icon={<Globe className="h-4 w-4" />}
            />
            <FooterLink
              href="https://github.com/sessionmint"
              icon={<Github className="h-4 w-4" />}
            />
          </div>

          {/* Center: Powered by */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Powered by</span>
            <Link
              href="https://sessionmint.fun"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              <span className="font-semibold text-white">SessionMint</span>
            </Link>
          </div>

          {/* Right: Version badge */}
          <div className="hidden sm:flex items-center">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
              v1.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, icon }: { href: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="p-2 rounded-lg text-muted-foreground/70 hover:text-green-400 hover:bg-accent/50 transition-all duration-200"
    >
      {icon}
    </Link>
  );
}
