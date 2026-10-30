import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import "@/styles/globals.css";
import "@/styles/login-welcome.css";
import "@/styles/passkeys.css";
import {LoginWelcome} from '@/components/auth/login-welcome';
import { currentUser } from "@/server/auth/web";
import { cookies } from "next/headers";
import "@/styles/workspace.css";
import "@/styles/management.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Pamja e sistemit", template: "%s | Sistemi i ndërtimit" },
  description: "Sistemi lokal për menaxhimin e ndërtimit.",
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const user = await currentUser().catch(() => null);
  const preferences = await cookies();
  const theme = preferences.get('fitimi_theme')?.value === 'dark' ? 'dark' : 'light';
  const collapsed = preferences.get('fitimi_sidebar')?.value === 'collapsed';
  // Each page checks its own authorization before rendering; preserve its return URL.
  return <html lang="sq" data-workspace-theme={theme}><body>{user ? <WorkspaceShell user={user} initialTheme={theme} initialCollapsed={collapsed}><LoginWelcome/>{children}{modal}</WorkspaceShell> : children}</body></html>;
}
