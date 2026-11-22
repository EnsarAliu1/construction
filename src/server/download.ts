/** Input bytes have already passed authorization and integrity checks. Never stream an unverified Blob directly. */
export function privateDownload(bytes:Uint8Array,headers:HeadersInit){
 const result=new Headers(headers);
 if(process.env.VERCEL!=='1')return new Response(new Uint8Array(bytes),{headers:result});
 // Vercel streaming responses preserve the existing 8 MiB PDF / bounded export functionality.
 result.delete('Content-Length');
 let offset=0,body:Uint8Array|undefined=bytes;
 const stream=new ReadableStream<Uint8Array>({
  pull(controller){if(!body||offset>=body.byteLength){body=undefined;controller.close();return;}const end=Math.min(offset+64*1024,body.byteLength);controller.enqueue(new Uint8Array(body.subarray(offset,end)));offset=end;},
  cancel(){body=undefined;},
 });
 return new Response(stream,{headers:result});
}
