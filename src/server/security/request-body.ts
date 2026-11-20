const invalidBody=()=>new Error('Kërkesë JSON e pavlefshme ose jashtë kufirit të lejuar.');

/** Bound actual bytes and total read time, including chunked bodies without Content-Length. */
export async function readJsonObject(request:Request,maxBytes=8192,deadlineMs=15_000):Promise<Record<string,unknown>>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!Number.isSafeInteger(deadlineMs)||deadlineMs<1)throw invalidBody();
 const type=request.headers.get('content-type')??'',declared=request.headers.get('content-length');
 if(!/^application\/json(?:\s*;[^\r\n]*)?$/i.test(type.trim())||declared!==null&&(!/^\d+$/.test(declared)||!Number.isSafeInteger(Number(declared))||Number(declared)>maxBytes)){
  void request.body?.cancel().catch(()=>{});throw invalidBody();
 }
 const reader=request.body?.getReader();if(!reader)throw invalidBody();
 const chunks:Uint8Array[]=[];let length=0,timer:ReturnType<typeof setTimeout>|undefined;
 const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(invalidBody()),deadlineMs);});
 try{
  while(true){
   const {done,value}=await Promise.race([reader.read(),deadline]);if(done)break;
   length+=value.length;if(length>maxBytes)throw invalidBody();chunks.push(value);
  }
  const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks,length));
  const parsed:unknown=JSON.parse(text);
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw invalidBody();
  return parsed as Record<string,unknown>;
 }catch{
  void reader.cancel().catch(()=>{});throw invalidBody();
 }finally{
  clearTimeout(timer);reader.releaseLock();
 }
}
