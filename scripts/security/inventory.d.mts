export type RouteEntry={file:string;path:string;kind:'api'|'page';methods:string[]};
export function routeInventory():RouteEntry[];
