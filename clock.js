// Decision time only. The caller controls authority, pauses and legal timeout moves.
export const CLOCK_CHOICES=Object.freeze([0,30,60,90]);
export const validClockSeconds=value=>CLOCK_CHOICES.includes(value)?value:0;
export function createTurnClock(){
 let key=null,left=0,last=0,running=false;
 return {
  step({turnKey,duration=0,active=false,now=0}){
   duration=validClockSeconds(duration);
   if(turnKey!==key){key=turnKey;left=duration*1000;running=false;last=now;}
   if(running)left=Math.max(0,left-Math.max(0,now-last));
   running=Boolean(active&&duration>0&&left>0);last=now;
   return {key,remaining:left,seconds:Math.ceil(left/1000),expired:duration>0&&left===0,running};
  },
  restore(turnKey,milliseconds,duration=0){key=turnKey;left=Math.max(0,Math.min(validClockSeconds(duration)*1000,Number(milliseconds)||0));last=0;running=false;},
  reset(){key=null;left=0;last=0;running=false;}
 };
}
export function validRemoteClock(packet,{key,player,duration,matchId}){
 return Boolean(packet&&packet.type==='TURN_CLOCK'&&packet.key===key&&packet.matchId===matchId&&packet.player===player&&Number.isFinite(packet.remaining)&&packet.remaining>=0&&packet.remaining<=validClockSeconds(duration)*1000);
}
