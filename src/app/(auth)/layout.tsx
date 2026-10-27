import type { ReactNode } from "react";
import "@/styles/globals.css";

export const metadata={robots:{index:false,follow:false}};
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
