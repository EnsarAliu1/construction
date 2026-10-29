import { DashboardScreen } from "@/features/dashboard/dashboard-screen";
import { requirePageUser } from "@/server/auth/web";

export const metadata = { title: "Përmbledhja" };
export default async function DashboardPage() { await requirePageUser(); return <DashboardScreen />; }
