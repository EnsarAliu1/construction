import type { ReactNode } from "react";
import "@/styles/globals.css";
import "@/styles/auth.css";

export const metadata={robots:{index:false,follow:false}};
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <html lang="sq"><body>{children}</body></html>;
}
