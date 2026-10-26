import Link from "next/link";
import { Badge, Card, EmptyState, PageHeading } from "@/components/ui";

export function DashboardScreen() {
  return <>
    <PageHeading eyebrow="Overview" title="Dashboard" description="A clear view of your construction operations, in one place."><Badge>Interface preview</Badge></PageHeading>
    <Card className="dashboard-intro"><div><p className="eyebrow">Your workspace</p><h2>Ready for the first project.</h2><p className="muted">Explore the workspace below. Record creation and financial actions will be enabled in later work packages.</p></div><span className="plan-mark" aria-hidden="true">⌑</span></Card>
    <div className="section-title"><h2>Workspace sections</h2><span className="muted text-sm">No business data connected</span></div>
    <div className="dashboard-grid">{[
      { href: "/app/projects", number: "01", title: "Projects", description: "Clients, contracts and financial phases." },
      { href: "/app/payments", number: "02", title: "Received payments", description: "Income and future payment allocations in EUR." },
      { href: "/app/expenses", number: "03", title: "Outgoing payments", description: "Expenses, suppliers and payment recipients." },
    ].map(item => <Link className="card workspace-card" key={item.href} href={item.href}><span className="eyebrow">{item.number} <span aria-hidden="true">↗</span></span><h3>{item.title}</h3><p className="muted">{item.description}</p></Link>)}</div>
    <Card><EmptyState title="Your financial overview will appear here" description="Company financial summaries will be available in a later package." /></Card>
  </>;
}
