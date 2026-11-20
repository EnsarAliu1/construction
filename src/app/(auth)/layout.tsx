import type { ReactNode } from "react";
import "@/styles/globals.css";
import "@/styles/auth.css";
import "@/styles/passkeys.css";
import "@/styles/auth-polish.css";
import "@/styles/login-welcome.css";

export const metadata={robots:{index:false,follow:false}};
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <html lang="sq"><body>{children}</body></html>;
}
