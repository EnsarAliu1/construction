import 'server-only';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import {requireSessionUser} from '@/server/auth/sessions';
import {safeHistorySnapshot,type HistorySnapshot} from '@/server/db/history-snapshot';
import {parseHistoryQuery} from './history-query';

export async function listActivity(connection:Connection,token:string|undefined,params:Record<string,unknown>){
 await requireSessionUser(connection,token);
 const query=parseHistoryQuery(params),conditions:string[]=[],values:string[]=[];
 if(query.type!=='all'){conditions.push('a.entity_type=?');values.push(query.type);}
 if(query.entityId){conditions.push('a.entity_id=?');values.push(query.entityId);}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const [counts]=await connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM audit_events a'+where,values);
 const [rows]=await connection.execute<RowDataPacket[]>('SELECT a.id,a.entity_type,a.entity_id,a.action,a.recorded_at,a.before_snapshot,a.after_snapshot,u.display_name AS actor_name FROM audit_events a LEFT JOIN users u ON u.id=a.actor_id'+where+' ORDER BY a.recorded_at DESC,a.id DESC LIMIT 40 OFFSET '+((query.page-1)*40),values);
 // Revalidate stored snapshots before exposing them to the private page.
 const snapshot=(value:unknown):HistorySnapshot|null=>value===null?null:safeHistorySnapshot(typeof value==='string'?JSON.parse(value):value as HistorySnapshot);
 return {query,total:Number(counts[0].total),rows:rows.map(row=>({id:String(row.id),type:String(row.entity_type),entityId:String(row.entity_id),action:String(row.action),recordedAt:String(row.recorded_at),actor:row.actor_name?String(row.actor_name):'Operatori / sistemi',before:snapshot(row.before_snapshot),after:snapshot(row.after_snapshot)}))};
}
