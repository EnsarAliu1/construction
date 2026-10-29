import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import "@/styles/globals.css";
import { currentUser } from "@/server/auth/web";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Pamja e sistemit", template: "%s | Sistemi i ndërtimit" },
  description: "Sistemi lokal për menaxhimin e ndërtimit.",
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  // Each page checks its own authorization before rendering; preserve its return URL.
  return <html lang="sq"><body>{user ? <WorkspaceShell user={user}>{children}</WorkspaceShell> : children}</body></html>;
}
