"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";

function PendingHint() {
  const { pending } = useLinkStatus();
  return <><span className="client-link-indicator" data-pending={pending} aria-hidden="true">…</span><span className="sr-only" role="status">{pending ? "Duke ngarkuar klientët. Ju lutemi, prisni." : ""}</span></>;
}

export function ClientLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false}>{children}<PendingHint /></Link>;
}
