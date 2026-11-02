// Friendly-room session rules. Host owns pause allowance; wire messages are scoped by caller.
export const PAUSE_LIMIT=2,PAUSE_MILLISECONDS=90000;
export function createPauseBudget(){
 let used=[0,0,0],active=null,revision=0;const requests=new Map();
 const expire=now=>{if(active&&now>=active.until){active=null;revision++;return true;}return false;};
 const snapshot=now=>{expire(now);return {revision,used:used.slice(),owner:active?.player||0,remaining:active?Math.max(0,active.until-now):0,id:active?.id||''};};
 return {
  request(player,id,now){expire(now);if(![1,2].includes(player)||typeof id!=='string'||!id||id.length>100)return {accepted:false,state:snapshot(now)};
   if(requests.has(id))return {accepted:Boolean(requests.get(id)&&active?.id===id&&active.player===player),state:snapshot(now)};
   let accepted=Boolean(active?.player===player);
   if(!active&&used[player]<PAUSE_LIMIT){used[player]++;active={player,id,until:now+PAUSE_MILLISECONDS};revision++;accepted=true;}
   requests.set(id,accepted);if(requests.size>32)requests.delete(requests.keys().next().value);return {accepted,state:snapshot(now)};
  },
  resume(player,now){expire(now);if(!active||active.player!==player)return false;active=null;revision++;return true;},
  expire,snapshot,
  restore(data,now){if(!validPauseState(data))return false;used=data.used.slice();revision=data.revision;active=data.owner&&data.remaining>0?{player:data.owner,id:data.id,until:now+Math.min(PAUSE_MILLISECONDS,data.remaining)}:null;requests.clear();return true;},
  reset(){used=[0,0,0];active=null;revision=0;requests.clear();}
 };
}
export function validPauseState(s){return Boolean(s&&Number.isInteger(s.revision)&&s.revision>=0&&s.revision<=100000&&Array.isArray(s.used)&&s.used.length===3&&s.used[0]===0&&s.used.every(n=>Number.isInteger(n)&&n>=0&&n<=PAUSE_LIMIT)&&[0,1,2].includes(s.owner)&&Number.isFinite(s.remaining)&&s.remaining>=0&&s.remaining<=PAUSE_MILLISECONDS&&typeof s.id==='string'&&s.id.length<=100&&(!s.owner?s.remaining===0&&s.id==='':s.used[s.owner]>0&&s.id.length>0));}
export function coinOutcome(winner,call='heads'){
 if(![1,2].includes(winner))throw new RangeError('Invalid toss winner');
 call=call==='tails'?'tails':'heads';return {winner,face:winner===1?call:call==='heads'?'tails':'heads'};
}
