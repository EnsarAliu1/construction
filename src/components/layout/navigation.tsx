"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { NavigationItem } from "@/types/navigation";
import { cn } from "@/lib/utils";

function NavigationLinks({ items, onNavigate }: { items: NavigationItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return items.map(item => <Link key={item.href} href={item.href} onClick={onNavigate}
    className={cn("nav-item", pathname === item.href && "active")} aria-current={pathname === item.href ? "page" : undefined}>
    {item.label}
  </Link>);
}

export function DesktopNavigation({ items, label, className }: { items: NavigationItem[]; label: string; className?: string }) {
  return <nav aria-label={label} className={cn("desktop-navigation", className)}><NavigationLinks items={items} /></nav>;
}

export function MobileNavigation({ items, label, openLabel, closeLabel }: {
  items: NavigationItem[]; label: string; openLabel: string; closeLabel: string;
}) {
  const pathname = usePathname();
  // A new route also resets the menu when navigation happens through browser history.
  return <MobileMenu key={pathname} {...{ items, label, openLabel, closeLabel }} />;
}

function MobileMenu({ items, label, openLabel, closeLabel }: {
  items: NavigationItem[]; label: string; openLabel: string; closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  return <div className="mobile-navigation" ref={container} onKeyDown={event => {
    if (event.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); }
  }}>
    <button ref={trigger} type="button" className="menu-trigger" aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}>
      <span aria-hidden="true">{open ? "×" : "☰"}</span> {open ? closeLabel : openLabel}
    </button>
    {open && <nav id="mobile-menu" aria-label={label} className="mobile-menu"><NavigationLinks items={items} onNavigate={() => setOpen(false)} /></nav>}
  </div>;
}
