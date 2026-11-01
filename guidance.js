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
  return `${g.name}'s turn — tap a highlighted cup on the ${side} side.`;
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
