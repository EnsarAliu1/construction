import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Workspace preview", template: "%s | Construction workspace" },
  description: "Local construction management interface preview.",
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><WorkspaceShell>{children}</WorkspaceShell></body></html>;
}
