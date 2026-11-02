// Lightweight effects and connection status helpers.
export function lightweight(mode='auto',device={}){return mode==='light'||mode==='auto'&&((device.deviceMemory>0&&device.deviceMemory<=4)||(device.hardwareConcurrency>0&&device.hardwareConcurrency<=4));}
export function connectionView({connected,awaitingSync,awaitingPlayback,stale,offline}){
 if(offline)return {state:'offline',label:'You are offline. Moves are paused.'};
 if(!connected||stale)return {state:'reconnecting',label:'Opponent reconnecting. Moves are paused.'};
 if(awaitingSync)return {state:'synchronizing',label:'Synchronizing boards…'};
 if(awaitingPlayback)return {state:'sowing',label:'Waiting for the other phone to finish sowing…'};
 return {state:'connected',label:'Connected'};
}
