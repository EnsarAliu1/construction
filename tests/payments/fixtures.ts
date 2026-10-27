import {randomUUID} from "node:crypto";
import {projectFixture} from "../projects/fixtures";
import type {ProjectDetail} from "../../src/features/projects/service";
export {mysqlSkip} from "../clients/fixture";
export async function paymentFixture(){
  const f=await projectFixture();
  const paymentInput=(d:ProjectDetail,extra:Record<string,unknown>={})=>({projectId:d.project.id,projectVersion:d.project.version,contractId:d.contract!.id,contractVersion:d.contract!.version,amount:"10.00",transactionDate:"2024-02-29",method:"cash",allocations:[{phaseId:d.phases[0].id,phaseVersion:d.phases[0].version,amount:"10.00"}],...extra});
  return {...f,paymentInput,confirmation:(d:ProjectDetail,extra:Record<string,unknown>={})=>({idempotencyKey:randomUUID(),payment:paymentInput(d,extra)})};
}
