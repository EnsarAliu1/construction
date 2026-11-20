import type {Connection} from 'mysql2/promise';
import {demoMode} from './policy';

// Connection provenance is server-owned; neither cookies nor query parameters can tag it.
const connections=new WeakSet<Connection>();
export function markDemoConnection(connection:Connection){if(!demoMode())throw new Error('Demo process required');connections.add(connection);}
export function isDemoConnection(connection:Connection){return demoMode()&&connections.has(connection);}
