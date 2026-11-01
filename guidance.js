// Plain-text feedback shared by the interface and its tests.
export function turnGuidance(g) {
  if (!g.started) return 'Choose a mode, or try Quick Play against the computer.';
  if (g.roundPending) return 'Round complete. Review the seeds before the next round.';
  if (g.over) return 'Match complete. Check the results or play again.';
  if (g.paused) return 'Game paused. Resume when you are ready.';
  if (g.awaitingToss) return 'The coin toss decides who starts.';
  if (g.online && !g.connected) return 'Connection lost. Reconnect through the online room menu.';
  if (g.online && (g.awaitingSync || g.undoPending)) return 'Please wait while both boards synchronize.';
  if (g.busy) return `${g.name} is sowing. Watch the seeds move around the board.`;
  if (g.ai && g.turn === 2) return 'The computer is choosing a cup. Your turn is next.';
  if (g.online && g.turn !== g.myPlayer) return `Waiting for ${g.name} to play.`;
  const side = g.portrait ? (g.turn===1?'left':'right') : (g.turn===1?'bottom':'top');
  return `${g.name}'s turn — tap a cup on the ${side} side.`;
}
export function captureGuidance(name,count,pasu=false) {
  return pasu
    ? `Pasu! ${name} gains 4 seeds because this cup reached four.`
    : `${name} captured ${count} seeds from the cup beyond the empty or locked cup!`;
}

// Board dimensions are based on its allocated stage, never the full viewport.
export function boardSize(stageWidth,stageHeight,portrait) {
  const w=Math.max(0,Math.floor(stageWidth)-12);
  const h=Math.max(0,Math.floor(stageHeight)-12);
  return portrait ? {width:h,height:w} : {width:w,height:h};
}

export function rematchView({online,connected,localReady,remoteReady}) {
 if(!online)return {disabled:false,label:'↻ Rematch',message:'Same players and rules. A fresh score.'};
 if(!connected)return {disabled:true,label:'Friend disconnected',message:'Open Home to reconnect to your room.'};
 if(localReady)return {disabled:true,label:'Waiting for friend…',message:'Your rematch request is sent. The match starts when both players are ready.'};
 return {disabled:false,label:remoteReady?'↻ Accept rematch':'↻ Request rematch',message:remoteReady?'Your friend is ready. Accept to play again in the same room.':'Both players must choose Rematch. Your room and rules stay the same.'};
}
export function canStartRematch({online,connected,isHost,over,busy,localReady,remoteReady}) {
 return Boolean(online&&connected&&isHost&&over&&!busy&&localReady&&remoteReady);
}

export function playerTurnLabel(g,player) {
 if(!g.started||g.over||g.paused||g.awaitingToss||g.roundPending)return '';
 if(player!==g.turn)return 'WAITING';
 if(g.online&&(!g.connected||g.awaitingSync||g.undoPending))return 'CONNECTING…';
 if(g.busy)return g.ai&&player===2?'COMPUTER PLAYING…':'SOWING…';
 if(g.ai&&player===2)return 'COMPUTER TURN';
 if(g.online)return player===g.myPlayer?'YOUR TURN':'FRIEND’S TURN';
 return `${g.names[player]}'s turn`;
}
export function shouldNotifyTurn(g) {
 return Boolean(g.started&&!g.over&&!g.paused&&!g.awaitingToss&&!g.roundPending&&!g.busy&&!(g.ai&&g.turn===2)&&(!g.online||(g.connected&&!g.awaitingSync&&!g.undoPending&&g.turn===g.myPlayer)));
}
export function pickupPattern(count) {
 const taps=Math.min(7,Math.max(2,Math.ceil(count/2)));
 return Array.from({length:taps},(_,i)=>({offset:i*.024,strength:.9-i*.065}));
}

// Coordinates measured against reference-board.webp (1600 x 600).
// The offset between rows preserves the photographed carving.
export function referenceCup(index){
 if(!Number.isInteger(index)||index<0||index>13)throw new RangeError('Cup index must be 0..13');
 const top=index>=7,column=top?13-index:index;
 return {x:(top?22.7:17.95)+column*(top?9.23:9.35),y:top?20.8:77.4};
}

// A settled handful stays near the low central region of a carved bowl.
// This is a bounded visual pile, not a per-frame physics simulation.
export function shellPosition(index,serial,count,store=false){
 const n=Math.max(1,Math.min(store?30:20,Math.floor(count)||1));
 const j=Math.max(0,Math.min(n-1,Math.floor(serial)||0));
 if(n===1)return {x:50,y:58};
 const angle=j*2.39996323+index*.31;
 const spread=store?Math.min(28,10+Math.sqrt(n)*2.6):Math.min(24,10+Math.sqrt(n)*2.1);
 const radius=Math.sqrt((j+.5)/n)*spread;
 return {x:50+Math.cos(angle)*radius,y:58+Math.sin(angle)*radius*.68};
}
