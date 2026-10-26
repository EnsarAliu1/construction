"use client";

import { useActionState } from "react";
import { logoutAction } from "@/app/(workspace)/app/actions";

export function LogoutButton() {
  const [state, action, pending] = useActionState(logoutAction, undefined);
  return <form action={action} className="logout-control"><button className="menu-trigger" type="submit" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>{state?.message && <p role="alert">{state.message}</p>}</form>;
}
