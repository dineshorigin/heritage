import {entryFee,walletApi,roomWallet,chargeMatch,rewardMatch} from './coins.js';
import {DurableObject} from 'cloudflare:workers';
import {newRoom,command,snapshot,TTL,PROTOCOL,safeName,relayMessage} from './room.js';
const json=(body,status=200,headers={})=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...headers}});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(n=>n.toString(16).padStart(2,'0')).join('');
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const codePattern=/^[A-Z2-9]{8}$/;
function originAllowed(request,env){const origin=request.headers.get('Origin');return origin&&(origin===new URL(request.url).origin||(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).includes(origin));}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/health')return json({ok:true,protocol:PROTOCOL,release:'3.27.0',stage:'backend-test'});
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(!originAllowed(request,env))return json({error:'ORIGIN_NOT_ALLOWED'},403);
  const cors={'Access-Control-Allow-Origin':request.headers.get('Origin'),'Vary':'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
  if(Number(request.headers.get('Content-Length')||0)>2048)return json({error:'REQUEST_TOO_LARGE'},413,cors);
  try{
   if(url.pathname==='/api/coins/config'&&request.method==='GET')return json({enabled:Boolean(env.COINS),entryFee:entryFee(env)},200,cors);
   if(url.pathname==='/api/coins'&&request.method==='POST')return json(await walletApi(env,await readBody(request)),200,cors);
   if(url.pathname==='/api/rooms'&&request.method==='POST'){
    if(env.CREATION_ENABLED!=='true')return json({error:'ROOM_CREATION_DISABLED'},503,cors);
    const body=await readBody(request);const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
    const response=await env.ROOMS.getByName(code).fetch(new Request('https://room/create',{method:'POST',body:JSON.stringify({...body,code})}));return withCors(response,cors);
   }
   const route=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{8})\/(join|socket|coin-fee)$/);
   if(!route)return json({error:'NOT_FOUND'},404,cors);
   const [,code,action]=route;
   if(action==='coin-fee'&&request.method==='GET')return withCors(await env.ROOMS.getByName(code).fetch(new Request('https://room/coin-fee')),cors);
   if(action==='join'&&request.method==='POST'){const body=await readBody(request);return withCors(await env.ROOMS.getByName(code).fetch(new Request('https://room/join',{method:'POST',body:JSON.stringify(body)})),cors);}
   if(action==='socket'&&request.method==='GET'&&request.headers.get('Upgrade')?.toLowerCase()==='websocket')return env.ROOMS.getByName(code).fetch(new Request('https://room/socket',request));
   return json({error:'METHOD_NOT_ALLOWED'},405,cors);
  }catch(error){return json({error:safeError(error)},400,cors);}
 }
};
async function readBody(request){const text=await request.text();if(text.length>2048)throw Error('LARGE');const body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('BODY');return body;}
function withCors(response,cors){const headers=new Headers(response.headers);for(const [k,v] of Object.entries(cors))headers.set(k,v);return new Response(response.body,{status:response.status,headers});}
export class GameRoom extends DurableObject {
 constructor(ctx,env){super(ctx,env);this.room=null;this.chain=Promise.resolve();ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('room')||null;});ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 run(fn){const task=this.chain.then(fn);this.chain=task.catch(()=>{});return task;}
 presence(){const result=[false,false,false];for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.player&&ws.readyState===1&&this.room?.players[a.player]?.connectionId===a.id)result[a.player]=true;}return result;}
 view(){return snapshot(this.room,this.presence());}
 send(ws,value){try{ws.send(JSON.stringify(value));}catch{}}
 broadcast(event=null){const value={type:'STATE',state:this.view(),event};for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a?.player&&this.room.players[a.player]?.connectionId===a.id)this.send(ws,value);}}
 async persist(next){await this.ctx.storage.put('room',next);this.room=next;await this.schedule();}
 async settleCoins(){
  if(this.room?.phase!=='over'||this.room.coinsSettled||!this.env.COINS)return true;
  try{
   await rewardMatch(this.env,this.room);
   await this.persist({...this.room,coinsSettled:true});
   return true;
  }catch{
   await this.schedule();
   return false;
  }
 }
 async schedule(){if(!this.room)return;let deadline=Math.min(this.room.updatedAt+TTL,this.room.pause?.until??Infinity);if(this.env.COINS&&this.room.phase==='over'&&!this.room.coinsSettled)deadline=Math.min(deadline,Date.now()+60000);for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a&&!a.player&&ws.readyState===1)deadline=Math.min(deadline,a.createdAt+10000);}await this.ctx.storage.setAlarm(deadline);}
 async fetch(request){return this.run(async()=>{
  const path=new URL(request.url).pathname;
  if(path==='/create'){
   if(this.room)return json({error:'CODE_COLLISION_RETRY'},409);
   const body=await readBody(request),secret=token();if(!codePattern.test(body.code))return json({error:'INVALID_CODE'},400);
   let next;try{next=newRoom(body.code,body.name,await hash(secret),Date.now(),body.settings);}catch(e){return json({error:e.message},400);}
   next.entryFee=body.paidRoom===true?entryFee(this.env):0;
   next.players[1].coinWallet=await roomWallet(this.env,body,next.entryFee);
   await this.persist(next);return json({code:next.code,player:1,token:secret,state:this.view()},201);
  }
  if(!this.room||Date.now()-this.room.updatedAt>=TTL)return json({error:'ROOM_EXPIRED_OR_NOT_FOUND'},404);
  if(path==='/coin-fee')return json({entryFee:entryFee(this.env)?this.room.entryFee||0:0});
  if(path==='/join'){
   if(this.room.phase!=='lobby'||this.room.players[2])return json({error:'ROOM_FULL_OR_STARTED'},409);
   const body=await readBody(request),secret=token(),next=structuredClone(this.room);next.players[2]={name:safeName(body.name),tokenHash:await hash(secret),ready:false,connectionId:'',coinWallet:await roomWallet(this.env,body,entryFee(this.env)?this.room.entryFee||0:0)};next.version++;next.updatedAt=Date.now();await this.persist(next);this.broadcast();return json({code:next.code,player:2,token:secret,state:this.view()},201);
  }
  if(path==='/socket'){
   if(this.ctx.getWebSockets().length>=6)return json({error:'TOO_MANY_CONNECTIONS'},429);
   const pair=new WebSocketPair(),[client,server]=Object.values(pair);this.ctx.acceptWebSocket(server);server.serializeAttachment({id:crypto.randomUUID(),player:0,createdAt:Date.now(),window:Date.now(),count:0});await this.schedule();return new Response(null,{status:101,webSocket:client});
  }
  return json({error:'NOT_FOUND'},404);
 });}
 async webSocketMessage(ws,message){return this.run(async()=>{
  try{
   if(!this.room||Date.now()-this.room.updatedAt>=TTL){ws.close(4004,'Room expired');return;}
   const a=ws.deserializeAttachment();if(!a)return;
   if(typeof message!=='string'||message.length>4096){ws.close(1009,'Message too large');return;}
   const now=Date.now();if(now-a.window>10000){a.window=now;a.count=0;}if(++a.count>40){ws.close(4008,'Rate limited');return;}ws.serializeAttachment(a);
   const m=JSON.parse(message);if(!m||typeof m!=='object'||Array.isArray(m))throw Error('INVALID_COMMAND');
   if(!a.player){
    if(now-a.createdAt>10000||m?.type!=='AUTH'||m.protocol!==PROTOCOL||typeof m.token!=='string'||m.token.length>200){ws.close(4003,'Authenticate first');return;}
    const digest=await hash(m.token),p=[1,2].find(i=>this.room.players[i]?.tokenHash===digest);if(!p){ws.close(4003,'Invalid token');return;}
    const next=structuredClone(this.room);next.players[p].connectionId=a.id;next.updatedAt=now;await this.persist(next);a.player=p;ws.serializeAttachment(a);
    for(const old of this.ctx.getWebSockets()){if(old===ws)continue;const other=old.deserializeAttachment();if(other?.player===p)old.close(4001,'Replaced by reconnection');}
    this.send(ws,{type:'WELCOME',player:p,state:this.view()});this.broadcast();return;
   }
   if(this.room.players[a.player]?.connectionId!==a.id){ws.close(4001,'Replaced');return;}
   if(this.room.phase==='over'&&!await this.settleCoins()&&m.type==='REMATCH')throw Error('COIN_SETTLEMENT_PENDING');
   if(m?.type==='SYNC'){this.send(ws,{type:'STATE',state:this.view()});return;}
   // Room chat is ephemeral: authenticated sender and current match, never client-supplied identity.
   if(m?.type==='CHAT'||m?.type==='REACTION'){
    const result=relayMessage(m,{matchId:this.room.matchId,player:a.player,now,lastAt:a.relayAt,receipts:a.relayReceipts});
    a.relayAt=result.lastAt;a.relayReceipts=result.receipts;ws.serializeAttachment(a);
    if(!result.duplicate)for(const other of this.ctx.getWebSockets()){const b=other.deserializeAttachment();if(b?.player&&b.player!==a.player&&this.room.players[b.player]?.connectionId===b.id)this.send(other,result.packet);}
    this.send(ws,{type:'ACK',id:m.id});return;
   }
   // A retried start uses the same ID even if the database succeeded before room persistence.
   const startKey=this.room.matchId||this.room.code+':'+this.room.createdAt;
   const matchId=['START','REMATCH'].includes(m.type)?(await hash(startKey)).slice(0,32):null;
   const r=command(this.room,a.player,m,{now,coin:crypto.getRandomValues(new Uint8Array(1))[0]%2+1,matchId,connected:this.presence()});
   if(!r.duplicate){
    if(r.state.matchId!==this.room.matchId){await chargeMatch(this.env,r.state);r.state.coinsSettled=false;}
    await this.persist(r.state);
   }
   if(this.room.phase==='over')await this.settleCoins();

   this.send(ws,{type:'ACK',id:m.id,duplicate:r.duplicate,version:r.receipt.version,seq:r.receipt.seq});this.broadcast(r.event);
  }catch(e){this.send(ws,{type:'ERROR',code:e.message==='SEED_CONSERVATION'?'INTERNAL_ERROR':safeError(e),state:this.room?this.view():null});}
 });}
 async webSocketClose(ws,code,reason){try{ws.close(code===1005?1000:code,reason);}catch{}return this.run(async()=>{if(this.room)this.broadcast();});}
 async webSocketError(ws){try{ws.close(1011,'Connection error');}catch{}}
 async alarm(){return this.run(async()=>{if(!this.room)return;const now=Date.now();for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(a&&!a.player&&now>=a.createdAt+10000)ws.close(4003,'Authentication timeout');}if(now>=this.room.updatedAt+TTL){for(const ws of this.ctx.getWebSockets())ws.close(4004,'Room expired');await this.ctx.storage.deleteAll();this.room=null;return;}if(this.room.phase==='over'&&!this.room.coinsSettled)await this.settleCoins();if(this.room.pause&&now>=this.room.pause.until){const next=structuredClone(this.room);next.pause=null;next.version++;await this.persist(next);this.broadcast();}else await this.schedule();});}
}
function safeError(e){const message=String(e.message||'INVALID_COMMAND');return /^[A-Z_]+$/.test(message)?message:'INVALID_COMMAND';}
