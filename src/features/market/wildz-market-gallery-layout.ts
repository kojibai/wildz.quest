/** Build complete visual rows before virtualization. A full-width resource
 * waits until the current creature pair is complete, just as dense grid
 * placement does, so a loading boundary never leaves a half-empty pair. */
export function wildzMarketGalleryRows<T>(entries:readonly T[],columns:1|2|3,isFullWidth:(entry:T)=>boolean=()=>false):readonly (readonly T[])[]{
 const rows:T[][]=[];let row:T[]=[],waiting:T[]=[];
 const flushWaiting=()=>{for(const entry of waiting)rows.push([entry]);waiting=[];};
 for(const entry of entries){
  if(columns>1&&isFullWidth(entry)){
   if(row.length)waiting.push(entry);else rows.push([entry]);
  }else{
   row.push(entry);
   if(row.length===columns){rows.push(row);row=[];flushWaiting();}
  }
 }
 if(row.length)rows.push(row);flushWaiting();
 return rows;
}
