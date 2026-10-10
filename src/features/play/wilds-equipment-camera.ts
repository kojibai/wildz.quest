type MutablePoint={x:number;y:number;z:number};
/** Reuse the orbit camera and target; only its displayed aiming pose is offset. */
export function writeWildsEquipmentCameraOffset(camera:MutablePoint,target:Readonly<MutablePoint>,look:MutablePoint,aiming:boolean,embodied:boolean){
 look.x=target.x;look.y=target.y;look.z=target.z;
 if(!aiming||embodied)return;
 const x=target.x-camera.x,z=target.z-camera.z,length=Math.hypot(x,z);
 if(length<.00001)return;
 const rightX=-z/length*.72,rightZ=x/length*.72;
 camera.x+=rightX;camera.z+=rightZ;look.x+=rightX;look.z+=rightZ;
}
