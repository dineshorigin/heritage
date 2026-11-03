// Pure rules: no DOM, networking, storage, or animation dependencies.
const N=14, MAX_DROPS=1600;
const owner=pit=>pit<7?1:2;
export function simulateMove(originalPits, originalBanks, player, selected, config={}) {
    if(!Array.isArray(originalPits)||originalPits.length!==N||!originalPits.every(n=>Number.isSafeInteger(n)&&n>=0)||!Array.isArray(originalBanks)||originalBanks.length!==3||!originalBanks.every(n=>Number.isSafeInteger(n)&&n>=0)||originalPits.reduce((a,b)=>a+b,0)+originalBanks[1]+originalBanks[2]>100000)throw new Error('Invalid board position.');
    if(config.locked&&(!Array.isArray(config.locked)||config.locked.length!==N||!config.locked.every(v=>typeof v==='boolean')))throw new Error('Invalid locked cups.');
    const locked=config.locked || Array(N).fill(false);
    const enablePasu=(config.pasu || 'on')==='on';
    if (!Number.isInteger(player) || ![1, 2].includes(player) ||
        !Number.isInteger(selected) || selected < 0 || selected >= N ||
        owner(selected) !== player || originalPits[selected] <= 0)
      throw new Error('Illegal move: select a nonempty cup on your side.');
    if (locked && locked[selected])
      throw new Error('This cup is locked as Kasie (காசி அடைப்பு). Choose another cup.');

    const pits = originalPits.slice();
    const banks = originalBanks.slice();
    const events = [];
    let inHand = pits[selected], cursor = selected, drops = 0;
    pits[selected] = 0;
    events.push({kind:'pickup',pit:selected,count:inHand});
    const visited = new Set();

    while (true) {
      const signature = cursor + '|' + inHand + '|' + pits.join(',') + '|' + banks[1] + '|' + banks[2];
      if (visited.has(signature))
        throw new Error('Repeating sowing loop detected. Select another cup.');
      visited.add(signature);

      while (inHand > 0) {
        if (++drops > MAX_DROPS)
          throw new Error('Move exceeded the sowing safety limit. Select another cup.');
        cursor = (cursor + 1) % N;
        pits[cursor]++;
        inHand--;
        events.push({kind:'drop',pit:cursor,left:inHand});

        if (enablePasu && pits[cursor] === 4 && (!locked || !locked[cursor])) {
          const credited = owner(cursor);
          pits[cursor] = 0;
          banks[credited] += 4;
          events.push({kind:'pasu',pit:cursor,player:credited,count:4});
        }
      }

      const next = (cursor + 1) % N;
      if (pits[next] > 0 && (!locked || !locked[next])) {
        inHand = pits[next];
        pits[next] = 0;
        cursor = next;
        events.push({kind:'pickup',pit:next,count:inHand});
      } else {
        const target = (next + 1) % N;
        if (pits[target] > 0 && (!locked || !locked[target])) {
          const taken = pits[target];
          pits[target] = 0;
          banks[player] += taken;
          events.push({kind:'capture',pit:target,player,count:taken,emptyPit:next});
        } else {
          events.push({kind:'no-capture',emptyPit:next});
        }
        break;
      }
    }
    const expectedTotal = originalPits.reduce((a,b)=>a+b,0) + originalBanks[1] + originalBanks[2];
    const count = pits.reduce((a,b)=>a+b,0) + banks[1] + banks[2];
    if (count !== expectedTotal) throw new Error('Seed conservation error: ' + count);
    return {pits,banks,events,safetyStop:false};
  }


// Credit seeds trapped in locked cups to the opponent of the cup owner.
// Mutates the supplied round position; safe to call again after settlement.
export function settleLockedSeeds(pits,banks,locked) {
  for (let i=0;i<14;i++) {
    if (locked[i] && pits[i]>0) {
      banks[owner(i)===1?2:1]+=pits[i];
      pits[i]=0;
    }
  }
}
