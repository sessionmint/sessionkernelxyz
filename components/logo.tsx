"use client";

import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  // Use the SessionMint logo
  const logoSrc = "/images/logo.png";

  return (
    <Link href="/" className={className}>
      <Image
        src={logoSrc}
        alt="SessionMint"
        width={140}
        height={40}
        className="w-24 md:w-32 lg:w-36"
        priority
      />
    </Link>
  );
}
