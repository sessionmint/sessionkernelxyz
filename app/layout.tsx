import { Toaster } from "sonner";
import "@/styles/globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "SessionMint.fun",
  description: "A deterministic control layer for live stream focus and time-bounded Session State allocation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen antialiased"
        suppressHydrationWarning
      >
        <Providers>
          <main className="min-h-screen">{children}</main>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
