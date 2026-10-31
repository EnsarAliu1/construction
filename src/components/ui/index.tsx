import {MoneyInput} from "@/components/workspace/money-input";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("button", className)} {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return props.inputMode === "decimal" ? <MoneyInput className={className} {...props}/> : <input className={cn("input", className)} {...props} />;
}

export function FormField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="form-field"><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function Badge({ children }: { children: ReactNode }) {
  const states:Record<string,string>={Aktiv:'active',Joaktiv:'inactive',Pranuar:'received',Regjistruar:'recorded',Anuluar:'cancelled',Lëshuar:'issued',Përfunduar:'completed',Pezulluar:'suspended'};
  const state=typeof children==='string'?states[children]:undefined;
  return <span className={cn('badge',state&&`app-status ${state}`)}>{children}</span>;
}

export function PageHeading({ eyebrow, title, description, children }: {
  eyebrow?: string; title: string; description: string; children?: ReactNode;
}) {
  return <header className="page-heading">
    <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1><p className="muted description">{description}</p></div>
    {children}
  </header>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">＋</span><h2>{title}</h2><p className="muted">{description}</p></div>;
}

export function TableShell({ caption, columns, emptyTitle, emptyDescription }: {
  caption: string; columns: readonly string[]; emptyTitle: string; emptyDescription: string;
}) {
  return <Card className="table-card">
    <div className="table-scroll" role="region" aria-label={caption} tabIndex={0}>
      <table><caption className="sr-only">{caption}</caption><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length}><EmptyState title={emptyTitle} description={emptyDescription} /></td></tr></tbody>
      </table>
    </div>
  </Card>;
}
