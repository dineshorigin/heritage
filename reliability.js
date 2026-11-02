// Lightweight effects and connection status helpers.
export function lightweight(mode='auto',device={}){return mode==='light'||mode==='auto'&&((device.deviceMemory>0&&device.deviceMemory<=4)||(device.hardwareConcurrency>0&&device.hardwareConcurrency<=4));}
export function connectionView({connected,awaitingSync,awaitingPlayback,stale,offline}){
 if(offline)return {state:'offline',label:'You are offline. Moves are paused.'};
 if(!connected||stale)return {state:'reconnecting',label:'Opponent reconnecting. Moves are paused.'};
 if(awaitingSync)return {state:'synchronizing',label:'Synchronizing boards…'};
 if(awaitingPlayback)return {state:'sowing',label:'Waiting for the other phone to finish sowing…'};
 return {state:'connected',label:'Connected'};
}

export function recoveryNotice(before,after){return before.matchId===after.matchId&&(after.round<before.round||after.moves<before.moves)?'The host restored an earlier checkpoint. Some recent moves were rolled back. Check both boards before continuing.':'';}
export function pitDescription({name,cup,count,locked,playable,ta=false}){return ta?`${name}, குழி ${cup}, ${count} விதைகள்${locked?', காசியாகப் பூட்டப்பட்டுள்ளது':''}${playable?', விளையாடத் தொடவும்':''}`:`${name}, cup ${cup}, ${count} seeds${locked?', locked as Kasie':''}${playable?', tap to play':''}`;}
export function installDialogAccess(){
 let current=null,previous=null;
 const visible=el=>!!el&&el.isConnected&&!el.closest('[hidden],.hidden')&&el.getClientRects().length>0;
 const controls=d=>Array.from(d.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')).filter(visible);
 const sync=()=>{const dialogs=Array.from(document.querySelectorAll('.overlay[role="dialog"]')).filter(visible);const top=dialogs.at(-1)||null;if(top===current)return;const old=current;current=top;if(top){previous=old?previous:document.activeElement;if(!top.contains(document.activeElement)){top.tabIndex=-1;top.focus({preventScroll:true});}}else if(visible(previous)&&!previous.disabled){previous.focus({preventScroll:true});previous=null;}};
 document.addEventListener('keydown',e=>{if(e.key!=='Tab')return;sync();if(!current)return;const list=controls(current);if(!list.length){e.preventDefault();current.focus();return;}const first=list[0],last=list.at(-1);if(e.shiftKey&&(document.activeElement===first||!list.includes(document.activeElement))){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||!list.includes(document.activeElement))){e.preventDefault();first.focus();}});
 new MutationObserver(records=>{if(records.some(r=>r.target.classList?.contains('overlay')))sync();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden']});sync();
}
