import { randomUUID } from "node:crypto";
import { clientFixture } from "../clients/fixture";
import type { ReferenceKind } from "../../src/features/references/model";
export { mysqlSkip } from "../clients/fixture";
export async function referenceFixture() {
  const f=await clientFixture();
  const input=(kind:ReferenceKind,label=`${f.prefix}-${kind}-${randomUUID().slice(0,8)}`):Record<string,string>=>kind==="categories"?{name:label}:kind==="persons"?{name:label,email:"synthetic@example.invalid",phone:"+000 synthetic",identificationReference:"optional synthetic ID",address:"Synthetic address"}:{identifier:label,description:"Synthetic vehicle description"};
  return{...f,referenceInput:input};
}
