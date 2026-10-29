import { createClient } from "../../src/features/clients/service";
import { createProject, getProject, type ProjectDetail } from "../../src/features/projects/service";
import { clientFixture } from "../clients/fixture";
export { mysqlSkip } from "../clients/fixture";
export async function projectFixture() {
  const f = await clientFixture();
  const client = await createClient(f.connection, f.token, f.input({ name: `${f.prefix} Project client` }));
  const projectInput = (extra: Record<string, unknown> = {}) => ({ name: `${f.prefix} Projekti`, clientId: client.id, clientVersion: client.version, status: "active", location: "Synthetic site", startDate: "2026-01-01", endDate: "2026-12-31", ...extra });
  const initial = (extra: Record<string, unknown> = {}) => ({ project: projectInput(extra), contract: { totalValue: "100.00", phases: [{ name: "Synthetic first", value: "60.00", sortOrder: 0 }, { name: "Synthetic second", value: "40.00", sortOrder: 1 }] } });
  return { ...f, client, projectInput, initial, async fresh(extra: Record<string, unknown> = {}) { const saved = await createProject(f.connection, f.token, initial(extra)); return getProject(f.connection, f.token, saved.id); } };
}
export function plan(detail: ProjectDetail) { return { contractId: detail.contract?.id ?? null, version: detail.contract?.version ?? null, projectVersion: detail.project.version, totalValue: detail.contract?.totalValue ?? "0.00", phases: detail.phases.map(phase => ({ id: phase.id, version: phase.version, name: phase.name, description: phase.description, value: phase.value, sortOrder: phase.sortOrder })), deletedPhases: [] as { id: string; version: number }[] }; }
