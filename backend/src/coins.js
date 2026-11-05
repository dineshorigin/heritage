const prices = { wristband: 50, seeds: 100 };
const keyPattern = /^[a-f0-9]{64}$/;

export function entryFee(env) {
  return env.COIN_ENTRY_FEES_ENABLED === 'true' ? 5 : 0;
}

async function walletId(secret) {
  if (typeof secret !== 'string' || !keyPattern.test(secret)) throw Error('INVALID_WALLET_KEY');
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function walletApi(env, body) {
  if (!env.COINS) throw Error('WALLET_UNAVAILABLE');
  if (!['view','create','restore','buy'].includes(body.action)) throw Error('INVALID_WALLET_ACTION');
  const id = await walletId(body.walletKey);
  if (body.action === 'create') {
    await env.COINS.prepare('INSERT INTO wallets (id) VALUES (?) ON CONFLICT(id) DO NOTHING').bind(id).run();
  }
  if (body.action === 'buy') {
    if (!Object.hasOwn(prices, body.item)) throw Error('INVALID_ITEM');
    const result = await env.COINS.prepare(`
      INSERT INTO unlocks (wallet_id, item, price)
      SELECT id, ?, ? FROM wallets WHERE id = ? AND balance >= ?
      ON CONFLICT(wallet_id, item) DO NOTHING
    `).bind(body.item, prices[body.item], id, prices[body.item]).run();
    if (!result.meta.changes && !await env.COINS.prepare('SELECT item FROM unlocks WHERE wallet_id = ? AND item = ?').bind(id, body.item).first()) {
      throw Error('NOT_ENOUGH_COINS');
    }
  }
  const wallet = await env.COINS.prepare('SELECT balance FROM wallets WHERE id = ?').bind(id).first();
  if (!wallet) throw Error('WALLET_NOT_FOUND');
  const {results} = await env.COINS.prepare('SELECT item FROM unlocks WHERE wallet_id = ?').bind(id).all();
  return {balance: wallet.balance, unlocked: results.map(row => row.item), prices, entryFee: entryFee(env)};
}

export async function roomWallet(env, body, fee = 0) {
  if (!body.walletKey) {
    if (fee) throw Error('COIN_WALLET_REQUIRED');
    return null;
  }
  if (!env.COINS) throw Error('WALLET_UNAVAILABLE');
  const id = await walletId(body.walletKey);
  if (!await env.COINS.prepare('SELECT id FROM wallets WHERE id = ?').bind(id).first()) throw Error('WALLET_NOT_FOUND');
  if (fee && body.agreedFee !== fee) throw Error('COIN_FEE_CONSENT_REQUIRED');
  return {id, agreedFee: body.agreedFee === fee ? fee : 0};
}

export async function chargeMatch(env, room) {
  const fee = entryFee(env) && room.entryFee;
  if (!fee) return;
  if (!env.COINS) throw Error('WALLET_UNAVAILABLE');
  const [one, two] = room.players.slice(1).map(player => player.coinWallet);
  if (!one || !two || one.id === two.id) throw Error('TWO_WALLETS_REQUIRED');
  if (one.agreedFee !== fee || two.agreedFee !== fee) throw Error('COIN_FEE_CONSENT_REQUIRED');
  const result = await env.COINS.prepare(`
    INSERT INTO match_fees (match_id, player_one, player_two, price)
    SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM wallets WHERE id IN (?, ?) AND balance >= ?) = 2
    ON CONFLICT(match_id) DO NOTHING
  `).bind(room.matchId, one.id, two.id, fee, one.id, two.id, fee).run();
  if (!result.meta.changes && !await env.COINS.prepare('SELECT match_id FROM match_fees WHERE match_id = ? AND player_one = ? AND player_two = ?').bind(room.matchId, one.id, two.id).first()) {
    throw Error('NOT_ENOUGH_COINS');
  }
}

export async function rewardMatch(env, room) {
  if (!env.COINS) return;
  const wallets = room.players.slice(1).map(player => player.coinWallet?.id);
  if (wallets[0] && wallets[0] === wallets[1]) return;
  const statements = wallets.flatMap((id, index) => id ? [
    env.COINS.prepare('INSERT INTO match_rewards VALUES (?, ?, ?) ON CONFLICT(match_id, wallet_id) DO NOTHING')
      .bind(room.matchId, id, room.winner === index + 1 ? 10 : 5)
  ] : []);
  if (statements.length) await env.COINS.batch(statements);
}
