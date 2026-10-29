import Link from "next/link";
import type { ReactNode } from "react";
import { DesktopNavigation, MobileNavigation } from "./navigation";
import { workspaceNavigation } from "@/features/workspace/sections";
import type { AuthenticatedUser } from "@/server/auth/security";
import { LogoutButton } from "@/components/auth/logout-button";

export function WorkspaceShell({ children, user }: { children: ReactNode; user: AuthenticatedUser }) {
  return <div className="workspace-layout">
    <a href="#main-content" className="skip-link">Kalo te përmbajtja</a>
    <aside className="sidebar"><Link href="/app" className="wordmark">Ndërtim<span>SISTEMI I MENAXHIMIT</span></Link>
      <p className="eyebrow sidebar-label">Hapësira e punës</p><DesktopNavigation items={workspaceNavigation} label="Hapësira e punës" className="sidebar-links" />
      <div className="sidebar-footer"><span className="badge">Hapësirë private pune</span><Link href="/app/security">Siguria e llogarisë</Link><Link href="/sq">Faqja publike ↗</Link></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><Link href="/app" className="workspace-name">Ndërtim <span className="muted">/ Hapësira e punës</span></Link><div className="workspace-user"><span>{user.displayName}</span><LogoutButton /></div>
      <MobileNavigation items={workspaceNavigation} label="Hapësira e punës në telefon" openLabel="Menyja" closeLabel="Mbyll" /></header>
      <div className="preview-notice"><strong>Hapësira e punës</strong><span>Klientët, projektet, kontratat, shpenzimet, kategoritë, furnitorët dhe automjetet janë të disponueshme. Pagesat dhe dëftesat PDF JO-FISKALE janë të disponueshme. Miratimi kontabël mbetet në pritje.</span></div>
      <main id="main-content" className="workspace-content">{children}</main>
    </div>
  </div>;
}
