import Link from "next/link";
import type { ReactNode } from "react";
import { DesktopNavigation, MobileNavigation } from "./navigation";
import { workspaceNavigation } from "@/features/workspace/sections";

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return <div className="workspace-layout">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar"><Link href="/app" className="wordmark">Construction<span>MANAGEMENT WORKSPACE</span></Link>
      <p className="eyebrow sidebar-label">Workspace</p><DesktopNavigation items={workspaceNavigation} label="Workspace" className="sidebar-links" />
      <div className="sidebar-footer"><span className="badge">WP-01 · Preview</span><Link href="/sq">Public website ↗</Link></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><Link href="/app" className="workspace-name">Construction <span className="muted">/ Workspace</span></Link><span className="desktop-note">EUR · Local preview</span>
      <MobileNavigation items={workspaceNavigation} label="Workspace mobile" openLabel="Menu" closeLabel="Close" /></header>
      <div className="preview-notice"><strong>Development preview</strong><span>No sign-in protection. Financial actions and data storage are unavailable.</span></div>
      <main id="main-content" className="workspace-content">{children}</main>
    </div>
  </div>;
}
