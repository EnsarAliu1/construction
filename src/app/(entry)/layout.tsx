import type { ReactNode } from "react";
import "@/styles/globals.css";

export default function EntryLayout({ children }: { children: ReactNode }) {
  return <html lang="sq"><body>{children}</body></html>;
}
