const storageKey = 'pallanguzhi.coin-wallet.v1';
const keyPattern = /^[a-f0-9]{64}$/;
const messages = {
  COIN_SETTLEMENT_PENDING: 'Coins are still being saved. Try Rematch again shortly.',
  WALLET_UNAVAILABLE: 'The coin wallet is not available yet.',
  WALLET_NOT_FOUND: 'That recovery key does not match a wallet.',
  NOT_ENOUGH_COINS: 'You need more coins.',
  COIN_WALLET_REQUIRED: 'Open Heritage Coins and create or restore your wallet first.',
  COIN_FEE_CONSENT_REQUIRED: 'Create or join a new room to accept the current entry fee.',
  TWO_WALLETS_REQUIRED: 'Both players need separate coin wallets.'
};
export const coinMessage = code => messages[code];

function savedKey() {
  try { return localStorage.getItem(storageKey) || ''; }
  catch { return ''; }
}

async function post(server, payload, signal) {
  const response = await fetch(server + '/api/coins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });
  const data = await response.json();
  if (!response.ok) throw Error(data.error);
  return data;
}

export async function walletForRoom(server, roomCode) {
  const walletKey = savedKey();
  if (!walletKey) return {};
  try {
    const response = await fetch(server + '/api/coins/config', {signal: AbortSignal.timeout(4000)});
    if (!response.ok) return {};
    const config = await response.json();
    if (!config.enabled) return {};
    if (!config.entryFee) return {walletKey};
    if (!roomCode) {
      const paidRoom = window.confirm('Create a room that costs ' + config.entryFee + ' coins per player per match, including rematches? Choose Cancel for free entry.');
      return {walletKey, paidRoom, agreedFee: paidRoom ? config.entryFee : 0};
    }
    const room = await fetch(server + '/api/rooms/' + roomCode + '/coin-fee', {signal: AbortSignal.timeout(4000)});
    if (!room.ok) return {walletKey};
    const {entryFee} = await room.json();
    if (entryFee && !window.confirm('Spend ' + entryFee + ' Heritage Coins per match in this room, including rematches?')) {
      throw Error('COIN_FEE_CONSENT_REQUIRED');
    }
    return {walletKey, agreedFee: entryFee};
  } catch (error) {
    if (coinMessage(error.message)) throw error;
    return {};
  }
}

export function installCoinWallet(server) {
  const panel = document.getElementById('heritage-coins');
  const status = panel.querySelector('[role="status"]');
  const recovery = panel.querySelector('input');
  const actions = Array.from(panel.querySelectorAll('button'));
  let busy = false;
  let refreshPending = false;

  async function load(action = 'view', item) {
    if (busy) {
      if (action === 'view') refreshPending = true;
      return;
    }
    let walletKey = savedKey();
    if (action === 'show') {
      recovery.type = 'text';
      recovery.value = walletKey;
      recovery.select();
      return;
    }
    if (action === 'lock') {
      localStorage.removeItem(storageKey);
      recovery.value = '';
      recovery.type = 'password';
      delete document.body.dataset.coinWristband;
      delete document.body.dataset.coinSeeds;
      status.textContent = 'Wallet closed on this device.';
      updateButtons(false);
      return;
    }
    if (action === 'restore') walletKey = recovery.value.trim().toLowerCase();
    if (action === 'create' && !walletKey) {
      walletKey = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(storageKey, walletKey);
    }
    if (!keyPattern.test(walletKey)) {
      status.textContent = action === 'restore' ? 'Enter the 64-character recovery key.' : 'Create or restore a wallet to earn coins.';
      updateButtons(false);
      return;
    }
    busy = true;
    actions.forEach(button => { button.disabled = true; });
    try {
      const data = await post(server, {action, walletKey, item}, AbortSignal.timeout(8000));
      localStorage.setItem(storageKey, walletKey);
      recovery.value = '';
      recovery.type = 'password';
      status.textContent = data.balance + ' coins · ' + (data.entryFee ? 'Optional paid rooms cost ' + data.entryFee + ' coins per player' : 'Online entry is free');
      document.body.dataset.coinWristband = data.unlocked.includes('wristband') ? 'gold' : '';
      document.body.dataset.coinSeeds = data.unlocked.includes('seeds') ? 'jade' : '';
      for (const button of actions.filter(button => button.dataset.item)) {
        const unlocked = data.unlocked.includes(button.dataset.item);
        button.dataset.unlocked = String(unlocked);
        button.textContent = unlocked ? button.dataset.label + ' equipped' : button.dataset.label + ' · ' + data.prices[button.dataset.item] + ' coins';
      }
      updateButtons(true);
    } catch (error) {
      status.textContent = coinMessage(error.message) || 'Could not reach the coin wallet. Try again.';
      updateButtons(false);
    } finally {
      busy = false;
      if (refreshPending) {
        refreshPending = false;
        void load();
      }
    }
  }

  function updateButtons(active) {
    for (const button of actions) {
      const action = button.dataset.action;
      button.disabled = action === 'buy' ? !active || button.dataset.unlocked === 'true'
        : ['show', 'lock'].includes(action) && !savedKey();
    }
  }
  panel.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (button) void load(button.dataset.action, button.dataset.item).catch(() => {
      status.textContent = 'Wallet storage is unavailable on this device.';
    });
  });
  panel.addEventListener('toggle', () => {
    if (panel.open) void load();
    else {
      recovery.value = '';
      recovery.type = 'password';
    }
  });
  if (savedKey()) void load();
  else updateButtons(false);
  return () => { if (savedKey()) void load(); };
}
