import assert from "node:assert/strict";
import {test} from "node:test";
import {readWildzProfileDisplayName,saveWildzProfileDisplayName} from "../src/features/profile/profile-display-name";
test("saved profile names survive panel remounts and stay scoped to the same identity",()=>{
 const records=new Map<string,string>();const storage={getItem:(key:string)=>records.get(key)??null,setItem:(key:string,value:string)=>{records.set(key,value);}};
 assert.equal(readWildzProfileDisplayName(storage,"key-a"),null);
 assert.equal(saveWildzProfileDisplayName(storage,"key-a","  Forest Keeper  "),"Forest Keeper");
 assert.equal(readWildzProfileDisplayName(storage,"key-a"),"Forest Keeper");
 assert.equal(readWildzProfileDisplayName(storage,"key-b"),null);
 assert.equal(records.size,1);
 assert.equal([...records.keys()][0],"wildz:profile-display-name:key-a");
 assert.equal(saveWildzProfileDisplayName(storage,"key-a","New Name"),"New Name");
 assert.equal(readWildzProfileDisplayName(storage,"key-a"),"New Name");
});
test("a failed name write never reports a saved profile and reading denied storage is harmless",()=>{
 const broken={getItem:()=>{throw Error("denied");},setItem:()=>{throw Error("quota");}};
 assert.equal(readWildzProfileDisplayName(broken,"key-a"),null);
 assert.throws(()=>saveWildzProfileDisplayName(broken,"key-a","Keeper"),/profile_name_save_failed/);
 const storage={getItem:()=>"old",setItem:()=>{}};
 assert.throws(()=>saveWildzProfileDisplayName(storage,"key-a","Keeper"),/profile_name_save_failed/);
});
