export const PLAYBACK_PROTOCOL=1;
export const validRoomPace=p=>['natural','relaxed','fast'].includes(p)?p:'natural';
export function moveKey(c){return [c.matchId,c.round,c.seq,c.rev,c.mover].join('|');}
export function boardDigest(pits,banks){return pits.join(',')+';'+banks.join(',');}
export function createPlaybackBarrier(){
 let active=null;const early=new Map(),recent=new Map();
 const view=()=>!active?{status:'idle'}:{...active,context:{...active.context},status:active.peerDigest&&active.peerDigest!==active.digest?'mismatch':active.localDone&&active.peerDigest===active.digest?'ready':active.localDone?'waiting':'animating'};
 return {
  begin(context,digest){const key=moveKey(context);active={key,context:{...context},digest,localDone:false,peerDigest:early.get(key)||null};early.delete(key);return view();},
  receive(context,digest){if(typeof digest!=='string'||!digest||digest.length>1000)return {status:'invalid'};const key=moveKey(context);if(active?.key===key){active.peerDigest=digest;return view();}if(early.size>=8)early.delete(early.keys().next().value);early.set(key,digest);return {status:'queued'};},
  finish(context){if(active?.key!==moveKey(context))return {status:'stale'};active.localDone=true;return view();},
  inspect:view,lookup(context){const key=moveKey(context);return active?.key===key&&active.localDone?{context:{...active.context},digest:active.digest}:recent.get(key)||null;},clear(){if(active?.localDone){if(recent.size>=8)recent.delete(recent.keys().next().value);recent.set(active.key,{context:{...active.context},digest:active.digest});}active=null;},reset(){active=null;early.clear();recent.clear();}
 };
}
