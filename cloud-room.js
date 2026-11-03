// Cloudflare room transport. Tokens stay in local storage / AUTH frames, never URLs.
export const ROOM_SERVER='https://pallanguzhi-rooms-test.dinesh2type.workers.dev';
export const validCode=code=>/^[A-Z2-9]{8}$/.test(code);
export function playbackAction(local,next,{welcome=false,animating=false}={}){
 if(animating)return 'hold';
 if(!welcome&&local.started&&local.matchId===next.matchId&&local.round===next.round&&next.phase==='playback'&&next.seq===local.seq+1&&next.lastMove?.seq===next.seq)return 'animate';
 return 'snapshot';
}
export function createCloudRoom({onState,onConnection,onError,onPacket,storage=globalThis.localStorage,Socket=globalThis.WebSocket,request=globalThis.fetch,server=ROOM_SERVER}={}){
 const key='pallanguzhi.cloudflare.seat.v1';let seat=null,view=null,socket=null,generation=0,retry=null,heartbeat=null,manual=true,opening=false,lastHeard=0;
 const pending=new Map();
 try{const v=JSON.parse(storage.getItem(key)||'null');if(v&&validCode(v.code)&&[1,2].includes(v.player)&&typeof v.token==='string'&&v.token.length<200)seat=v;}catch{}
 const remember=v=>{seat={code:v.code,player:v.player,token:v.token};try{storage.setItem(key,JSON.stringify(seat));}catch{onError?.('Seat cannot be saved. Keep this tab open.');}};
 async function api(path,body){const r=await request(server+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const value=await r.json();if(!r.ok)throw Error(value.error||'Room request failed');return value;}
 function close(){manual=true;generation++;clearTimeout(retry);clearInterval(heartbeat);pending.clear();socket?.close();socket=null;opening=false;onConnection?.(false);}
 function connect(){if(!seat||opening)return false;manual=false;opening=true;clearTimeout(retry);clearInterval(heartbeat);const current=++generation;socket?.close();const url=new URL(server);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/api/rooms/'+seat.code+'/socket';socket=new Socket(url.href);onConnection?.(false);
  socket.onopen=()=>{if(current!==generation)return;lastHeard=Date.now();socket.send(JSON.stringify({type:'AUTH',protocol:1,token:seat.token}));heartbeat=setInterval(()=>{if(current!==generation||socket.readyState!==1)return;if(Date.now()-lastHeard>25000){socket.close();return;}socket.send('ping');for(const m of pending.values())socket.send(JSON.stringify(m));},10000);};
  socket.onmessage=e=>{if(current!==generation)return;lastHeard=Date.now();if(e.data==='pong')return;let m;try{m=JSON.parse(e.data);}catch{return;}if(m.type==='ACK'){pending.delete(m.id);return;}if(m.type==='CHAT'||m.type==='REACTION'){onPacket?.(m);return;}if(m.type==='ERROR'){pending.clear();onError?.(m.code);}
   if(m.type==='WELCOME'){opening=false;pending.clear();view=null;onConnection?.(true);}
   if(m.state&&(!view||view.matchId!==m.state.matchId||m.state.version>=view.version)){view=m.state;onState?.(view,{welcome:m.type==='WELCOME',event:m.event,error:m.type==='ERROR'});}};
  socket.onclose=e=>{if(current!==generation)return;opening=false;clearInterval(heartbeat);onConnection?.(false);if(!manual&&![4001,4003,4004].includes(e.code))retry=setTimeout(connect,2000);else if(!manual)onError?.(e.code===4001?'Room opened in another tab. Reconnect here to use this tab.':'Room expired or seat unavailable. Create a new room.');};
  socket.onerror=()=>onError?.('Connection interrupted. Reconnecting…');return true;
 }
 function send(type,extra={}){if(socket?.readyState!==1||opening)return false;const id=crypto.randomUUID();const m={type,id,matchId:view?.matchId,seq:view?.seq,round:view?.round,...extra};pending.set(id,m);socket.send(JSON.stringify(m));return true;}
 return {get seat(){return seat;},get view(){return view;},get online(){return socket?.readyState===1&&!opening;},get opening(){return opening;},
  async create(name,settings){close();const v=await api('/api/rooms',{name,settings});remember(v);view=null;connect();return seat;},
  async join(code,name){if(!validCode(code))throw Error('Enter the 8-character room code.');close();if(seat?.code===code){connect();return seat;}const v=await api('/api/rooms/'+code+'/join',{name});remember(v);view=null;connect();return seat;},
  reconnect:connect,close,send,
  sync(){if(socket?.readyState===1)socket.send(JSON.stringify({type:'SYNC'}));},
  forget(){close();seat=null;view=null;try{storage.removeItem(key);}catch{}}
 };
}
