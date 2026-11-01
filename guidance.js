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
  const side = g.turn === 1 ? 'bottom' : 'top';
  return `${g.name}'s turn — tap a highlighted cup in the ${side} row.`;
}
export function captureGuidance(name,count,pasu=false) {
  return pasu
    ? `Pasu! ${name} gains 4 seeds because this cup reached four.`
    : `${name} captured ${count} seeds from the cup beyond the empty or locked cup!`;
}
