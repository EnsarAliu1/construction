import { randomUUID } from "node:crypto";
import { projectFixture } from "../projects/fixtures";
import { createReference } from "../../src/features/references/service";
export {mysqlSkip} from "../clients/fixture";
export async function expenseFixture(){
  const f=await projectFixture(),category=await createReference(f.connection,f.token,"categories",{name:`${f.prefix}-expense-${randomUUID().slice(0,8)}`});
  const selection=(row:{id:string;version:number})=>({id:row.id,version:row.version});
  const expenseInput=(extra:Record<string,unknown>={})=>({amount:"123.45",transactionDate:"2024-02-29",description:`${f.prefix}-outgoing-${randomUUID().slice(0,8)}`,category:selection(category),project:null,person:null,vehicle:null,...extra});
  return {...f,category,selection,expenseInput};
}
