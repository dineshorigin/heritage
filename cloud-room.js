// Private seat tokens travel only in AUTH frames, never in invite URLs.
export const ROOM_SERVER='https://pallanguzhi-rooms-test.dinesh2type.workers.dev';
export const validCode=code=>/^[A-Z2-9]{8}$/.test(code);
export function playbackAction(local,next,{welcome=false,animating=false}={}){
 if(animating)return 'hold';
 if(!welcome&&local.started&&local.matchId===next.matchId&&local.round===next.round&&next.phase==='playback'&&next.seq===local.seq+1&&next.lastMove?.seq===next.seq)return 'animate';
 return 'snapshot';
}
// One primary action per player. Host intent waits for actual server readiness.
export function createLobbyLaunch(send){
 let wanted=false,readyPending=false,startPending=false;
 const reset=()=>{wanted=false;readyPending=false;startPending=false;};
 function receive(view,player,connected){
  if(view?.phase!=='lobby'){reset();return;}
  if(view.players[player]?.ready)readyPending=false;
  if(!wanted||!connected)return;
  if(!view.players[player]?.ready&&!readyPending){readyPending=true;if(!send('READY',{ready:true}))readyPending=false;return;}
  if(player===1&&view.players[1]?.ready&&view.players[2]?.ready&&!startPending){startPending=true;if(!send('START'))startPending=false;}
 }
 return {reset,receive,disconnected(){readyPending=false;startPending=false;},
  request(view,player,connected){if(!connected||view?.phase!=='lobby')return false;wanted=true;receive(view,player,connected);return true;},
  inspect:()=>({wanted,readyPending,startPending})};
}
export function createCloudRoom({onState,onConnection,onError,onPacket,onStatus,storage=globalThis.localStorage,Socket=globalThis.WebSocket,request=globalThis.fetch,server=ROOM_SERVER,apiTimeout=12000,connectTimeout=10000,retryBase=1000,maxRetries=2}={}){
 const key='pallanguzhi.cloudflare.seat.v1';let seat=null,view=null,socket=null,generation=0,operation=0,retry=null,heartbeat=null,deadline=null,manual=true,opening=false,lastHeard=0,attempt=0,apiAbort=null;
 const pending=new Map();
 try{const v=JSON.parse(storage.getItem(key)||'null');if(v&&validCode(v.code)&&[1,2].includes(v.player)&&typeof v.token==='string'&&v.token.length<200)seat=v;}catch{}
 const remember=v=>{seat={code:v.code,player:v.player,token:v.token};try{storage.setItem(key,JSON.stringify(seat));}catch{onError?.('Seat cannot be saved. Keep this tab open.');}};
 async function api(path,body){
  const abort=new AbortController();apiAbort=abort;let timer;
  try{return await Promise.race([(async()=>{const r=await request(server+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal});const value=await r.json();if(!r.ok)throw Error(value.error||'Room request failed');return value;})(),new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Error('The room request timed out. Check your internet and tap Retry.'));abort.abort();},apiTimeout);})]);}
  finally{clearTimeout(timer);if(apiAbort===abort)apiAbort=null;}
 }
 function close(){manual=true;operation++;generation++;clearTimeout(retry);clearTimeout(deadline);clearInterval(heartbeat);apiAbort?.abort();apiAbort=null;pending.clear();const old=socket;socket=null;opening=false;old?.close();onConnection?.(false);}
 function connect(){
  if(!seat)return false;if(opening||socket?.readyState===1)return true;
  manual=false;opening=true;clearTimeout(retry);clearTimeout(deadline);clearInterval(heartbeat);const current=++generation;
  const url=new URL(server);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/rooms/'+seat.code+'/socket';
  const fail=(code=1006)=>{if(current!==generation)return;generation++;clearTimeout(deadline);clearInterval(heartbeat);const old=socket;socket=null;opening=false;try{old?.close();}catch{}onConnection?.(false);
   if(manual)return;
   if([4001,4003,4004].includes(code)){onError?.(code===4001?'This seat is open in another tab. Close it, then tap Retry.':'Room expired or seat unavailable. Create a new room.');return;}
   if(attempt>=maxRetries){onError?.('Could not connect. Check your internet and tap Retry.');return;}
   const delay=Math.min(6000,retryBase*2**attempt++);onStatus?.('Connection interrupted. Retrying…');retry=setTimeout(connect,delay);
  };
  onConnection?.(false);onStatus?.('Connecting to room…');
  try{socket=new Socket(url.href);}catch{fail();return false;}
  deadline=setTimeout(()=>fail(),connectTimeout);
  socket.onopen=()=>{if(current!==generation)return;lastHeard=Date.now();socket.send(JSON.stringify({type:'AUTH',protocol:1,token:seat.token}));heartbeat=setInterval(()=>{if(current!==generation||socket?.readyState!==1)return;if(Date.now()-lastHeard>25000){fail();return;}socket.send('ping');for(const m of pending.values())socket.send(JSON.stringify(m));},3000);};
  socket.onmessage=e=>{if(current!==generation)return;lastHeard=Date.now();if(e.data==='pong')return;let m;try{m=JSON.parse(e.data);}catch{return;}
   if(m.type==='ACK'){pending.delete(m.id);return;}
   if(m.type==='CHAT'||m.type==='REACTION'){onPacket?.(m);return;}
   if(m.type==='ERROR'){pending.clear();onError?.(m.code);}
   if(m.type==='WELCOME'){clearTimeout(deadline);opening=false;attempt=0;pending.clear();view=null;onConnection?.(true);}
   if(m.state&&(!view||view.matchId!==m.state.matchId||m.state.version>=view.version)){view=m.state;onState?.(view,{welcome:m.type==='WELCOME',event:m.event,error:m.type==='ERROR'});}
  };
  socket.onclose=e=>fail(e.code);
  socket.onerror=()=>fail();return true;
 }
 function send(type,extra={}){if(socket?.readyState!==1||opening)return false;const id=crypto.randomUUID(),m={type,id,matchId:view?.matchId,seq:view?.seq,round:view?.round,...extra};pending.set(id,m);try{socket.send(JSON.stringify(m));return true;}catch{pending.delete(id);socket.close();return false;}}
 return {get seat(){return seat;},get view(){return view;},get online(){return socket?.readyState===1&&!opening;},get opening(){return opening;},
  async create(name,settings){close();const op=operation;onStatus?.('Creating room…');const v=await api('/api/rooms',{name,settings});if(op!==operation)return null;remember(v);view=null;connect();return seat;},
  async join(code,name){if(!validCode(code))throw Error('Enter the 8-character room code.');close();const op=operation;if(seat?.code===code){connect();return seat;}onStatus?.('Joining room…');const v=await api('/api/rooms/'+code+'/join',{name});if(op!==operation)return null;remember(v);view=null;connect();return seat;},
  reconnect(){attempt=0;return connect();},close,send,
  sync(){if(socket?.readyState===1)socket.send(JSON.stringify({type:'SYNC'}));},
  forget(){close();seat=null;view=null;try{storage.removeItem(key);}catch{}}
 };
}
