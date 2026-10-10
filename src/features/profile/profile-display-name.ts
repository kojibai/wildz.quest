type ProfileNameStorage = Pick<Storage,"getItem"|"setItem">;
const nameKey=(keyId:string)=>`wildz:profile-display-name:${keyId}`;
const clean=(value:string)=>value.trim().replace(/[\u0000-\u001f\u007f]/g,"").slice(0,80);
/** A display label, separate from the canonical identity and username. */
export function readWildzProfileDisplayName(storage:ProfileNameStorage,keyId:string):string|null {
 try {const value=storage.getItem(nameKey(keyId));return value&&value.length<=80?clean(value)||null:null;}catch{return null;}
}
export function saveWildzProfileDisplayName(storage:ProfileNameStorage,keyId:string,value:string):string {
 const name=clean(value)||"Wildz Explorer";
 try {storage.setItem(nameKey(keyId),name);if(storage.getItem(nameKey(keyId))!==name)throw Error("readback");}catch{throw Error("wildz_profile_name_save_failed");}
 return name;
}
