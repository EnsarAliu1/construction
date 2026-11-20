/** Probe only the operator-configured origin; never forward cookies or follow redirects. */
export async function probeDemo(destination:string){
 try{
  const response=await fetch(new URL('/api/demo/ready',destination),{cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(1500)});
  if(!response.ok)return false;
  if(!response.body)return false;
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{
   while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();return false;}chunks.push(value);}
  }finally{reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));return data?.ready===true&&data?.service==='construction-demo-v1';
 }catch{return false;}
}
