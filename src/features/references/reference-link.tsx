"use client";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
function Hint() { const { pending } = useLinkStatus(); return <><span className="client-link-indicator" data-pending={pending} aria-hidden="true">…</span><span role="status" className="sr-only">{pending ? "Duke ngarkuar të dhënat. Ju lutemi, prisni." : ""}</span></>; }
export function ReferenceLink({ children, ...props }: ComponentProps<typeof Link>) { return <Link {...props} prefetch={false}>{children}<Hint /></Link>; }
