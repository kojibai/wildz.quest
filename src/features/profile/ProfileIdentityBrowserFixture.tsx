"use client";
import {useEffect,useState} from "react";
import {WildzProfileSheet} from "./WildzProfileSheet";
import {createOwnerPublicWildzProfile} from "./public-profile";
import {readWildzProfileDisplayName,saveWildzProfileDisplayName} from "./profile-display-name";
const key="synthetic-profile-name-check";
const avatar="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4N8AAAAASUVORK5CYII=";
export function ProfileIdentityBrowserFixture(){
 const [open,setOpen]=useState(true),[name,setName]=useState("Wildz Explorer");
 useEffect(()=>{setName(readWildzProfileDisplayName(localStorage,key)??"Wildz Explorer");},[]);
 const profile=createOwnerPublicWildzProfile({username:"synthetic_keeper",displayName:name,avatarImageUrl:avatar,assets:[]});
 return <main style={{padding:20,maxWidth:640,margin:"auto",color:"white",background:"#102b25"}}>
  <h1>Profile identity fixture</h1><p>Synthetic display data; no identity claim, uploads or account changes.</p>
  <button type="button" onClick={()=>setOpen(value=>!value)}>{open?"Close profile":"Open profile"}</button>
  <p role="status">Saved name: {name}; username: synthetic_keeper; image unchanged.</p>
  {open?<WildzProfileSheet profile={profile} editable shareEnabled={false} signingAvailable={false} onSaveProfile={async input=>{
   if(input.username!=="synthetic_keeper"||input.avatarImageUrl!==avatar)throw Error("fixture_coordinate_changed");
   setName(saveWildzProfileDisplayName(localStorage,key,input.displayName));
  }}/>:null}
 </main>;
}
