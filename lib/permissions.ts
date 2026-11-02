export const PERMISSIONS=["DECLARE","SEARCH","VIEW_STOLEN","VIEW_FOUND","UPDATE_STATUS","SUPERVISE"] as const;
export type Permission=typeof PERMISSIONS[number];
export type PermissionSession={role:string;permissions?:string[]}|null;
export const DEFAULT_PERMISSIONS:Record<string,Permission[]>={COMMISSARIAT_AGENT:["DECLARE","SEARCH","VIEW_STOLEN","VIEW_FOUND","UPDATE_STATUS"],GSR_AGENT:["SEARCH"],COMMISSARIAT_SUPERVISOR:["VIEW_STOLEN","VIEW_FOUND","SUPERVISE"],ADMIN:[],SUPER_ADMIN:[...PERMISSIONS]};
export function effectivePermissions(session:PermissionSession){if(!session)return[];return session.role==="SUPER_ADMIN"?[...PERMISSIONS]:(session.permissions??DEFAULT_PERMISSIONS[session.role]??[])}
export function hasPermission(session:PermissionSession,permission:Permission){return effectivePermissions(session).includes(permission)}
export function canViewStatistics(session:PermissionSession){return Boolean(session&&(session.role==="SUPER_ADMIN"||hasPermission(session,"DECLARE")||hasPermission(session,"SUPERVISE")))}
export function landingPageForSession(session:PermissionSession){if(!session)return"/login";if(["ADMIN","SUPER_ADMIN"].includes(session.role))return"/admin";if(hasPermission(session,"SUPERVISE"))return"/supervision";if(hasPermission(session,"DECLARE"))return"/dashboard";if(hasPermission(session,"SEARCH"))return"/verification";if(hasPermission(session,"VIEW_STOLEN"))return"/objets/voles";if(hasPermission(session,"VIEW_FOUND"))return"/objets/retrouves";return"/acces-refuse"}
