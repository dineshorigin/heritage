import {simulateMove,settleLockedSeeds} from './rules.js';
export const PROTOCOL=1,TTL=24*60*60*1000;
export function fail(code){throw new Error(code);}
export function settings(value={}){
 if(value.turnSeconds!==undefined&&value.turnSeconds!==0)fail('TIMED_PLAY_NOT_AVAILABLE');
 if(value.seeds!==undefined&&![4,5].includes(value.seeds))fail('INVALID_SEEDS');
 if(value.format!==undefined&&!['single','kasie'].includes(value.format))fail('INVALID_FORMAT');
 if(value.pasu!==undefined&&!['on','off'].includes(value.pasu))fail('INVALID_PASU');
 if(value.pace!==undefined&&!['natural','fast','relaxed'].includes(value.pace))fail('INVALID_PACE');
 return {seeds:value.seeds??5,format:value.format??'single',pasu:value.pasu??'on',pace:value.pace??'natural',turnSeconds:0};
}
export const safeName=n=>typeof n==='string'&&n.trim()?n.trim().replace(/[\u0000-\u001f\u007f]/g,'').slice(0,18):'Player';
export function resultReason(s){return s.phase==='over'||s.phase==='playback'&&s.afterPlayback==='over'?(s.draw?'repeated-position':s.banks[1]===s.banks[2]?'equal-score':'higher-score'):'';}
// Ephemeral relay protection lives in the authenticated socket attachment, not chat storage.
export function relayMessage(m,{matchId,player,now,lastAt=0,receipts=[]}){
 if(!matchId||m.matchId!==matchId||!/^[-\w]{8,80}$/.test(m.id||''))fail('STALE_MATCH');
 if(!['CHAT','REACTION'].includes(m.type))fail('INVALID_MESSAGE');
 let value;
 if(m.type==='CHAT'){if(typeof m.text!=='string'||!m.text.trim()||m.text.length>240)fail('INVALID_MESSAGE');value=m.text.replace(/[\u0000-\u001f\u007f]/g,' ').trim();if(!value)fail('INVALID_MESSAGE');}
 else {if(!['👏','😄','🎉','🤝'].includes(m.emoji))fail('INVALID_MESSAGE');value=m.emoji;}
 const old=receipts.find(r=>r.id===m.id);
 if(old)return {duplicate:true,receipts,lastAt};
 if(lastAt&&now-lastAt<700)fail('MESSAGE_TOO_FAST');
 return {duplicate:false,lastAt:now,receipts:[...receipts,{id:m.id}].slice(-24),packet:{type:m.type,id:m.id,matchId,player,[m.type==='CHAT'?'text':'emoji']:value}};
}
export function newRoom(code,name,tokenHash,now=Date.now(),config={}){
 return {protocol:PROTOCOL,code,version:0,createdAt:now,updatedAt:now,settings:settings(config),players:[null,{name:safeName(name),tokenHash,ready:false,connectionId:''},null],phase:'lobby',matchId:null,seq:0,round:0,turn:1,pits:Array(14).fill(0),banks:[0,0,0],locked:Array(14).fill(false),done:[false,false,false],used:[0,0,0],pause:null,allocations:[],receipts:[],winner:0,draw:false};
}
export function snapshot(s,presence=[false,false,false]){
 return {protocol:PROTOCOL,code:s.code,version:s.version,phase:s.phase,settings:s.settings,players:s.players.map((p,i)=>p?{name:p.name,ready:p.ready,connected:presence[i]}:null),matchId:s.matchId,seq:s.seq,round:s.round,turn:s.turn,pits:s.pits,banks:s.banks,locked:s.locked,done:s.done,pause:s.pause,used:s.used,winner:s.winner,draw:s.draw,endReason:resultReason(s),expiresAt:s.updatedAt+TTL,lastMove:s.lastMove?{seq:s.lastMove.seq,mover:s.lastMove.mover,pit:s.lastMove.pit}:null};
}
function reset(s,matchId,coin){
 s.matchId=matchId;s.seq=0;s.round=1;s.turn=coin;s.pits=Array(14).fill(s.settings.seeds);s.banks=[0,0,0];s.locked=Array(14).fill(false);s.done=[false,false,false];s.used=[0,0,0];s.pause=null;s.allocations=[];s.winner=0;s.draw=false;s.receipts=[];s.phase='turn';s.lastMove=null;s.toss={winner:coin,face:coin===1?'heads':'tails'};s.players[1].ready=s.players[2].ready=false;
}
function endRound(s){
 const legal=p=>s.pits.some((n,i)=>n>0&&!s.locked[i]&&(i<7?1:2)===p);
 if(legal(1)&&legal(2))return 'turn';
 for(let i=0;i<14;i++)if(!s.locked[i]){s.banks[i<7?1:2]+=s.pits[i];s.pits[i]=0;}
 settleLockedSeeds(s.pits,s.banks,s.locked);
 if(s.settings.format==='kasie'&&s.banks[1]>=s.settings.seeds&&s.banks[2]>=s.settings.seeds){
  const signature=s.banks.slice(1).join('|');s.allocations.push(signature);
  if(s.allocations.filter(x=>x===signature).length<3)return 'round';s.draw=true;
 }
 s.winner=s.draw||s.banks[1]===s.banks[2]?0:s.banks[1]>s.banks[2]?1:2;return 'over';
}
export function assertCount(s){if(s.phase==='lobby')return;const total=s.pits.reduce((a,n)=>a+n,0)+s.banks[1]+s.banks[2];if(total!==14*s.settings.seeds)fail('SEED_CONSERVATION');}
// Pure reducer: every accepted command is persisted before a reply or broadcast.
export function command(original,player,m,{now=Date.now(),coin=1,matchId='test-match',connected=[false,true,true]}={}){
 if(![1,2].includes(player)||!original.players[player])fail('UNAUTHORIZED');
 if(!m||typeof m!=='object'||!/^[-\w]{8,80}$/.test(m.id||''))fail('INVALID_REQUEST_ID');
 const fingerprint=JSON.stringify([m.type,m.matchId??null,m.seq??null,m.pit??null,m.ready??null,m.settings??null,m.round??null,m.name??null]);
 const old=original.receipts.find(r=>r.player===player&&r.id===m.id);
 if(old){if(old.fingerprint!==fingerprint)fail('REQUEST_ID_REUSED');return {state:original,duplicate:true,receipt:old};}
 const s=structuredClone(original);if(s.pause&&now>=s.pause.until)s.pause=null;
 if(['MOVE','DONE','NEXT_ROUND','PAUSE','RESUME','REMATCH'].includes(m.type)&&m.matchId!==s.matchId)fail('STALE_MATCH');
 let event=null;
 switch(m.type){
 case 'NAME':
  if(s.phase!=='lobby')fail('NOT_IN_LOBBY');s.players[player].name=safeName(m.name);s.players[player].ready=false;break;
 case 'READY':
  if(s.phase!=='lobby')fail('NOT_IN_LOBBY');if(typeof m.ready!=='boolean')fail('INVALID_READY');s.players[player].ready=m.ready;break;
 case 'SETTINGS':
  if(player!==1||s.phase!=='lobby')fail('HOST_LOBBY_ONLY');s.settings=settings(m.settings);for(const p of s.players)if(p)p.ready=false;break;
 case 'START':
  if(player!==1||s.phase!=='lobby'||!s.players[2]||!connected[1]||!connected[2]||!s.players[1].ready||!s.players[2].ready)fail('BOTH_PLAYERS_MUST_BE_READY');
  reset(s,matchId,coin);event={type:'TOSS',...s.toss};break;
 case 'MOVE':{
  if(s.phase!=='turn'||s.pause||!connected[1]||!connected[2])fail('MATCH_NOT_PLAYABLE');
  if(s.turn!==player)fail('NOT_YOUR_TURN');if(m.seq!==s.seq)fail('STALE_MOVE');
  const r=simulateMove(s.pits,s.banks,player,m.pit,{locked:s.locked,pasu:s.settings.pasu});
  s.lastMove={seq:s.seq+1,mover:player,pit:m.pit};s.pits=r.pits;s.banks=r.banks;s.seq++;s.turn=3-player;
  s.afterPlayback=endRound(s);s.phase='playback';s.done=[false,false,false];event={type:'MOVE_ACCEPTED',seq:s.seq,mover:player,pit:m.pit,events:r.events};break;
 }
 case 'DONE':
  if(s.phase!=='playback'||m.seq!==s.seq)fail('STALE_PLAYBACK');s.done[player]=true;
  if(s.done[1]&&s.done[2])s.phase=s.afterPlayback;break;
 case 'NEXT_ROUND':{
  if(player!==1||s.phase!=='round'||m.round!==s.round||s.pause||!connected[1]||!connected[2])fail('NEXT_ROUND_UNAVAILABLE');
  for(const p of [1,2]){const filled=Math.min(7,Math.floor(s.banks[p]/s.settings.seeds));for(let i=0;i<7;i++){const at=i+(p===1?0:7);s.locked[at]=i>=filled;s.pits[at]=i<filled?s.settings.seeds:0;}s.banks[p]-=filled*s.settings.seeds;}
  s.round++;s.turn=coin;s.phase='turn';s.lastMove=null;event={type:'TOSS',winner:coin,face:coin===1?'heads':'tails'};break;
 }
 case 'PAUSE':
  if(!['turn','playback','round'].includes(s.phase)||s.pause||s.used[player]>=2)fail('PAUSE_UNAVAILABLE');s.used[player]++;s.pause={owner:player,until:now+90000};break;
 case 'RESUME':if(!s.pause||s.pause.owner!==player)fail('NOT_YOUR_PAUSE');s.pause=null;break;
 case 'REMATCH':
  if(s.phase!=='over')fail('MATCH_NOT_OVER');s.players[player].ready=true;
  if(s.players[1].ready&&s.players[2].ready&&connected[1]&&connected[2]){reset(s,matchId,coin);event={type:'TOSS',...s.toss};}break;
 default:fail('UNSUPPORTED_COMMAND');
 }
 assertCount(s);s.updatedAt=now;s.version++;
 const receipt={player,id:m.id,fingerprint,version:s.version,seq:s.seq};s.receipts.push(receipt);s.receipts=s.receipts.slice(-64);
 return {state:s,receipt,event,duplicate:false};
}
