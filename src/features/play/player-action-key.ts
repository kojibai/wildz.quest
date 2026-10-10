type KeyTarget = {tagName?:string;isContentEditable?:boolean}|null;
/** Gameplay shortcuts never steal input or repeat while a key is held. */
export function wildsPlayerActionKey(input:{code:string;repeat:boolean;altKey:boolean;ctrlKey:boolean;metaKey:boolean;shiftKey:boolean},target:KeyTarget){
 if(input.repeat||input.altKey||input.ctrlKey||input.metaKey||target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/i.test(target?.tagName??""))return null;
 if(input.code==="Space")return {kind:"jump" as const};
 if(input.code==="KeyQ"||input.code==="KeyE")return {kind:"hand" as const,hand:input.code==="KeyQ"?"left" as const:"right" as const,intent:input.shiftKey?"grab" as const:"strike" as const};
 return null;
}
