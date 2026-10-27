export const sections = {
  clients: { title: "Clients", description: "A central place for client profiles and their construction projects.", columns: ["Client", "Contact", "Projects"], empty: "No clients yet" },
  projects: { title: "Projects", description: "Project records will bring together contracts, financial phases and payments. Project statuses: Active, Suspended and Completed.", columns: ["Project", "Client", "Status"], empty: "No projects yet" },
  payments: { title: "Income / Payments", description: "Received payments and exact financial phase allocations in EUR. Confirmed payments issue NON-FISCAL operational receipts.", columns: ["Payment", "Project", "Date", "Amount (EUR)"], empty: "No received payments" },
  expenses: { title: "Daljet Financiare", description: "Actual outgoing payments in EUR, company-wide or optionally linked to a project, supplier and vehicle.", columns: ["Expense", "Supplier / Recipient", "Project", "Amount (EUR)"], empty: "No outgoing payments" },
  receipts: { title: "Receipts", description: "Numbered NON-FISCAL operational receipts, immutable PDF versions and cancellation history.", columns: ["Receipt", "Payment", "Date"], empty: "No receipts yet" },
  reports: { title: "Reports", description: "Company financial reports will support PDF and Excel exports later. Project financial summaries will be available on screen.", columns: ["Report", "Period", "Availability"], empty: "Reports are not available yet" },
  categories: { title: "Categories", description: "Organize outgoing payments using consistent expense categories.", columns: ["Category", "Description"], empty: "No categories yet" },
  persons: { title: "Persons / Suppliers", description: "Manage the suppliers and payment recipients associated with expenses.", columns: ["Name", "Contact", "Type"], empty: "No suppliers or recipients yet" },
  vehicles: { title: "Vehicles", description: "A place for company vehicle records and their related expenses.", columns: ["Vehicle", "Registration", "Notes"], empty: "No vehicles yet" },
  accounts: { title: "User Accounts", description: "Client users share operational access. Account creation, activation and recovery are managed by Adore through the authorized operator workflow.", columns: ["Account access", "Administration"], empty: "Contact your authorized Adore operator for account changes" },
} as const;

export type SectionKey = keyof typeof sections;
export function isSection(value: string): value is SectionKey { return Object.hasOwn(sections, value); }
export const workspaceNavigation = [
  { href: "/app", label: "Dashboard" },
  ...Object.entries(sections).map(([key, value]) => ({ href: `/app/${key}`, label: value.title })),
];
