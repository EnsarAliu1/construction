import assert from "node:assert/strict";
import test from "node:test";
import { referenceKinds } from "../../src/features/references/model";
import { parseReference, parseReferenceQuery, referenceId, referenceVersion, ReferenceError } from "../../src/features/references/validation";
test("reference normalization preserves optional contacts/identification and requires only existing model fields", () => {
  assert.equal(parseReference("categories",{name:"  Synthetic   Category "}).name,"Synthetic Category");
  const person=parseReference("persons",{name:"Synthetic person",email:" EXAMPLE@EXAMPLE.INVALID ",phone:"+000 arbitrary",identificationReference:""});assert.equal(person.email,"example@example.invalid");assert.equal(person.identificationReference,null);assert.equal(person.address,null);
  assert.equal(parseReference("vehicles",{identifier:"arbitrary identifier"}).description,null);
  for(const kind of referenceKinds)assert.throws(()=>parseReference(kind,{}),ReferenceError);
});
test("schema bounds, unsupported types, email and control characters receive field errors",()=>{
  for(const [kind,value]of [["categories",{name:"x".repeat(151)}],["persons",{name:"Synthetic",email:"bad"}],["persons",{name:"Synthetic",identificationReference:"x".repeat(151)}],["persons",{name:"Synthetic",phone:12}],["vehicles",{identifier:"x".repeat(101)}],["vehicles",{identifier:"Synthetic",description:"😀".repeat(17000)}],["categories",{name:"line\nbreak"}],["persons",{name:"bad\u0000name"}]]as const)assert.throws(()=>parseReference(kind,value),error=>error instanceof ReferenceError&&Object.keys(error.fields).length>0);
  assert.throws(()=>parseReference("persons",{name:"bad\u0085name"}),ReferenceError);
});
test("all protected fields and cross-module fields are rejected instead of mass assigned",()=>{
  for(const kind of referenceKinds)for(const field of ["id","version","isActive","createdAt","createdBy","updatedBy","deactivatedAt","deactivatedBy","actorId","password","token"]){const valid=kind==="vehicles"?{identifier:"Synthetic"}:{name:"Synthetic"};assert.throws(()=>parseReference(kind,{...valid,[field]:"untrusted"}),ReferenceError);}
  assert.throws(()=>parseReference("categories",{name:"Synthetic",email:"example@example.invalid"}));for(const value of [null,[],1])assert.throws(()=>parseReference("persons",value));
});
test("IDs, optimistic versions and bounded queries fail closed on malformed input",()=>{
  for(const value of ["invalid","../accounts",null])assert.throws(()=>referenceId(value));
  for(const value of [0,-1,"1",1.2,4294967295])assert.throws(()=>referenceVersion(value));assert.equal(referenceVersion(2),2);
  assert.deepEqual(parseReferenceQuery({}),{q:"",status:"active",page:1});
  for(const query of [{q:"x".repeat(101)},{q:[]},{status:"deleted"},{page:"10001"},{page:[]},{unknown:true}])assert.throws(()=>parseReferenceQuery(query));
  assert.throws(()=>parseReferenceQuery({q:"bad\u0085search"}),ReferenceError);
});
