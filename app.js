import {createCloudRoom,createLobbyLaunch,playbackAction,validCode} from './cloud-room.js?v=3.25.1';
import {lightweight,connectionView,recoveryNotice,pitDescription,installDialogAccess} from './reliability.js?v=3.25.1';
import {createPlaybackBarrier,boardDigest,PLAYBACK_PROTOCOL,validRoomPace} from './playback.js?v=3.25.1';
import {PRIMARY_MATS,comfortSettings,captureExplanation,kasieExplanation,practiceComplete} from './comfort.js?v=3.25.1';
import {createPauseBudget,validPauseState,coinOutcome,PAUSE_LIMIT} from './session.js?v=3.25.1';
import {createTurnClock,validClockSeconds,validRemoteClock} from './clock.js?v=3.25.1';
import {setupWizard,menuArt,modeIdentity,lobbySignature,canStartRoom,acceptReady} from './menu.js?v=3.25.1';
import {createFeatures} from './features.js?v=3.25.1';
import {validMat,materialProfile,createFireworks} from './presentation.js?v=3.25.1';
import {ballisticFlight} from './physics.js?v=3.25.1';
import { installLanguage, getLanguage, translate } from './locale.js?v=3.25.1';
import { turnGuidance, captureGuidance, boardSize, boardViewport, referenceCup, shellPosition, rematchView, canStartRematch, playerTurnLabel, shouldNotifyTurn, pickupPattern } from './guidance.js?v=3.25.1';
import { simulateMove as simulateRules, settleLockedSeeds } from './rules.js?v=3.25.1';

(() => {
  'use strict';
  const recovery={timer:null,attempt:0,lastHeard:Date.now(),hidden:false,pendingSync:null,connectingUntil:0,pauseAfterToss:false};
  let peerStale=false,saveWarningShown=false;
  function sessionNotice(text){$('session-notice-copy').textContent=translate(text);$('session-notice').hidden=false;}
  let performanceMode='auto',captureTips=true;
  try{const prefs=JSON.parse(localStorage.getItem('pallanguzhi.reliability')||'{}');performanceMode=['auto','light','full'].includes(prefs.performance)?prefs.performance:'auto';captureTips=prefs.tips!==false;}catch{}
  const lightEffects=()=>lightweight(performanceMode,navigator);
  function saveReliability(){storedSet('pallanguzhi.reliability',{performance:performanceMode,tips:captureTips});}
  function roomConnection(){return connectionView({...onlineState,stale:peerStale,offline:navigator.onLine===false});}
  function reliabilityControls(){document.body.classList.toggle('light-effects',lightEffects());$('performance-btn').textContent=translate('Effects')+': '+translate({auto:'Auto',light:'Light',full:'Full'}[performanceMode]);$('capture-tips-btn').textContent=translate(captureTips?'Capture tips on':'Capture tips off');$('capture-tips-btn').setAttribute('aria-pressed',String(captureTips));}
  let lastTurnNotice=null;
  let fireworks=null;
  let features=null,wizard=null,explainAI=false;
  let selfName='Player 1',passName='Player 2';
  const turnClock=createTurnClock();let clockView=null,clockTick=-1,clockHandled='',clockSentAt=0,remoteClock=null;
  const lobby={localReady:false,remoteReady:false,remoteSignature:''};
  const pauseBudget=createPauseBudget(),pauseRequests=new Map();let roomPause={revision:-1,used:[0,0,0],owner:0,remaining:0,id:'',at:Date.now()};
  let practice=false,practiceOptions=null,practiceGuidance=true,practiceLastHint='',lastCapture=null,lastDetail='',boardGestureUntil=0,pointerStart=null;
  try{explainAI=localStorage.getItem('pallanguzhi.ai.explain')==='1';}catch{}
  const tournament={allocations:[],forcedDraw:false,endReason:''};
  const rematch={localReady:false,remoteReady:false};
  const playback=createPlaybackBarrier();let pendingCompletion=null,lastPlaybackAck=0;
  const N = 14, START_SEEDS = 5, TOTAL_SEEDS = 70, MAX_DROPS = 1600;
  const $ = id => document.getElementById(id);
  const other = p => p === 1 ? 2 : 1;
  const owner = pit => pit < 7 ? 1 : 2;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const row = p => p === 1 ? [0,1,2,3,4,5,6] : [7,8,9,10,11,12,13];
  const getTotalSeeds = () => (options.seedsPerPit || START_SEEDS) * N;
  const SETTINGS_KEY = 'pallanguzhi.heritage.v364.settings';

  let options = {
    ai: true,
    online: false,
    difficulty: 'medium',
    theme: 'bright',
    uiTheme:'dark',
    turnSeconds:0,comfortVersion:1,seedVolume:.85,uiVolume:.22,
    mat: 'emerald',
    seedStyle: 'cowrie',
    fast: false,
    pace: 'natural',
    sound: true,
    volume: 0.65,
    firstMove: 'coin',
    coinCall:'heads',
    format: 'single',
    seedsPerPit: 5,
    pasu: 'on'
  };
  let names = {1:'Player 1',2:'Azhagi (AI)'};
  let state = {
    pits: Array(N).fill(START_SEEDS),
    banks: [0,0,0],
    turn: 1,
    busy: false,
    over: false,
    epoch: 0,
    aiTicket: 0,
    started: false,
    activeMove: null,
    hintPit: null,
    history: [],
    metrics: {moves:0, p1Pasu:0, p1Captured:0, biggestCapture:0},
    matchId: null,
    matchStartedAt: 0,
    recordedStatsBefore: null,
    resultRecorded: false,
    round: 1,
    kasiePits: Array(N).fill(false),
    treasury: [0, 0, 0],
    lastWinner: null,
    currentRoundStarter: 1,
    lastStarter: 1,
    roundPending: false,
    paused: false,
    awaitingToss: false
  };
  /* Online PeerJS + BroadcastChannel state */
  let onlineState = {
    peer: null,
    conn: null,
    bc: null,
    isHost: true,
    myPlayerIndex: 1,
    roomCode: '',
    connected: false,
    generation: 0,
    pendingRemoteMoves: [],
    pendingNextRound: null,
    acknowledgedMatch: null,
    awaitingSync: false,
    awaitingPlayback:false,
    syncPending: false,
    remoteUndoAvailable: false,
    undoPending: false,
    pendingUndoRequest: null,
    revision: 0,remotePaused:false
  };

  // Server snapshots control room state; seed animations only control presentation.
  let cloudNext=null,cloudAnimating=false,cloudCreating=false,cloudJoining=false,cloudPauseCallback=null;
  const cloudLaunch=createLobbyLaunch((type,extra)=>cloud.send(type,extra));
  function roomMessage(message,error=false){const badge=$('online-status-badge');const captions={'Creating room…':'அறையை உருவாக்குகிறோம்…','Joining room…':'அறையில் இணைகிறோம்…','Connecting to room…':'அறையுடன் இணைக்கிறோம்…','Connection interrupted. Retrying…':'இணைப்பு துண்டிக்கப்பட்டது. மீண்டும் முயல்கிறோம்…','Waiting for both players to connect.':'இரு வீரர்களும் இணைவதற்காகக் காத்திருக்கிறோம்.','Could not connect. Check your internet and tap Retry.':'இணைக்க முடியவில்லை. இணையத்தைச் சரிபார்த்து மீண்டும் முயலவும்.'};badge.textContent=getLanguage()==='ta'?(captions[message]||translate(message)):translate(message);badge.className='online-badge '+(error||!onlineState.connected?'waiting':'connected');if($('room-retry-btn'))$('room-retry-btn').hidden=!error;}
  const cloud=createCloudRoom({
    onConnection:connected=>{if(!options.online)return;if(!connected){cloudLaunch.disconnected();onlineState.connected=false;onlineState.awaitingSync=state.started;updateOnlineControls();if(state.started)render();}},
    onStatus:message=>{if(options.online)roomMessage(message);},
    onError:message=>{if(!options.online)return;cloudLaunch.reset();onlineState.awaitingSync=false;const friendly=({BOTH_PLAYERS_MUST_BE_READY:'Both players need to be ready. Please try Start again.',ROOM_CREATION_DISABLED:'Room creation is temporarily disabled.',ROOM_FULL_OR_STARTED:'This room is full or already started. Use a new room code.',ROOM_EXPIRED_OR_NOT_FOUND:'Room expired or not found. Ask for a new code.',NOT_IN_LOBBY:'This match has already started. Reconnect to continue.'})[message]||message;roomMessage(friendly,true);toast(friendly,3000);updateOnlineControls();if(cloudPauseCallback){cloudPauseCallback({accepted:false});cloudPauseCallback=null;}if(state.started)render();},
    onPacket:packet=>{if(!options.online||packet.matchId!==state.matchId)return;if(packet.type==='CHAT')features?.receive(packet);else if(packet.type==='REACTION')showEmoteReaction(packet.emoji,packet.player);},
    onState:applyCloudState
  });
  function cloudSettings(){return {seeds:options.seedsPerPit,format:options.format,pasu:options.pasu,pace:options.pace,turnSeconds:0};}
  function cloudPause(next){
    const paused=Boolean(next.pause),was=state.paused;
    roomPause={revision:next.version,used:next.used.slice(),owner:next.pause?.owner||0,remaining:next.pause?Math.max(0,next.pause.until-Date.now()):0,id:next.pause?'server-pause':'',at:Date.now()};
    onlineState.remotePaused=false;
    if(paused&&!was)haltPlay();else if(!paused&&was)continuePlay();
    if(cloudPauseCallback){const callback=cloudPauseCallback;cloudPauseCallback=null;callback({accepted:paused,created:paused});}
  }
  function applyCloudState(next,meta={}){
    if(!options.online)return;
    const seat=cloud.seat;if(!seat)return;
    cloudNext=next;if(next.phase!=='lobby')cloudLaunch.reset();recovery.lastHeard=Date.now();peerStale=false;
    onlineState.myPlayerIndex=seat.player;onlineState.isHost=seat.player===1;onlineState.roomCode=seat.code;
    onlineState.connected=cloud.online&&Boolean(next.players[1]?.connected&&next.players[2]?.connected);
    onlineState.awaitingSync=false;onlineState.remoteUndoAvailable=false;
    for(const player of [1,2])if(next.players[player])names[player]=next.players[player].name;
    options.turnSeconds=0;options.coinCall='heads';options.seedsPerPit=next.settings.seeds;options.format=next.settings.format;options.pasu=next.settings.pasu;options.pace=next.settings.pace;options.fast=options.pace==='fast';options.ai=false;
    $('online-room-code').textContent=seat.code;
    lobby.localReady=Boolean(next.players[seat.player]?.ready);lobby.remoteReady=Boolean(next.players[other(seat.player)]?.ready);lobby.remoteSignature=lobbySignature(options);
    const badge=$('online-status-badge');if(!meta.error){badge.textContent=onlineState.connected?'Connected · Cloudflare':cloud.online?'Room '+seat.code+' · Waiting for opponent…':'Reconnecting…';badge.className='online-badge '+(onlineState.connected?'connected':'waiting');if($('room-retry-btn'))$('room-retry-btn').hidden=true;}
    if(next.phase==='lobby'){cloudLaunch.receive(next,seat.player,onlineState.connected);applyPlayerLabels();syncSetupModalUI();updateOnlineControls();return;}
    // Reconnection restores the server checkpoint instead of replaying a partial move twice.
    if(meta.welcome&&cloudAnimating){invalidateMatch();cloudAnimating=false;sessionNotice('Reconnected. The board was restored from the room server.');}
    cloudPause(next);
    const action=playbackAction({started:state.started,matchId:state.matchId,round:state.round,seq:state.metrics.moves},next,{welcome:meta.welcome,animating:cloudAnimating});
    if(action==='hold'){render();return;}
    if(action==='animate'){
      cloudAnimating=true;onlineState.awaitingPlayback=true;state.turn=next.lastMove.mover;
      void playPit(next.lastMove.pit,false,true,true);return;
    }
    const newMatch=state.matchId!==next.matchId,newRound=newMatch||state.round!==next.round;
    if(newRound){invalidateMatch();if(newMatch){state.metrics=emptyMetrics();state.resultRecorded=false;state.matchStartedAt=Date.now();tournament.allocations=[];tournament.endReason='';}rematch.localReady=false;rematch.remoteReady=false;}
    const showResult=next.phase==='over'&&(!state.over||newRound),showRound=next.phase==='round'&&(!state.roundPending||newRound);
    state.started=true;state.matchId=next.matchId;state.round=next.round;state.metrics.moves=next.seq;
    state.pits=next.pits.slice();state.banks=next.banks.slice();state.kasiePits=next.locked.slice();state.turn=next.turn;
    state.over=next.phase==='over';state.roundPending=next.phase==='round';state.awaitingToss=false;state.history=[];
    state.activeMove=null;state.busy=next.phase==='playback';onlineState.awaitingPlayback=state.busy;
    state.paused=Boolean(next.pause);tournament.forcedDraw=next.draw;
    for(const id of ['setup-modal','coin-toss-modal'])$(id).classList.add('hidden');
    if(newRound){for(const id of ['end-modal','round-modal','quit-modal'])$(id).classList.add('hidden');toast(names[next.turn]+' won the toss',1800);}
    $('round-brand-sub').textContent=options.format==='kasie'?'ROUND '+state.round+' · KASIE TOURNAMENT':'SINGLE MATCH';
    applyPlayerLabels();render();
    if(next.phase==='playback'){
      // A checkpoint restored after refresh is already displayed in full.
      if(!next.done[seat.player])cloud.send('DONE');
      setStatus('Waiting for the other phone to finish sowing…');
    }else if(next.phase==='turn')setStatus(names[state.turn]+"'s turn. Choose a cup on your side.");
    if(showResult)finishMatch();else if(showRound)showRoundSummary();
    if(next.phase==='over'){rematch.localReady=Boolean(next.players[seat.player]?.ready);rematch.remoteReady=Boolean(next.players[other(seat.player)]?.ready);updateRematchUI();}
    saveStableMatch();
  }
  async function cloudHost(){
    if(cloudCreating)return;
    if(onlineState.roomCode&&cloud.seat?.code===onlineState.roomCode){if(!cloud.online&&!cloud.opening)cloud.reconnect();return;}
    cloudCreating=true;options.turnSeconds=0;onlineStatus('Creating Cloudflare room…',false);
    try{const seat=await cloud.create(selfName,cloudSettings());if(!seat)return;if(!options.online){cloud.close();return;}onlineState.roomCode=seat.code;$('online-room-code').textContent=seat.code;}
    catch(e){if(e.name!=='AbortError'){onlineStatus(e.message,false);roomMessage(e.message,true);toast(e.message,2500);}}finally{cloudCreating=false;updateOnlineControls();}
  }
  async function cloudJoin(code){
    if(cloudJoining||cloud.opening)return;
    const clean=String(code||'').trim().toUpperCase();if(!validCode(clean)){toast('Enter the 8-character room code.',2000);return;}
    resetOnlineConnection({keepRoom:true});onlineState.isHost=false;onlineState.myPlayerIndex=2;onlineState.roomCode=clean;options.turnSeconds=0;
    cloudJoining=true;updateOnlineControls();
    try{await cloud.join(clean,selfName);}catch(e){if(e.name!=='AbortError'){onlineStatus(e.message,false);roomMessage(e.message,true);toast(e.message,2500);}}finally{cloudJoining=false;updateOnlineControls();}
  }
  function requestCloudStart(){
    if(!cloudLaunch.request(cloud.view,onlineState.myPlayerIndex,onlineState.connected&&cloud.online)){roomMessage('Waiting for both players to connect.',true);return;}
    updateOnlineControls();
  }
  function cloudPacket(packet){
    if(packet.type==='LOBBY_READY')return cloud.send('READY',{ready:packet.ready});
    if(packet.type==='GUEST_HELLO')return cloud.view?.players[onlineState.myPlayerIndex]?.name===selfName||cloud.send('NAME',{name:selfName});
    if(packet.type==='CONFIG_SYNC'&&onlineState.isHost){if(!cloud.online||cloud.view?.phase!=='lobby')return false;if(cloud.view.players[1]?.name!==selfName)cloud.send('NAME',{name:selfName});const settings=cloudSettings();return !['seeds','format','pasu','pace','turnSeconds'].some(key=>settings[key]!==cloud.view.settings[key])||cloud.send('SETTINGS',{settings});}
    if(['STATE_REQUEST','STATE_SYNC'].includes(packet.type)){cloud.sync();return true;}
    if(packet.type==='ROOM_PACE'){toast('Room pace is fixed for this match.',1800);return false;}
    if(packet.type==='CHAT')return cloud.send('CHAT',{text:packet.text});
    if(packet.type==='REACTION')return cloud.send('REACTION',{emoji:packet.emoji});
    return false;
  }

  let resetStatsConfirmTimer = null;

  const PROGRESS_KEY='pallanguzhi.heritage.v363.progress';
  const STATS_KEY='pallanguzhi.heritage.v363.stats';
  let stats={matches:0,wins:0,losses:0,draws:0,streak:0,bestStreak:0,bestScore:0,pasu:0,captured:0,expertWins:0,history:[]};
  const emptyMetrics=()=>({moves:0,p1Pasu:0,p1Captured:0,biggestCapture:0});
  let audio = null, toastTimer = null;
  const activeAnims = new Set();
  const feedbackTimers = new Set();
  const pitTimers = new Map();
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastHandPos = null;
  let lastDropSoundAt = 0;
  const paceMultiplier = () => options.pace==='fast' ? 0.58 : options.pace==='relaxed' ? 1.38 : 1;
  const layoutCenters = new Map();
  let layoutDirty = true;
  let boardEnlarged=false;
  const portraitBoard = () => matchMedia('(orientation: portrait) and (max-width:700px)').matches;

  function isModalOpen(id) {
    const el = $(id);
    return el && !el.classList.contains('hidden') && !el.hidden;
  }
  function haltPlay(){
    state.paused=true;state.aiTicket++;
    for(const animation of activeAnims)try{animation.pause();}catch{}
    if(state.busy&&!state.activeMove&&options.ai){state.busy=false;}
    updateSkipButton();render();saveStableMatch();
  }
  function continuePlay(){
    state.paused=false;onlineState.remotePaused=false;
    for(const animation of activeAnims)try{animation.play();}catch{}
    updateSkipButton();render();
    if(options.ai&&state.turn===2&&!state.busy)scheduleAiTurn(()=>state.started&&!state.over&&!state.paused);
    if(options.online){/* Server snapshot controls the next turn. */}
  }
  async function waitForPlay(epoch=state.epoch){while(state.paused||onlineState.remotePaused){if(epoch!==state.epoch||!state.started||state.over)return false;await wait(50);}return epoch===state.epoch;}
  function applyRoomPause(snapshot){
    if(!validPauseState(snapshot)||snapshot.revision<roomPause.revision)return;
    const was=roomPause.owner,now=Date.now();if(snapshot.revision===roomPause.revision){const remaining=Math.min(snapshot.remaining,Math.max(0,roomPause.remaining-(now-roomPause.at)));snapshot={...snapshot,remaining,owner:remaining?snapshot.owner:0,id:remaining?snapshot.id:''};}roomPause={...snapshot,used:snapshot.used.slice(),at:now};
    if(snapshot.owner){onlineState.remotePaused=false;haltPlay();}
    else if(was||state.paused){$('quit-modal').classList.add('hidden');$('tools-panel').hidden=true;$('tools-toggle').setAttribute('aria-expanded','false');features?.close();['mat-modal','rules-modal','stats-modal','audio-modal','capture-detail-modal'].forEach(id=>$(id).classList.add('hidden'));if(tutorial.open)tutorialClose();continuePlay();}
    updatePauseUI();
  }
  function publishPause(){const s=pauseBudget.snapshot(Date.now());storedSet('pallanguzhi.room.pause',{matchId:state.matchId,pause:s,savedAt:Date.now()});applyRoomPause(s);sendOnlinePacket({type:'PAUSE_STATE',matchId:state.matchId,pause:s});saveStableMatch();return s;}
  function updatePauseUI(){
    const caption=options.online&&state.started?(getLanguage()==='ta'?'இடைநிறுத்து':'Ⅱ Pause')+' · '+(PAUSE_LIMIT-roomPause.used[onlineState.myPlayerIndex]):translate('Ⅱ Pause');if($('pause-btn').textContent!==caption)$('pause-btn').textContent=caption;
    const active=options.online&&state.started&&roomPause.owner>0;
    $('room-pause-banner').hidden=!active;
    if(active){const seconds=Math.max(0,Math.ceil((roomPause.remaining-(Date.now()-roomPause.at))/1000));const left=PAUSE_LIMIT-roomPause.used[onlineState.myPlayerIndex];$('room-pause-text').textContent=getLanguage()==='ta'?`${displayName(roomPause.owner)} இடைநிறுத்தினார் · ${seconds} வி · உங்களுக்கு மீதி ${left}`:`${names[roomPause.owner]} paused · ${seconds}s · Your pauses left: ${left}`;}
    $('room-pause-resume').hidden=!active||roomPause.owner!==onlineState.myPlayerIndex;
    if(options.online&&state.started) $('pause-btn').title=getLanguage()==='ta'?`இடைநிறுத்தங்கள் மீதி: ${PAUSE_LIMIT-roomPause.used[onlineState.myPlayerIndex]}`:`Pauses left: ${PAUSE_LIMIT-roomPause.used[onlineState.myPlayerIndex]}`;
  }
  function requestGamePause(reason,done){
    if(!state.started||state.over||state.awaitingToss){done({accepted:true,created:false});return;}
    if(!options.online){const created=!state.paused;if(created)haltPlay();done({accepted:true,created});return;}
    if(!onlineState.connected){done({accepted:false});return;}
    if(options.online){if(cloud.view?.pause){done({accepted:true,created:false});return;}cloudPauseCallback=done;if(!cloud.send('PAUSE')){cloudPauseCallback=null;done({accepted:false});}return;}
    if(roomPause.owner){done({accepted:true,created:false});return;}
    const id=onlineState.myPlayerIndex+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    if(onlineState.isHost){const before=pauseBudget.snapshot(Date.now());const r=pauseBudget.request(onlineState.myPlayerIndex,id,Date.now());if(r.accepted)publishPause();done({...r,created:r.accepted&&!before.owner});}
    else{const timer=setTimeout(()=>{const p=pauseRequests.get(id);if(p){pauseRequests.delete(id);p.done({accepted:false});}},5000);pauseRequests.set(id,{done,timer});sendOnlinePacket({type:'PAUSE_REQUEST',action:'start',matchId:state.matchId,player:onlineState.myPlayerIndex,id});}
  }
  function resumeOwnedPause(){
    if(options.online){if(cloud.view?.pause?.owner===cloud.seat?.player)cloud.send('RESUME');return;}
    
    if(!options.online){continuePlay();return;}
    if(roomPause.owner!==onlineState.myPlayerIndex)return;
    if(onlineState.isHost){if(pauseBudget.resume(onlineState.myPlayerIndex,Date.now()))publishPause();}
    else sendOnlinePacket({type:'PAUSE_REQUEST',action:'resume',matchId:state.matchId,player:onlineState.myPlayerIndex,id:roomPause.id});
  }
  function openQuitModal(){
    if(!state.started||state.over||state.awaitingToss)return;
    requestGamePause('manual',r=>{$('quit-modal').querySelector('h2').textContent=r.accepted?'⏸ Game paused':'Leave the match?';$('quit-modal').classList.remove('hidden');if(!r.accepted)toast(getLanguage()==='ta'?'இடைநிறுத்தங்கள் இல்லை · நேரம் தொடரும்':'No pauses left · the clock continues',2300);});
  }
  function closeQuitModal(resume=true){$('quit-modal').classList.add('hidden');if(resume)resumeOwnedPause();}
  function pauseTick(){
    if(options.online){updatePauseUI();return;}
    if(options.online&&state.started&&!state.over&&!state.awaitingToss){if(onlineState.isHost){const latest=pauseBudget.snapshot(Date.now());if(latest.revision!==roomPause.revision||latest.owner!==roomPause.owner)publishPause();}else if(roomPause.owner&&Date.now()-roomPause.at>=roomPause.remaining){applyRoomPause({...roomPause,owner:0,remaining:0,id:''});sendOnlinePacket({type:'STATE_REQUEST'});}updatePauseUI();}
    
  }

  function handleSystemBack() {
    if(isModalOpen('audio-modal')){$('audio-modal').classList.add('hidden');return true;}
    if(isModalOpen('capture-detail-modal')){$('capture-detail-modal').classList.add('hidden');return true;}
    if(isModalOpen('practice-end-modal')){showSetup();return true;}
    if(isModalOpen('setup-modal')&&wizard?.step()>1){wizard.goto(wizard.step()-1);return true;}
    if(isModalOpen('features-modal')){features?.close();return true;}
    if(isModalOpen('mat-modal')){$('mat-modal').classList.add('hidden');return true;}
    if (isModalOpen('coin-toss-modal')) {
      $('coin-toss-modal').classList.add('hidden');
      showSetup();
      return true;
    }
    if(isModalOpen('round-modal')){
      if(!options.online||onlineState.isHost)$('next-round-btn').click();
      else toast('Waiting for host to begin the next round.',1400);
      return true;
    }
    if (isModalOpen('quit-modal')) {
      closeQuitModal();
      return true;
    }
    if (isModalOpen('tutorial-modal')) {
      tutorialClose();
      return true;
    }
    if (isModalOpen('rules-modal')) {
      $('rules-modal').classList.add('hidden');
      return true;
    }
    if (isModalOpen('stats-modal')) {
      closeStats();
      return true;
    }
    if (isModalOpen('setup-modal')) {
      if (state.started && !state.over) {
        $('setup-modal').classList.add('hidden');
        return true;
      }
      return false;
    }
    if (isModalOpen('end-modal')) {
      showSetup();
      return true;
    }
    if (!$('hint-explanation').hidden) {
      hideHintExplanation();
      state.hintPit = null;
      render();
      return true;
    }
    if (state.started && !state.over) {
      openQuitModal();
      return true;
    }
    return false;
  }

  function initBackButtonHandler() {
    try {
      history.replaceState({ screen: 'root' }, '');
      history.pushState({ trap: true }, '');
    } catch {}

    window.addEventListener('popstate', () => {
      const handled = handleSystemBack();
      if (handled) {
        try { history.pushState({ trap: true }, ''); } catch {}
      } else {
        if (window.PallanguzhiNative?.App?.exitApp) {
          window.PallanguzhiNative.App.exitApp();
        }
      }
    });

  }

  function storedGet(key){try{return localStorage.getItem(key);}catch{return null;}}
  function storedSet(key,data){try{localStorage.setItem(key,JSON.stringify(data));return true;}catch{return false;}}
  function storedRemove(key){try{localStorage.removeItem(key);}catch{}}
  const isWhole=(v,max=TOTAL_SEEDS)=>Number.isInteger(v)&&v>=0&&v<=max;
  function validPosition(pos){
    const expected = (pos?.options?.seedsPerPit || START_SEEDS) * N;
    return pos && Array.isArray(pos.pits) && pos.pits.length===N &&
      pos.pits.every(v=>isWhole(v, expected)) && Array.isArray(pos.banks) && pos.banks.length===3 &&
      isWhole(pos.banks[1], expected) && isWhole(pos.banks[2], expected) && [1,2].includes(pos.turn) &&
      pos.pits.reduce((a,b)=>a+b,0)+pos.banks[1]+pos.banks[2]===expected &&
      (pos.pendingRound === true || validMoves(pos.turn,pos.pits,normalizeKasie(pos.kasiePits)).length>0);
  }
  function normalizeKasie(values) {
    return Array.isArray(values)&&values.length===N&&values.every(v=>typeof v==='boolean') ? values.slice() : Array(N).fill(false);
  }
  function normalizeRound(value) { return Number.isInteger(value) && value>0 && value<1000 ? value : 1; }

  function cleanMetrics(data){
    const m=emptyMetrics();
    if(!data || typeof data!=='object')return m;
    for(const key of Object.keys(m))if(isWhole(data[key],1_000_000))m[key]=data[key];
    return m;
  }

  function saveSettings(){
    storedSet(SETTINGS_KEY, {
      ai: options.ai,
      online: options.online,
      difficulty: options.difficulty,
      theme: 'bright',uiTheme:options.uiTheme,selfName,passName,turnSeconds:options.turnSeconds,comfortVersion:1,seedVolume:options.seedVolume,uiVolume:options.uiVolume,
      mat: options.mat,
      seedStyle: options.seedStyle,
      pace: options.pace,
      sound: options.sound,
      volume: options.volume,
      firstMove: 'coin',coinCall:options.coinCall,
      format: options.format,
      seedsPerPit: options.seedsPerPit,
      pasu: options.pasu,
      names:{...names}
    });
  }

  function loadSettings(){
    const raw = storedGet(SETTINGS_KEY);
    if (!raw) return;
    try {
      const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!data || typeof data !== 'object') return;
      if (typeof data.ai === 'boolean') options.ai = data.ai;
      if (typeof data.online === 'boolean') options.online = data.online;
      if (['easy','medium','hard','expert'].includes(data.difficulty)) options.difficulty = data.difficulty;
      options.theme='bright';options.uiTheme=data.uiTheme==='light'?'light':'dark';Object.assign(options,comfortSettings(data));
      if(typeof data.passName==='string')passName=data.passName.trim().slice(0,18)||'Player 2';
      if(typeof data.selfName==='string')selfName=data.selfName.trim().slice(0,18)||'Player 1';else if(typeof data.names?.[1]==='string')selfName=data.names[1].slice(0,18);
      options.mat=validMat(data.mat);
      options.seedStyle='cowrie';
      if (['natural','relaxed','fast'].includes(data.pace)) {
        options.pace = data.pace;
        options.fast = options.pace === 'fast';
      }
      if (typeof data.sound === 'boolean') options.sound = data.sound;
      if (typeof data.volume === 'number') options.volume = Math.max(0, Math.min(1, data.volume));
      options.firstMove='coin';options.coinCall=data.coinCall==='tails'?'tails':'heads';
      if (['kasie','single'].includes(data.format)) options.format = data.format;
      if ([4,5].includes(data.seedsPerPit)) options.seedsPerPit = data.seedsPerPit;
      if (['on','off'].includes(data.pasu)) options.pasu = data.pasu;
      if (data.names) {
        if (data.names[1]) names[1] = String(data.names[1]).slice(0, 18);
        if (data.names[2]) names[2] = String(data.names[2]).slice(0, 18);
      }
    } catch {}
  }

  function updatePaceUI(){
    const compact=matchMedia('(max-width:420px)').matches;
    const labels=compact
      ? {natural:'🎞 Natural',relaxed:'🌿 Relaxed',fast:'⚡ Fast'}
      : {natural:'🎞 Pace: Natural',relaxed:'🌿 Pace: Relaxed',fast:'⏩ Pace: Fast'};
    const button=$('speed-btn');
    button.textContent=labels[options.pace]||labels.natural;
    button.setAttribute('aria-label',`Gameplay pace: ${options.pace}. Tap to change.`);
    button.setAttribute('aria-pressed',String(options.pace==='fast'));
  }
  function syncSetupModalUI(){
    const currentMode=options.online?'online':(options.ai?'ai':'two');
    document.querySelectorAll('[data-mode]').forEach(b=>{const active=b.dataset.mode===currentMode;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    options.firstMove='coin';document.querySelectorAll('[data-call]').forEach(b=>{b.classList.toggle('active',b.dataset.call===options.coinCall);b.setAttribute('aria-pressed',String(b.dataset.call===options.coinCall));});
    document.querySelectorAll('[data-format]').forEach(b=>b.classList.toggle('active',b.dataset.format===options.format));
    document.querySelectorAll('[data-seedscount]').forEach(b=>b.classList.toggle('active',Number(b.dataset.seedscount)===options.seedsPerPit));
    document.querySelectorAll('[data-pasu]').forEach(b=>b.classList.toggle('active',b.dataset.pasu===options.pasu));
    document.querySelectorAll('[data-difficulty]').forEach(b=>{const active=b.dataset.difficulty===options.difficulty;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    
    const ta=getLanguage()==='ta';document.querySelector('.recommended-note').textContent=ta?`${options.turnSeconds?options.turnSeconds+' விநாடிகள்':'நேர வரம்பில்லை'} · ${options.format==='kasie'?'காசி சுற்றுகள்':'ஒரு சுற்று'} · ${options.seedsPerPit} விதைகள் · பசு ${options.pasu==='on'?'உண்டு':'இல்லை'}`:`${options.turnSeconds?options.turnSeconds+' seconds':'Untimed'} · ${options.format==='kasie'?'Kasie rounds':'One round'} · ${options.seedsPerPit} seeds · Pasu ${options.pasu}`;
    document.querySelectorAll('[data-seeds]').forEach(b=>b.classList.toggle('active',b.dataset.seeds===options.seedStyle));
    $('difficulty-picker').hidden=!options.ai||options.online;
    $('online-panel').hidden=!options.online;
    if(options.online){options.turnSeconds=0;document.querySelectorAll('[data-clock]').forEach(b=>b.disabled=true);}
    if(options.online&&wizard?.step()>1&&onlineState.isHost&&!onlineState.peer&&!onlineState.bc&&!onlineState.connected)initOnlineHost();
    $('difficulty-description').textContent=difficultyDescriptions[options.difficulty]||'';
    if(options.ai&&!options.online)names[2]='Azhagi (AI)';
    if(!options.ai&&!options.online)names[2]=passName;
    names[options.online?onlineState.myPlayerIndex:1]=selfName;
    $('p1-input').value=['Player 1','Player 2'].includes(selfName)?translate(selfName):selfName;$('p2-input').value=names[2];
    $('p2-name-group').hidden=options.ai||options.online;$('p2-input').disabled=options.ai||options.online;
    document.querySelectorAll('[data-clock]').forEach(b=>{b.classList.toggle('active',Number(b.dataset.clock)===options.turnSeconds);b.setAttribute('aria-pressed',String(Number(b.dataset.clock)===options.turnSeconds));});
    $('mode-setup-title').textContent=translate(options.online?'Connect':options.ai?'Play computer':'Pass N Play');
    document.querySelector('.opponent-preview').hidden=!options.ai&&!options.online;
    syncRoomTabs();
    $('setup-opponent-name').textContent=options.online?(onlineState.connected?displayName(other(onlineState.myPlayerIndex)):translate('Waiting for opponent…')):displayName(2);
    $('volume-input').value=Math.round(options.volume*100);
    $('volume-display').textContent=Math.round(options.volume*100)+'%';
    for(const kind of ['seed','ui']){$(kind+'-volume-input').value=Math.round(options[kind+'Volume']*100);$(kind+'-volume-display').textContent=Math.round(options[kind+'Volume']*100)+'%';}
    options.theme='bright';document.body.className='';document.body.dataset.uiTheme=options.uiTheme;document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.content=options.uiTheme==='light'?'#eae3d4':'#0b171b');
    for(const id of ['theme-btn','appearance-setup-btn'])$(id).setAttribute('aria-pressed',String(options.uiTheme==='dark'));
    document.body.classList.toggle('table-facing',!options.ai&&!options.online);
    document.body.dataset.mat=validMat(options.mat);
    $('theme-btn').textContent=options.uiTheme==='light'?'☾ Dark mode':'☀ Light mode';
    $('appearance-setup-btn').textContent=options.uiTheme==='light'?'☾ Dark mode':'☀ Light mode';
    updatePaceUI();
    $('sound-btn').textContent=options.sound?'🔊 Sound':'🔇 Muted';
    $('sound-btn').classList.toggle('sound-off',!options.sound);
    $('sound-btn').setAttribute('aria-pressed',String(options.sound));
    updateOnlineControls();
  }

  function showSetup(){
    if(options.online){cloudLaunch.reset();cloud.close();cloudAnimating=false;onlineState.roomCode='';}
    if(practice){practice=false;if(practiceOptions)options={...practiceOptions};practiceOptions=null;}$('practice-end-modal').classList.add('hidden');$('practice-bar').hidden=true;
    document.body.dataset.dialogOwner='neutral';
    fireworks?.stop();
    recovery.pauseAfterToss=false;
    clearCaptureFeedback();
    invalidateMatch();
    state.started = false;
    state.over = false;
    state.history = [];
    state.pits = Array(N).fill(options.seedsPerPit);
    render();
    $('end-modal').classList.add('hidden');
    $('rules-modal').classList.add('hidden');
    $('stats-modal').classList.add('hidden');
    $('coin-toss-modal').classList.add('hidden');
    $('round-modal').classList.add('hidden');
    $('quit-modal').classList.add('hidden');
    $('setup-modal').classList.remove('hidden');
    wizard?.home();syncSetupModalUI();
    setStatus('Choose your match settings and start.');
    refreshResumePanel();
  }

  function selectOption(group,value){
    if(group==='mode'){
      options.turnSeconds=0;options.format='single';options.seedsPerPit=5;options.pasu='on';boardEnlarged=false;fitBoard(true);
      const wasOnline=options.online;
      options.online=value==='online';options.ai=value==='ai';
      if(wasOnline&&!options.online)resetOnlineConnection();
      if(options.online&&!wasOnline){resetOnlineConnection();onlineState.isHost=true;onlineState.myPlayerIndex=1;}
      options.seedStyle='cowrie';
      names=modeIdentity({mode:value,ownName:selfName,player:onlineState.myPlayerIndex,peerName:options.online?names[other(onlineState.myPlayerIndex)]:passName});
    }else if(group==='toss')options.firstMove='coin';
    else if(group==='call')options.coinCall=value==='tails'?'tails':'heads';
    else if(group==='format')options.format=value;
    else if(group==='seedscount'){
      options.seedsPerPit=Number(value);
      if(!state.started){state.pits=Array(N).fill(options.seedsPerPit);render();}
    }else if(group==='pasu')options.pasu=value;
    else if(group==='difficulty')options.difficulty=value;
    else if(group==='clock')options.turnSeconds=options.online?0:validClockSeconds(Number(value));
    else if(group==='theme')options.uiTheme=value==='light'?'light':'dark';
    else if(group==='seeds'){options.seedStyle=value;render();beadImpact('drop',.85);}
    if(options.online&&['mode','toss','format','seedscount','pasu','clock','call'].includes(group)){resetLobbyReady();if(!onlineState.isHost&&cloud.online)broadcastReady();if(onlineState.isHost&&cloud.online)sendOnlinePacket({type:'CONFIG_SYNC',options:{...options},hostName:selfName});}
    saveSettings();syncSetupModalUI();
  }

  /* ========================================================
     ONLINE P2P WEBRTC (PeerJS) + LOCAL CHANNEL ENGINE
     ======================================================== */
  function resetLobbyReady(){lobby.localReady=false;lobby.remoteReady=false;lobby.remoteSignature='';}
  function roomCanStart(){return canStartRoom({connected:onlineState.connected,host:onlineState.isHost,localReady:lobby.localReady,remoteReady:lobby.remoteReady,localSignature:lobbySignature(options),remoteSignature:lobby.remoteSignature});}
  function broadcastReady(){return sendOnlinePacket({type:'LOBBY_READY',protocol:PLAYBACK_PROTOCOL,room:onlineState.roomCode,player:onlineState.myPlayerIndex,ready:lobby.localReady,signature:lobbySignature(options),name:selfName});}
  function syncRoomTabs(){
    const join=!onlineState.isHost;
    $('online-host-section').hidden=join;$('online-join-section').hidden=!join;
    for(const [id,active] of [['room-create-tab',!join],['room-join-tab',join]]){const b=$(id);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));b.disabled=onlineState.connected;}
  }
  function chooseRoomTab(join){
    if(onlineState.connected||state.started)return;
    if(onlineState.isHost===!join){syncRoomTabs();return;}
    resetOnlineConnection();onlineState.isHost=!join;onlineState.myPlayerIndex=join?2:1;
    if(!join)initOnlineHost();syncRoomTabs();syncSetupModalUI();if(join)$('join-room-input').focus();
  }
  function updateLobbyUI(){syncRoomTabs();
    const connected=options.online&&onlineState.connected,peer=other(onlineState.myPlayerIndex),ta=getLanguage()==='ta';
    $('room-peer-name').textContent=connected?displayName(peer):translate('Waiting for opponent…');
    const message=!connected?translate('Waiting for opponent…'):(lobby.remoteReady?(ta?'எதிர்வீரர் தயார்':'Opponent is ready'):(ta?'எதிர்வீரர் தயாராகக் காத்திருக்கிறோம்':'Waiting for opponent to tap Ready'));
    $('room-ready-status').textContent=message;$('room-final-status').textContent=options.online?((lobby.localReady?(ta?'நீங்கள் தயார்':'You are ready'):(ta?'தயார் என்பதைத் தொடவும்':'Tap Ready'))+' · '+message):'';
    $('room-ready-btn').hidden=true;$('room-ready-btn').disabled=true;
    $('room-ready-btn').textContent=lobby.localReady?(ta?'✓ நீங்கள் தயார் · மாற்ற தொடவும்':'✓ You are ready · tap to cancel'):(ta?'நான் தயார்':'I’m ready');
    $('room-ready-btn').setAttribute('aria-pressed',String(lobby.localReady));
    $('room-final-ready-btn').hidden=true;$('room-final-ready-btn').disabled=true;$('room-final-ready-btn').textContent=$('room-ready-btn').textContent;$('room-final-ready-btn').setAttribute('aria-pressed',String(lobby.localReady));
    if(options.online)$('setup-opponent-name').textContent=connected?displayName(peer):translate('Waiting for opponent…');
    document.querySelectorAll('#setup-modal [data-call],#setup-modal [data-format],#setup-modal [data-pasu],#setup-modal [data-seedscount],#setup-modal [data-clock]').forEach(b=>b.disabled=options.online&&(b.hasAttribute('data-clock')||b.hasAttribute('data-call')||!onlineState.isHost||state.started));
  }
  function onlineStatus(message, connected=false) {
    if(!connected&&!options.online)resetLobbyReady();
    onlineState.connected=connected;peerStale=false;
    if(connected){clearTimeout(recovery.timer);recovery.timer=null;recovery.attempt=0;recovery.connectingUntil=0;recovery.lastHeard=Date.now();}
    const badge=$('online-status-badge');
    if(badge){badge.className='online-badge '+(connected?'connected':'waiting');badge.textContent=message;}
    updateOnlineControls();
    if(state.started)render();
  }
  function updateOnlineControls() {
    if($('cloud-room-note'))$('cloud-room-note').textContent=getLanguage()==='ta'?'இந்த அறைச் சோதனையில் நேர வரம்பும் நகர்வை மீட்டலும் இல்லை. தொடங்கும் வீரர் குலுக்கல் மூலம் தேர்வு செய்யப்படுவார்.':'Room test: untimed, with no Undo. A random toss chooses the starting player.';
    if($('room-retry-btn'))$('room-retry-btn').textContent=getLanguage()==='ta'?'மீண்டும் இணை':'Retry connection';
    const start=$('start-btn');
    if(!start)return;
    if(!options.online){start.disabled=false;start.textContent='Start match';}
    else {
      const launch=cloudLaunch.inspect(),mine=Boolean(cloud.view?.players[onlineState.myPlayerIndex]?.ready),ta=getLanguage()==='ta';
      start.disabled=!onlineState.connected||!cloud.online||cloudCreating||cloudJoining||launch.wanted||launch.readyPending||launch.startPending;
      start.textContent=launch.startPending?(ta?'ஆட்டம் தொடங்குகிறது…':'Starting match…'):launch.readyPending?(ta?'தயார் நிலையை அனுப்புகிறோம்…':'Sending Ready…'):onlineState.isHost?(launch.wanted?(ta?'எதிர்வீரர் தயாராகக் காத்திருக்கிறோம்…':'Waiting for opponent to get ready…'):(ta?'இணைய ஆட்டத்தைத் தொடங்கு':'Start online match')):(mine?(ta?'தயார் · அறை உருவாக்கியவருக்காகக் காத்திருக்கிறோம்':'Ready · waiting for host'):(ta?'நான் தயார்':'I’m ready'));
      if(!onlineState.isHost&&mine)start.disabled=true;
      start.setAttribute('aria-busy',String(launch.startPending||launch.readyPending));
    }
    if($('start-online-help')){$('start-online-help').hidden=!options.online;$('start-online-help').textContent=getLanguage()==='ta'?'அறை உருவாக்கியவர் தொடங்கு என்பதைத் தொடவும். மற்ற வீரர் நான் தயார் என்பதைத் தொட்டவுடன் ஆட்டம் தொடங்கும்.':'Host: tap Start online match. Friend: tap I’m ready. The match starts once both are ready.';}
    if($('online-reactions'))$('online-reactions').hidden=!options.online||!onlineState.connected;
    if($('join-room-btn'))$('join-room-btn').disabled=options.online&&(onlineState.connected||cloudJoining||cloud.opening);
    for(const id of ['copy-code-btn','copy-room-btn','wa-share-btn'])if($(id))$(id).disabled=options.online&&(!validCode(onlineState.roomCode)||!cloud.online);
    updateLobbyUI();
    updateRematchUI();
    $('online-recovery').hidden=!options.online||!state.started;
    $('reconnect-btn').hidden=onlineState.connected&&!onlineState.awaitingSync;
    /* Legacy labels are replaced by the shared connection view below. */
    $('online-recovery').dataset.state=!onlineState.connected?'reconnecting':state.paused?'paused':onlineState.awaitingSync?'synchronizing':'connected';
    const connection=roomConnection();$('online-recovery').dataset.state=connection.state;$('connection-text').textContent=translate(connection.label);$('reconnect-btn').hidden=connection.state==='connected'||connection.state==='sowing';
  }
  function resetOnlineConnection({keepRoom=false}={}) {
    cloudLaunch.reset();cloud.close();cloudNext=null;cloudAnimating=false;
    clearTimeout(recovery.timer);recovery.timer=null;
    if(!keepRoom){recovery.attempt=0;features?.resetRoom();}
    recovery.pendingSync=null;recovery.connectingUntil=0;onlineState.remotePaused=false;
    rematch.localReady=false;rematch.remoteReady=false;
    resetLobbyReady();
    onlineState.generation++;
    onlineState.pendingRemoteMoves=[];
    onlineState.pendingNextRound=null;
    onlineState.acknowledgedMatch=null;
    onlineState.awaitingSync=false;onlineState.syncPending=false;
    onlineState.remoteUndoAvailable=false;onlineState.undoPending=false;
    onlineState.pendingUndoRequest=null;onlineState.revision=0;
    try{onlineState.conn?.close();}catch{}
    try{onlineState.peer?.destroy();}catch{}
    try{onlineState.bc?.close();}catch{}
    onlineState.conn=null;onlineState.peer=null;onlineState.bc=null;
    onlineState.connected=false;
    if(!keepRoom)onlineState.roomCode='';
    updateOnlineControls();
  }
  function safeRemoteName(value, fallback) {
    return typeof value==='string' ? (value.trim().slice(0,18)||fallback) : fallback;
  }
  function applyRemoteRules(remote) {
    if(!remote||typeof remote!=='object')return;
    // Shared rules and room pace match; sound, accessibility and theme remain personal.
    options.firstMove='coin';options.coinCall=remote.coinCall==='tails'?'tails':'heads';
    if(['single','kasie'].includes(remote.format))options.format=remote.format;
    if([4,5].includes(remote.seedsPerPit))options.seedsPerPit=remote.seedsPerPit;
    if(['on','off'].includes(remote.pasu))options.pasu=remote.pasu;options.turnSeconds=validClockSeconds(remote.turnSeconds);
    options.ai=false;options.online=true;options.pace=validRoomPace(remote.pace);
    options.fast=options.pace==='fast';
  }
  function onlinePacket(payload) {
    const packet={...payload};
    // Prefer WebRTC if open; a local BroadcastChannel is an alternative transport.
    if(onlineState.conn?.open){
      try{onlineState.conn.send(packet);return true;}catch{}
    }
    if(onlineState.bc){
      try{onlineState.bc.postMessage(packet);return true;}catch{}
    }
    return false;
  }
  function sendAuthoritativeState(){
    if(!options.online||!onlineState.isHost||!onlineState.connected||!state.started){onlineState.syncPending=false;return;}
    if(state.activeMove||state.busy||state.awaitingToss){onlineState.syncPending=true;return;}
    const position={pits:state.pits.slice(),banks:state.banks.slice(),turn:state.turn,
      kasiePits:state.kasiePits.slice(),round:state.round,roundPending:state.roundPending,over:state.over,paused:state.paused,
      tournament:{allocations:tournament.allocations.slice(),forcedDraw:tournament.forcedDraw,endReason:tournament.endReason},
      metrics:{...state.metrics},currentRoundStarter:state.currentRoundStarter,matchStartedAt:state.matchStartedAt,pause:pauseBudget.snapshot(Date.now())};
    sendOnlinePacket({type:'STATE_SYNC',protocol:PLAYBACK_PROTOCOL,matchId:state.matchId,rev:onlineState.revision,
      undoAvailable:state.history.length>0,position,
      options:{format:options.format,firstMove:'coin',coinCall:options.coinCall,seedsPerPit:options.seedsPerPit,pasu:options.pasu,turnSeconds:options.turnSeconds,pace:options.pace},names:{...names}});
    onlineState.syncPending=false;
  }
  function sendUndoAvailability(){
    if(!options.online||!onlineState.isHost||!onlineState.connected)return;
    sendOnlinePacket({type:'UNDO_AVAILABLE',matchId:state.matchId,rev:onlineState.revision,
      seq:state.metrics.moves,available:state.history.length>0});
  }
  function processPendingUndo(){
    if(!options.online||!onlineState.isHost||!onlineState.pendingUndoRequest)return;
    if(state.busy||state.activeMove||state.awaitingToss||state.paused||onlineState.remotePaused)return;
    const request=onlineState.pendingUndoRequest;
    onlineState.pendingUndoRequest=null;
    if(!onlineState.connected||request.matchId!==state.matchId||request.rev!==onlineState.revision||request.round!==state.round||request.seq!==state.metrics.moves||state.roundPending||!state.history.length){
      sendOnlinePacket({type:'UNDO_REJECT',matchId:state.matchId,rev:onlineState.revision});
      sendAuthoritativeState();return;
    }
    onlineState.revision++;
    if(performLocalUndo()){
      onlineState.pendingRemoteMoves=[];onlineState.pendingNextRound=null;
      saveStableMatch();sendAuthoritativeState();sendUndoAvailability();
    }else onlineState.revision--;
  }
  function processPendingNextRound() {
    const packet=onlineState.pendingNextRound;
    if(!packet||!options.online||onlineState.isHost||!state.roundPending)return;
    if(packet.matchId!==state.matchId||packet.fromRound!==state.round)return;
    onlineState.pendingNextRound=null;
    $('round-modal').classList.add('hidden');
    const S=options.seedsPerPit;
    const f1=Math.min(7,Math.floor(state.banks[1]/S));
    const f2=Math.min(7,Math.floor(state.banks[2]/S));
    setupNextRound(f1,f2,S,false,packet.starter);
  }
  function processRemoteQueue() {
    if(!options.online||!onlineState.connected||!state.started||state.busy||state.paused||onlineState.remotePaused||onlineState.awaitingSync||state.over||state.awaitingToss||state.roundPending||isModalOpen('setup-modal')||(isModalOpen('quit-modal')&&state.paused)||isModalOpen('coin-toss-modal'))return;
    onlineState.pendingRemoteMoves=onlineState.pendingRemoteMoves.filter(m=>m.matchId===state.matchId&&m.rev===onlineState.revision&&m.round>=state.round&&m.seq>=state.metrics.moves);
    const ix=onlineState.pendingRemoteMoves.findIndex(m=>m.matchId===state.matchId&&m.round===state.round&&m.seq===state.metrics.moves&&m.player===state.turn&&owner(m.pit)===state.turn&&state.turn!==onlineState.myPlayerIndex);
    if(ix<0)return;
    const [m]=onlineState.pendingRemoteMoves.splice(ix,1);
    if(m.position&&m.position!==positionFingerprint()){if(onlineState.isHost)sendAuthoritativeState();else{onlineState.awaitingSync=true;sendOnlinePacket({type:'STATE_REQUEST'});}return;}
    void playPit(m.pit,false,true);
  }

  function generateRoomCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function ensureRoomCode() {
    if(options.online)return cloud.seat?.code===onlineState.roomCode?onlineState.roomCode:'';
    if (!onlineState.roomCode || onlineState.roomCode.length < 3) {
      onlineState.roomCode = generateRoomCode();
    }
    const el = $('online-room-code');
    if (el) el.textContent = onlineState.roomCode;
    return onlineState.roomCode;
  }

  function getShareableGameUrl(roomCode) {
    try {
      if(window.PallanguzhiNative){const base='https://dineshorigin.github.io/heritage/';return roomCode?`${base}?room=${encodeURIComponent(roomCode)}`:base;}
      const loc = window.location;
      if (loc && (loc.protocol === 'http:' || loc.protocol === 'https:') && loc.origin && loc.origin !== 'null') {
        const base = loc.origin + loc.pathname;
        return roomCode ? `${base}?room=${encodeURIComponent(roomCode)}` : base;
      }
    } catch {}
    return '';
  }

  async function copyTextSafe(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  async function shareToWhatsApp(messageText) {
    await copyTextSafe(messageText);
    const encoded = encodeURIComponent(messageText);
    const waWebUrl = `https://wa.me/?text=${encoded}`;
    try {
      const a = document.createElement('a');
      a.href = waWebUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast('📲 Opening WhatsApp (Invite also copied!)', 2200);
    } catch {
      toast('📋 Invite copied! Paste it in WhatsApp.', 2400);
    }
  }

  function attachBroadcastChannel(code){
    try{
      if(onlineState.bc){onlineState.bc.close();onlineState.bc=null;}
      if(typeof BroadcastChannel!=='function')return;
      const generation=onlineState.generation;
      const bc=new BroadcastChannel('pallanguzhi_room_'+code.toLowerCase());
      onlineState.bc=bc;
      bc.onmessage=ev=>{
        if(generation!==onlineState.generation||!ev?.data||!options.online)return;
        if(ev.data.type==='PING'&&ev.data.player===other(onlineState.myPlayerIndex)&&ev.data.roomCode===onlineState.roomCode&&!onlineState.connected){
          onlineStatus('🟢 Connected through local browser channel',true);
          if(onlineState.isHost&&state.started){onlineState.syncPending=true;sendAuthoritativeState();}
        }
        if(ev.data.type==='BC_JOIN_REQUEST'&&onlineState.isHost){
          onlineStatus('Connected · waiting for Ready',true);
          // Respond over the same channel, even if a previous WebRTC path is stale.
          bc.postMessage({type:'CONFIG_SYNC',options:{...options},hostName:names[1]});
          if(state.started){onlineState.syncPending=true;queueMicrotask(sendAuthoritativeState);}
          toast('🎉 Opponent connected!',1800);
        }else handleOnlineMessage(ev.data);
      };
    }catch{onlineState.bc=null;}
  }

  function sendOnlinePacket(payload){return options.online?cloudPacket(payload):false;}

  function initOnlineHost(){
    if(options.online&&onlineState.isHost){void cloudHost();return;}
    if(!options.online||!onlineState.isHost)return;
    const code=ensureRoomCode();
    onlineState.myPlayerIndex=1;
    if(!onlineState.bc)attachBroadcastChannel(code);
    const generation=onlineState.generation;
    if(typeof window.Peer!=='function'){
      onlineStatus('📡 Local tabs ready · Cross-phone requires PeerJS and internet',false);
      return;
    }
    if(onlineState.peer&&!onlineState.peer.destroyed){if(onlineState.peer.disconnected){try{onlineState.peer.reconnect();}catch{}}return;}
    onlineStatus('📡 Opening room '+code+'…',false);
    try{
      const peer=new window.Peer('pallanguzhi-'+code.toLowerCase());
      onlineState.peer=peer;attachPeerRecovery(peer,generation);
      peer.on('open',()=>{
        if(generation!==onlineState.generation||onlineState.peer!==peer)return;
        onlineStatus('📡 Room '+code+' ready · Waiting for friend…',onlineState.connected);
      });
      peer.on('disconnected',()=>{if(generation===onlineState.generation&&onlineState.peer===peer)scheduleReconnect();});
      peer.on('connection',conn=>{
        if(generation!==onlineState.generation||onlineState.peer!==peer){try{conn.close();}catch{}return;}
        if(onlineState.conn?.open){try{conn.close();}catch{}return;}
        onlineState.conn=conn;setupOnlineConnection();
      });
      peer.on('error',err=>{
        if(generation!==onlineState.generation||onlineState.peer!==peer)return;
        if(err?.type==='unavailable-id'&&state.started){try{peer.destroy();}catch{}onlineState.peer=null;onlineStatus('Room already open on another device. Close it, then reconnect.',false);scheduleReconnect();return;}
        if(err?.type==='unavailable-id'){
          try{peer.destroy();}catch{}
          onlineState.peer=null;onlineState.roomCode=generateRoomCode();ensureRoomCode();
          attachBroadcastChannel(onlineState.roomCode);initOnlineHost();
        }else {onlineStatus('⚠️ Peer signaling unavailable · Local tabs only',onlineState.connected);scheduleReconnect();}
      });
    }catch{onlineStatus('⚠️ Peer signaling unavailable · Local tabs only',false);}
  }

  function joinOnlineRoom(code, resuming=false){
    if(options.online){void cloudJoin(code);return;}
    const cleanCode=String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(!/^[A-Z2-9]{8}$/.test(cleanCode)){toast('Enter a 5-character room code.',1900);return;}
    if(!options.online){toast('Choose Online P2P mode first.',1900);return;}
    resetOnlineConnection({keepRoom:true});
    onlineState.isHost=false;onlineState.myPlayerIndex=2;onlineState.roomCode=cleanCode;names[2]=selfName;
    $('p1-input').value=selfName;
    $('online-room-code').textContent=cleanCode;
    const generation=onlineState.generation;
    attachBroadcastChannel(cleanCode);
    recovery.connectingUntil=Date.now()+20000;
    onlineState.awaitingSync=Boolean(resuming);
    if(resuming){const saved=loadSavedMatch();if(saved)onlineState.revision=saved.onlineRevision||0;}
    onlineStatus('🔄 Connecting to room '+cleanCode+'…',false);
    if(onlineState.bc){try{onlineState.bc.postMessage({type:'BC_JOIN_REQUEST',guestName:selfName});}catch{}}
    if(typeof window.Peer!=='function'){
      // BroadcastChannel works within the same origin; not across two phones.
      if(!onlineState.bc)onlineStatus('⚠️ PeerJS unavailable. Host this game over HTTPS.',false);
      return;
    }
    try{
      const peer=new window.Peer();onlineState.peer=peer;attachPeerRecovery(peer,generation);
      peer.on('open',()=>{
        if(generation!==onlineState.generation||onlineState.peer!==peer)return;
        const conn=peer.connect('pallanguzhi-'+cleanCode.toLowerCase(),{reliable:true});
        onlineState.conn=conn;setupOnlineConnection();
      });
      peer.on('error',()=>{
        if(generation!==onlineState.generation||onlineState.peer!==peer)return;
        recovery.connectingUntil=0;onlineStatus('⚠️ Room unavailable · Check room code or network',onlineState.connected);scheduleReconnect();
      });
    }catch{onlineStatus('⚠️ Peer connection could not start',false);}
  }

  function setupOnlineConnection(){
    const conn=onlineState.conn;
    if(!conn)return;
    const generation=onlineState.generation;
    conn.on('open',()=>{
      if(generation!==onlineState.generation||onlineState.conn!==conn)return;
      onlineStatus('Connected · waiting for Ready',true);
      toast('🎉 Opponent connected!',1500);
      if(onlineState.isHost)sendOnlinePacket({type:'CONFIG_SYNC',options:{...options},hostName:names[1]});
      if(state.started&&onlineState.isHost){onlineState.syncPending=true;sendAuthoritativeState();}
      if(!onlineState.isHost) {sendOnlinePacket({type:'GUEST_HELLO',guestName:selfName});sendOnlinePacket({type:'STATE_REQUEST'});}
    });
    conn.on('data',data=>{
      if(generation===onlineState.generation&&onlineState.conn===conn)handleOnlineMessage(data);
    });
    conn.on('close',()=>{
      if(generation!==onlineState.generation||onlineState.conn!==conn)return;
      onlineState.conn=null;
      // A local BroadcastChannel may still be active; otherwise no more moves.
      onlineStatus('⚠️ Connection closed · Rejoin to continue',false);
      saveStableMatch();scheduleReconnect();
      toast('Opponent disconnected',2400);
    });
    conn.on('error',()=>{
      if(generation===onlineState.generation&&onlineState.conn===conn){onlineStatus('⚠️ Connection problem · Try reconnecting',false);scheduleReconnect();}
    });
  }

  function attachPeerRecovery(peer,generation){
    peer.on('close',()=>{
      if(generation!==onlineState.generation||onlineState.peer!==peer)return;
      onlineState.conn=null;onlineStatus('Connection closed. Reconnecting…',false);
      saveStableMatch();scheduleReconnect();
    });
  }
  function scheduleReconnect(){
    if(options.online){if(cloud.seat&&!cloud.online&&!cloud.opening)cloud.reconnect();return;}
    if(!options.online||!onlineState.roomCode||recovery.timer||recovery.attempt>=8||navigator.onLine===false)return;
    const backoff=Math.min(15000,1000*2**Math.min(recovery.attempt++,4));
    const delay=Math.max(backoff,(recovery.connectingUntil||0)-Date.now());
    recovery.timer=setTimeout(()=>{recovery.timer=null;reconnectRoom(false);},delay);
  }
  function reconnectRoom(manual=true){
    if(options.online&&cloud.seat){if(cloud.online)cloud.sync();else cloud.reconnect();return;}
    if(!options.online||!onlineState.roomCode)return;
    if(manual){recovery.attempt=0;clearTimeout(recovery.timer);recovery.timer=null;}
    if(onlineState.connected){
      if(onlineState.isHost){onlineState.syncPending=true;sendAuthoritativeState();}
      else {onlineState.awaitingSync=true;sendOnlinePacket({type:'STATE_REQUEST'});}
      render();return;
    }
    const room=onlineState.roomCode;
    if(onlineState.isHost)initOnlineHost();
    else joinOnlineRoom(room,state.started);
    scheduleReconnect();
  }
  function finishTossRecovery(){if(recovery.pauseAfterToss||document.hidden){recovery.pauseAfterToss=false;openQuitModal();}}
  function suspendMatch(){
    if(options.online){if(audio)void audio.suspend().catch(()=>{});return;}
    fireworks?.stop();
    if(tutorial.open)tutorialClose();
    if(audio)void audio.suspend().catch(()=>{});
    if(!state.started||state.over)return;
    if(state.awaitingToss){recovery.pauseAfterToss=true;return;}
    openQuitModal();saveStableMatch();
    if(audio)void audio.suspend().catch(()=>{});
  }
  function installNativeLifecycle(){
    let installed=false;
    const install=()=>{
      if(installed||!window.PallanguzhiNative?.App)return;
      installed=true;const App=window.PallanguzhiNative.App;
      void App.addListener('appStateChange',({isActive})=>{
        if(!isActive)suspendMatch();
        else {recovery.lastHeard=Date.now();if(options.online)reconnectRoom(true);}
      });
      void App.addListener('backButton',()=>{if(!handleSystemBack())void App.exitApp();});
    };
    window.addEventListener('pallanguzhi-native-ready',install);install();
  }
  function installRecovery(){
    reliabilityControls();
    $('performance-btn').addEventListener('click',()=>{performanceMode={auto:'light',light:'full',full:'auto'}[performanceMode];saveReliability();reliabilityControls();});
    $('capture-tips-btn').addEventListener('click',()=>{captureTips=!captureTips;saveReliability();reliabilityControls();if(lastCapture)setCaptureFeedback(lastCapture);});
    $('pause-btn').addEventListener('click',openQuitModal);
    $('reconnect-btn').addEventListener('click',()=>reconnectRoom(true));
    document.addEventListener('visibilitychange',()=>{
      recovery.hidden=document.hidden;
      if(document.hidden)suspendMatch();
      else {recovery.lastHeard=Date.now();if(options.online)reconnectRoom(true);}
    });
    window.addEventListener('pagehide',suspendMatch);
    window.addEventListener('offline',()=>{if(options.online){onlineStatus('Offline · Match saved on this phone.',false);saveStableMatch();}});
    window.addEventListener('online',()=>reconnectRoom(true));
    setInterval(()=>{
      if(options.online)return; // Cloudflare transport owns its heartbeat and recovery.
      if(!options.online||!onlineState.roomCode||document.hidden)return;
      if(!onlineState.connected){scheduleReconnect();return;}
      const stale=Date.now()-recovery.lastHeard>6000;if(peerStale!==stale){peerStale=stale;render();}
      if(Date.now()-recovery.lastHeard>15000){
        const stale=onlineState.conn;onlineState.conn=null;try{stale?.close();}catch{}
        onlineStatus('Connection timed out. Reconnecting…',false);saveStableMatch();scheduleReconnect();return;
      }
      sendOnlinePacket({type:'PING',matchId:state.matchId,player:onlineState.myPlayerIndex,roomCode:onlineState.roomCode});
    },3000);
  }

  function handleOnlineMessage(data){
    if(!options.online||!data||typeof data!=='object'||typeof data.type!=='string')return;
    recovery.lastHeard=Date.now();if(peerStale){peerStale=false;render();}
    if(data.type==='MOVE_FINISHED_QUERY'){
      if(!onlineState.connected||data.protocol!==PLAYBACK_PROTOCOL||data.matchId!==state.matchId||data.sender!==other(onlineState.myPlayerIndex)||data.rev!==onlineState.revision||data.round!==state.round||!Number.isInteger(data.seq)||data.seq<state.metrics.moves-8||data.seq>state.metrics.moves+1||![1,2].includes(data.mover))return;
      const done=playback.lookup(data);if(done)sendOnlinePacket({type:'MOVE_FINISHED',protocol:PLAYBACK_PROTOCOL,...done.context,sender:onlineState.myPlayerIndex,digest:done.digest});return;
    }
    if(data.type==='MOVE_FINISHED'){
      if(!onlineState.connected||data.protocol!==PLAYBACK_PROTOCOL||data.matchId!==state.matchId||data.sender!==other(onlineState.myPlayerIndex)||data.rev!==onlineState.revision||data.round!==state.round||!Number.isInteger(data.seq)||data.seq<state.metrics.moves||data.seq>state.metrics.moves+1||![1,2].includes(data.mover))return;
      playback.receive({matchId:data.matchId,round:data.round,seq:data.seq,rev:data.rev,mover:data.mover},data.digest);maybeCompleteOnlineMove();return;
    }
    if(data.type==='ROOM_PACE'){if(onlineState.isHost||!onlineState.connected||data.matchId!==state.matchId)return;options.pace=validRoomPace(data.pace);options.fast=options.pace==='fast';updatePaceUI();saveSettings();return;}
    if(data.type==='TURN_CLOCK'){if(onlineState.connected&&validRemoteClock(data,{key:clockKey(),player:other(onlineState.myPlayerIndex),duration:options.turnSeconds,matchId:state.matchId})){remoteClock={...data,at:performance.now(),running:false};updateTurnClock();}return;}
    if(data.type==='LOBBY_READY'){
      if(data.protocol!==PLAYBACK_PROTOCOL){toast('Both phones must update to v3.21 or later.',2500);return;}
      if(!onlineState.connected||state.started||!acceptReady(data,{room:onlineState.roomCode,player:other(onlineState.myPlayerIndex),signature:lobbySignature(options)}))return;
      lobby.remoteReady=data.ready;lobby.remoteSignature=data.signature;names[other(onlineState.myPlayerIndex)]=safeRemoteName(data.name,'Player 2');updateOnlineControls();return;
    }
    if(data.type==='CHAT'){features?.receive(data);return;}
    if(data.type==='PING'){sendOnlinePacket({type:'PONG',matchId:state.matchId});return;}
    if(data.type==='PONG')return;
    if(data.type==='PAUSE_REQUEST'){
      if(!onlineState.isHost||!onlineState.connected||data.matchId!==state.matchId||data.player!==other(onlineState.myPlayerIndex)||!state.started||state.over||state.awaitingToss||typeof data.id!=='string'||data.id.length>100)return;
      if(data.action==='resume'){if(pauseBudget.resume(data.player,Date.now()))publishPause();return;}
      if(data.action!=='start')return;
      const before=pauseBudget.snapshot(Date.now()),r=pauseBudget.request(data.player,data.id,Date.now());const pause=r.accepted?publishPause():r.state;
      sendOnlinePacket({type:'PAUSE_RESULT',matchId:state.matchId,id:data.id,accepted:r.accepted,created:r.accepted&&!before.owner,pause});return;
    }
    if(data.type==='PAUSE_STATE'||data.type==='PAUSE_RESULT'){
      if(onlineState.isHost||!onlineState.connected||data.matchId!==state.matchId||!validPauseState(data.pause))return;
      applyRoomPause(data.pause);
      if(data.type==='PAUSE_RESULT'){const pending=pauseRequests.get(data.id);if(pending){clearTimeout(pending.timer);pauseRequests.delete(data.id);pending.done({accepted:data.accepted===true,created:data.created===true});}else if(data.accepted&&data.created&&data.pause.owner===onlineState.myPlayerIndex)resumeOwnedPause();}return;
    }
    if(data.type==='PLAYER_PAUSE')return;
    if(data.type==='REMATCH_READY'){
      if(!onlineState.connected||!state.started||data.matchId!==state.matchId)return;
      rematch.remoteReady=true;updateRematchUI();tryStartRematch();
    }else if(data.type==='ROOM_BUSY'){
      onlineStatus('⚠️ Host is in a match. Ask for a new match.',false);
    }else if(data.type==='CONFIG_SYNC'){
      if(onlineState.isHost)return;
      onlineStatus('🟢 Connected to '+safeRemoteName(data.hostName,'Host'),true);
      const oldSignature=lobbySignature(options);applyRemoteRules(data.options);
      if(oldSignature!==lobbySignature(options)){resetLobbyReady();broadcastReady();}
      names[2]=selfName;
      names[1]=safeRemoteName(data.hostName,'Player 1');
      syncSetupModalUI();applyPlayerLabels();
      sendOnlinePacket({type:'GUEST_HELLO',guestName:selfName});
      if(onlineState.awaitingSync)sendOnlinePacket({type:'STATE_REQUEST'});
    }else if(data.type==='GUEST_HELLO'){
      if(!onlineState.isHost)return;
      onlineStatus('Connected · waiting for Ready',true);
      names[2]=safeRemoteName(data.guestName,'Player 2');
      $('p2-input').value=names[2];updateLobbyUI();applyPlayerLabels();render();
      if(state.started){onlineState.syncPending=true;queueMicrotask(sendAuthoritativeState);}
    }else if(data.type==='STATE_REQUEST'){
      if(!onlineState.isHost||!onlineState.connected)return;
      if(onlineState.awaitingPlayback&&pendingCompletion){recoverPlayback();return;}
      onlineState.syncPending=true;sendAuthoritativeState();
    }else if(data.type==='UNDO_REQUEST'){
      if(!onlineState.isHost||!onlineState.connected||typeof data.matchId!=='string')return;
      if(!Number.isInteger(data.seq)||!Number.isInteger(data.rev)||!Number.isInteger(data.round))return;
      onlineState.pendingUndoRequest=data;
      processPendingUndo();
    }else if(data.type==='UNDO_AVAILABLE'){
      if(onlineState.isHost||!onlineState.connected||data.matchId!==state.matchId||data.rev!==onlineState.revision||!Number.isInteger(data.seq)||data.seq<state.metrics.moves)return;
      onlineState.remoteUndoAvailable=Boolean(data.available);
      updateAssistButtons();
    }else if(data.type==='UNDO_REJECT'){
      if(onlineState.isHost||data.matchId!==state.matchId)return;
      onlineState.undoPending=false;updateAssistButtons();render();
      toast('Undo no longer available. Board resynchronizing.',2200);
    }else if(data.type==='STATE_SYNC'){
      if(data.protocol!==PLAYBACK_PROTOCOL){toast('Both phones must update to v3.21 or later.',2500);return;}
      if(onlineState.isHost||!onlineState.connected||!data.position||!data.names)return;
      if(state.activeMove||(state.busy&&!onlineState.awaitingPlayback)){recovery.pendingSync=data;return;}
      const pos=data.position;
      const priorClock=clockView?.key===clockKey()&&state.turn===onlineState.myPlayerIndex?{...clockView}:null;
      const keepResult=state.resultRecorded&&state.matchId===data.matchId&&state.over&&pos.over===true;
      const previousStats=state.recordedStatsBefore;
      if(!Number.isInteger(data.rev)||data.rev<0||data.rev>10000)return;
      if(typeof data.matchId!=='string'||data.matchId.length>90||!validPosition({...pos,pendingRound:pos.over===true||pos.roundPending===true,options:{seedsPerPit:data.options?.seedsPerPit||options.seedsPerPit}})||!Array.isArray(pos.kasiePits)||!Array.isArray(pos.banks)||typeof pos.metrics!=='object'||!Number.isInteger(pos.round)||pos.round<1)return;
      const restoredNotice=recoveryNotice({matchId:state.matchId,round:state.round,moves:state.metrics.moves},{matchId:data.matchId,round:pos.round,moves:pos.metrics.moves});
      applyRemoteRules(data.options);
      restoreTournament(pos.tournament);
      if(state.resultRecorded&&pos.metrics?.moves<state.metrics.moves)rollbackFinishedResult();
      invalidateMatch();
      state.pits=pos.pits.slice();state.banks=pos.banks.slice();state.turn=pos.turn;
      state.kasiePits=normalizeKasie(pos.kasiePits);state.round=normalizeRound(pos.round);
      rematch.localReady=false;rematch.remoteReady=false;
      state.roundPending=pos.roundPending===true;state.over=pos.over===true||state.roundPending;
      state.awaitingToss=false;state.paused=isModalOpen('quit-modal');onlineState.remotePaused=pos.paused===true;state.started=true;state.history=[];
      state.metrics=cleanMetrics(pos.metrics);state.matchId=data.matchId;
      state.currentRoundStarter=[1,2].includes(pos.currentRoundStarter)?pos.currentRoundStarter:1;
      state.matchStartedAt=Number.isFinite(pos.matchStartedAt)?pos.matchStartedAt:Date.now();
      state.recordedStatsBefore=keepResult?previousStats:null;state.resultRecorded=keepResult;
      names[1]=safeRemoteName(data.names[1],'Player 1');names[2]=safeRemoteName(data.names[2],'Player 2');
      $('p1-input').value=names[1];$('p2-input').value=names[2];
      onlineState.awaitingSync=false;onlineState.undoPending=false;
      onlineState.revision=data.rev;
      onlineState.remoteUndoAvailable=Boolean(data.undoAvailable);
      onlineState.pendingRemoteMoves=[];
      applyPlayerLabels();
      $('round-brand-sub').textContent=options.format==='kasie'?`ROUND ${state.round} · KASIE TOURNAMENT`:'SINGLE MATCH';
      ['setup-modal','end-modal','coin-toss-modal','round-modal'].forEach(id=>$(id).classList.add('hidden'));
      if(validPauseState(pos.pause))applyRoomPause(pos.pause);
      if(priorClock?.key===clockKey())turnClock.restore(clockKey(),priorClock.remaining,options.turnSeconds);
      render();saveStableMatch();if(restoredNotice)sessionNotice(restoredNotice);
      if(state.roundPending)showRoundSummary();
      else if(state.over)finishMatch();
      else setStatus(`🌐 Reconnected · ${names[state.turn]}'s turn.`);
      processRemoteQueue();
    }else if(data.type==='START_GAME'){
      if(data.protocol!==PLAYBACK_PROTOCOL){toast('Both phones must update to v3.21 or later.',2500);return;}
      if(onlineState.isHost||!onlineState.connected||data.matchId===state.matchId||!Number.isInteger(data.starter)||![1,2].includes(data.starter)||typeof data.matchId!=='string'||data.matchId.length>90)return;
      applyRemoteRules(data.options);
      if(!data.names||typeof data.names!=='object')return;
      names[1]=safeRemoteName(data.names[1],'Player 1');
      names[2]=safeRemoteName(data.names[2],'Player 2');
      $('p1-input').value=names[1];$('p2-input').value=names[2];
      syncSetupModalUI();startGame(false,data.starter,data.matchId);
    }else if(data.type==='MOVE'){
      if(!onlineState.connected||!state.started||typeof data.matchId!=='string'||data.matchId!==state.matchId||data.rev!==onlineState.revision||!Number.isInteger(data.pit)||data.pit<0||data.pit>=N||!Number.isInteger(data.seq)||data.seq<0||data.seq>10000||!Number.isInteger(data.round)||data.round<state.round||data.round>state.round+1||![1,2].includes(data.player)||data.player===onlineState.myPlayerIndex||owner(data.pit)!==data.player)return;
      if(data.round===state.round&&data.seq<state.metrics.moves)return;
      if(onlineState.pendingRemoteMoves.some(m=>m.matchId===data.matchId&&m.seq===data.seq&&m.round===data.round))return;
      if(onlineState.pendingRemoteMoves.length>=12)onlineState.pendingRemoteMoves.shift();
      onlineState.pendingRemoteMoves.push({type:'MOVE',position:typeof data.position==='string'?data.position.slice(0,500):null,pit:data.pit,player:data.player,matchId:data.matchId,seq:data.seq,round:data.round,rev:data.rev});
      processRemoteQueue();
    }else if(data.type==='NEXT_ROUND'){
      if(onlineState.isHost||!onlineState.connected||data.matchId!==state.matchId||data.rev!==onlineState.revision||!Number.isInteger(data.fromRound)||data.fromRound<state.round||data.fromRound>state.round+1||![1,2].includes(data.starter))return;
      onlineState.pendingNextRound={matchId:data.matchId,fromRound:data.fromRound,starter:data.starter};
      processPendingNextRound();
    }else if(data.type==='REACTION'){
      if(!onlineState.connected||typeof data.emoji!=='string'||!['👏','😄','🎉','🤝'].includes(data.emoji))return;
      showEmoteReaction(data.emoji,other(onlineState.myPlayerIndex));
    }
  }

  function positionFingerprint(){return [state.round,state.metrics.moves,state.turn,state.pits.join(','),state.banks.join(','),state.kasiePits.map(Number).join('')].join('|');}
  function sendOnlineMove(pit){
    if(options.online&&onlineState.connected)
      return sendOnlinePacket({type:'MOVE',position:positionFingerprint(),pit,player:state.turn,round:state.round,seq:state.metrics.moves,matchId:state.matchId,rev:onlineState.revision});
  }

  function showEmoteReaction(emoji, fromPlayer) {
    const el = document.createElement('div');
    el.className = 'emote-reaction';
    el.textContent = emoji;
    const pos = center(fromPlayer === 1 ? 'mc-1' : 'mc-2');
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    document.body.append(el);
    beadImpact('pickup', 0.8);
    setTimeout(() => el.remove(), 1250);
  }

  function loadSavedMatch(){
    const raw=storedGet(PROGRESS_KEY);if(!raw)return null;
    try{
      const data=JSON.parse(raw);
      if(data.version!==1 || typeof data.matchId!=='string' || !validPosition(data))throw new Error('invalid position');
      if(!data.options || typeof data.options!=='object' || !data.names || typeof data.names!=='object')throw new Error('invalid metadata');
      const history=Array.isArray(data.history)?data.history.slice(-40).filter(h=>validPosition({...h,options:data.options})).map(h=>({
        ...h,metrics:cleanMetrics(h.metrics),
        kasiePits:normalizeKasie(h.kasiePits),round:normalizeRound(h.round)
      })):[];
      const safeOptions={
        ai:typeof data.options.ai==='boolean'?data.options.ai:true,
        online:typeof data.options.online==='boolean'?data.options.online:false,
        difficulty:['easy','medium','hard','expert'].includes(data.options.difficulty)?data.options.difficulty:'medium',
        theme:'bright',uiTheme:options.uiTheme,
        seedStyle:['natural','colored','cowrie'].includes(data.options.seedStyle)?data.options.seedStyle:'natural',
        pace:['natural','relaxed','fast'].includes(data.options.pace)?data.options.pace:'natural',
        sound:typeof data.options.sound==='boolean'?data.options.sound:true,
        seedVolume:options.seedVolume,uiVolume:options.uiVolume,comfortVersion:1,
        volume:typeof data.options.volume==='number'&&Number.isFinite(data.options.volume)?Math.max(0,Math.min(1,data.options.volume)):.65,
        firstMove:'coin',coinCall:data.options.coinCall==='tails'?'tails':'heads',
        format:['kasie','single'].includes(data.options.format)?data.options.format:'kasie',
        seedsPerPit:[4,5].includes(data.options.seedsPerPit)?data.options.seedsPerPit:5,
        turnSeconds:validClockSeconds(data.options.turnSeconds),pasu:['on','off'].includes(data.options.pasu)?data.options.pasu:'on'
      };
      return {...data,history,options:safeOptions,
        names:{1:String(data.names[1]||'Player 1').slice(0,18),2:String(data.names[2]||'Player 2').slice(0,18)},
        metrics:cleanMetrics(data.metrics),kasiePits:normalizeKasie(data.kasiePits),
        round:normalizeRound(data.round),currentRoundStarter:[1,2].includes(data.currentRoundStarter)?data.currentRoundStarter:1,
        pendingRound:data.pendingRound===true,
        onlineRoomCode:typeof data.onlineRoomCode==='string'&&/^[A-Z2-9]{8}$/.test(data.onlineRoomCode)?data.onlineRoomCode:null,
        onlineIsHost:data.onlineIsHost===true,onlineRevision:Number.isInteger(data.onlineRevision)&&data.onlineRevision>=0?data.onlineRevision:0};
    }catch{storedRemove(PROGRESS_KEY);return null;}
  }

  function refreshResumePanel(){
    const saved=loadSavedMatch(),panel=$('resume-panel');if(!panel)return;
    panel.hidden=!saved;
    if(saved){
      const when=new Date(saved.savedAt||0);
      const date=Number.isNaN(when.getTime())?'Recently':when.toLocaleString(getLanguage()==='ta'?'ta-IN':'en-IN',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      const playMode=saved.options.online?(saved.onlineRoomCode?'Online · reconnect room '+saved.onlineRoomCode:'Online · offline recovery'):(saved.options.ai?'Computer · '+saved.options.difficulty:'2 Players');
      $('resume-summary').textContent=`${saved.names[1]} vs ${saved.names[2]} · ${playMode} · Turn: ${saved.names[saved.turn]} · ${date}.`;
    }
  }

  function saveStableMatch(){
    if(practice)return;
    if(!state.started||state.activeMove||state.busy||(state.over&&!state.roundPending))return;
    const pos={version:1,matchId:state.matchId,savedAt:Date.now(),
      pits:state.pits.slice(),banks:state.banks.slice(),turn:state.turn,
      history:state.history.slice(-40).map(h=>({pits:h.pits.slice(),banks:h.banks.slice(),turn:h.turn,
        kasiePits:normalizeKasie(h.kasiePits),round:normalizeRound(h.round),metrics:cleanMetrics(h.metrics)})),
      metrics:{...state.metrics},matchStartedAt:state.matchStartedAt,
      kasiePits:state.kasiePits.slice(),round:state.round,currentRoundStarter:state.currentRoundStarter,
      pendingRound:state.roundPending===true,
      onlineRoomCode:options.online?onlineState.roomCode:null,onlineIsHost:options.online?onlineState.isHost:null,onlineRevision:options.online?onlineState.revision:0,
      tournament:{allocations:tournament.allocations.slice(),forcedDraw:tournament.forcedDraw,endReason:tournament.endReason},
      options:{...options},
      roomPause:options.online?{...roomPause,savedAt:Date.now()}:null,
      turnClock:clockView?.key===clockKey()?{key:clockKey(),remaining:clockView.remaining}:null,
      names:{...names}};
    if(validPosition(pos)&&!storedSet(PROGRESS_KEY,pos)&&!saveWarningShown){saveWarningShown=true;sessionNotice('Saving is unavailable on this device. Keep this tab open; closing it may lose your match.');}
  }
  function removeSavedMatch(){if(practice)return;storedRemove(PROGRESS_KEY);refreshResumePanel();}
  function applySavedOptions(saved){
    Object.assign(options,saved.options,{fast:saved.options.pace==='fast'});
    syncSetupModalUI();
    if(audio)audio.pallanguzhiMaster.gain.setTargetAtTime(options.sound?options.volume:0,audio.currentTime,.02);
  }
  function applyPlayerLabels(){
    for(const p of [1,2]){
      $('p'+p+'-label').textContent=names[p];
      $('owner-'+p).textContent=names[p]+' • '+(p===1?'BOTTOM':'TOP');
      $('mc-label-'+p).textContent=names[p];
    }
  }
  function resumeMatch(){
    if(cloud.seat){const savedCloud=loadSavedMatch();if(savedCloud?.options.online){options.online=true;options.ai=false;onlineState.roomCode=cloud.seat.code;onlineState.isHost=cloud.seat.player===1;onlineState.myPlayerIndex=cloud.seat.player;cloud.reconnect();return;}}
    const saved=loadSavedMatch();if(!saved){refreshResumePanel();toast('No valid saved match found.',1800);return;}
    invalidateMatch();
    resetOnlineConnection();
    if(saved.options.online&&saved.onlineRoomCode){
      onlineState.isHost=saved.onlineIsHost;
      onlineState.myPlayerIndex=saved.onlineIsHost?1:2;
      onlineState.roomCode=saved.onlineRoomCode;
      onlineState.awaitingSync=!saved.onlineIsHost;onlineState.revision=saved.onlineRevision;
    }else if(saved.options.online){
      // Legacy online saves had no room metadata: recover gameplay locally.
      saved.options.online=false;saved.options.ai=false;
    }
    applySavedOptions(saved);
    restoreTournament(saved.tournament);
    names={...saved.names};selfName=names[options.online?onlineState.myPlayerIndex:1]||selfName;if(options.ai&&!options.online)names[2]='Azhagi (AI)';else if(!options.online)passName=names[2];options.theme='bright';$('p1-input').value=names[1];$('p2-input').value=names[2];
    state.pits=saved.pits.slice();state.banks=saved.banks.slice();state.turn=saved.turn;
    state.kasiePits=saved.kasiePits.slice();state.round=saved.round;
    state.currentRoundStarter=saved.currentRoundStarter;
    state.roundPending=saved.pendingRound;
    state.history=saved.history;state.metrics=saved.metrics;
    state.over=Boolean(saved.pendingRound);state.paused=false;state.started=true;state.matchId=saved.matchId;
    $('round-brand-sub').textContent=options.format==='kasie'?`ROUND ${state.round} · KASIE TOURNAMENT`:'SINGLE MATCH';
    state.matchStartedAt=isWhole(saved.matchStartedAt,9e15)?saved.matchStartedAt:Date.now();
    state.recordedStatsBefore=null;state.resultRecorded=false;
    applyPlayerLabels();
    $('setup-modal').classList.add('hidden');$('end-modal').classList.add('hidden');$('stats-modal').classList.add('hidden');$('quit-modal').classList.add('hidden');
    if(options.online){try{let cached=storedGet('pallanguzhi.room.pause');if(typeof cached==='string')cached=JSON.parse(cached);if(cached?.matchId===state.matchId&&validPauseState(cached.pause)&&(!validPauseState(saved.roomPause)||cached.pause.revision>saved.roomPause.revision))saved.roomPause={...cached.pause,savedAt:cached.savedAt};}catch{}}
    if(options.online&&validPauseState(saved.roomPause)){const rem=Math.max(0,saved.roomPause.remaining-Math.max(0,Date.now()-(saved.roomPause.savedAt||Date.now())));const restored={...saved.roomPause,owner:rem?saved.roomPause.owner:0,remaining:rem,id:rem?saved.roomPause.id:''};if(onlineState.isHost)pauseBudget.restore(restored,Date.now());applyRoomPause(restored);}
    if(saved.turnClock?.key===clockKey()&&Number.isFinite(saved.turnClock.remaining))turnClock.restore(clockKey(),saved.turnClock.remaining,options.turnSeconds);
    render();setStatus(`💾 Match resumed · ${names[state.turn]}'s turn.`);
    ensureAudio();
    if(options.online){
      if(onlineState.isHost)initOnlineHost();else if(onlineState.roomCode)joinOnlineRoom(onlineState.roomCode,true);
      setStatus(onlineState.isHost?`💾 Match restored · Share room ${onlineState.roomCode} to reconnect.`:'💾 Match restored · Reconnecting to host…');
    }
    if(state.roundPending){showRoundSummary();return;}
    if(options.ai&&state.turn===2)scheduleAiTurn(()=>state.started&&!state.over);
  }
  function discardSavedMatch(){removeSavedMatch();toast('Saved match discarded. Start a new game.',1600);}

  function defaultStats(){return {matches:0,wins:0,losses:0,draws:0,streak:0,bestStreak:0,bestScore:0,pasu:0,captured:0,expertWins:0,history:[]};}
  function loadStats(){
    try{
      const v=JSON.parse(storedGet(STATS_KEY)||'null');
      if(!v||v.version!==1||typeof v!=='object')return defaultStats();
      const clean=defaultStats();
      for(const key of Object.keys(clean))if(key!=='history'&&isWhole(v[key],1_000_000))clean[key]=v[key];
      if(Array.isArray(v.history))clean.history=v.history.slice(0,20).filter(r=>r&&typeof r==='object'&&[1,2].every(p=>isWhole(r['score'+p])) && ['win','loss','draw'].includes(r.result)).map(r=>({
        at:isWhole(r.at,9e15)?r.at:0,result:r.result,score1:r.score1,score2:r.score2,
        ai:Boolean(r.ai),difficulty:String(r.difficulty||'medium').slice(0,12),
        name:String(r.name||'Player 1').slice(0,18)
      }));
      return clean;
    }catch{return defaultStats();}
  }
  function saveStats(){storedSet(STATS_KEY,{version:1,...stats});}
  const achievements=[
    {id:'first',emoji:'🏆',name:'First Victory',desc:'Win your first match',value:()=>stats.wins,goal:1},
    {id:'wins5',emoji:'⭐',name:'Five Victories',desc:'Win 5 matches',value:()=>stats.wins,goal:5},
    {id:'pasu10',emoji:'🌰',name:'Pasu Master',desc:'Earn 10 Pasu bonuses as Player 1',value:()=>stats.pasu,goal:10},
    {id:'expert',emoji:'👑',name:'Expert Challenger',desc:'Beat Expert AI',value:()=>stats.expertWins,goal:1},
    {id:'ten',emoji:'🎯',name:'Heritage Regular',desc:'Complete 10 matches',value:()=>stats.matches,goal:10}
  ];
  function achieved(){return achievements.filter(a=>a.value()>=a.goal).map(a=>a.id);}
  function recordFinishedMatch(){
    if(practice)return;
    if(state.resultRecorded)return;
    const before=achieved();
    state.recordedStatsBefore=JSON.parse(JSON.stringify(stats));
    state.resultRecorded=true;
    const s1=state.banks[1],s2=state.banks[2];
    const result=tournament.forcedDraw||s1===s2?'draw':s1>s2?'win':'loss';
    stats.matches++;
    if(result==='win'){
      stats.wins++;stats.streak++;
      if(options.ai&&options.difficulty==='expert')stats.expertWins++;
    }else{
      if(result==='loss')stats.losses++;else stats.draws++;
      stats.streak=0;
    }
    stats.bestStreak=Math.max(stats.bestStreak,stats.streak);
    stats.bestScore=Math.max(stats.bestScore,s1);
    stats.pasu+=state.metrics.p1Pasu;
    stats.captured+=state.metrics.p1Captured;
    stats.history.unshift({at:Date.now(),result,score1:s1,score2:s2,ai:options.ai,difficulty:options.difficulty,name:names[1]});
    stats.history=stats.history.slice(0,20);
    saveStats();
    const unlocked=achievements.filter(a=>!before.includes(a.id)&&a.value()>=a.goal);
    $('new-unlocks').hidden=unlocked.length===0;
    $('new-unlocks').textContent=unlocked.length?'🏅 Achievement unlocked: '+unlocked.map(a=>a.emoji+' '+a.name).join(' · '):'';
  }
  function rollbackFinishedResult(){
    if(state.resultRecorded&&state.recordedStatsBefore){
      stats=state.recordedStatsBefore;
      saveStats();
    }
    state.resultRecorded=false;state.recordedStatsBefore=null;
    $('new-unlocks').hidden=true;
  }
  function renderStats(){
    const grid=$('stats-grid');grid.replaceChildren();
    const rate=stats.matches?Math.round(stats.wins/stats.matches*100):0;
    const values=[['Matches',stats.matches],['Wins',stats.wins],['Win rate',rate+'%'],
      ['Best streak',stats.bestStreak],['Best score',stats.bestScore],['Pasu bonuses',stats.pasu]];
    for(const [label,value] of values){
      const tile=document.createElement('div');tile.className='stat-tile';
      const strong=document.createElement('strong');strong.textContent=value;
      const small=document.createElement('small');small.textContent=label;
      tile.append(strong,small);grid.append(tile);
    }
    const ach=$('achievements');ach.replaceChildren();
    for(const a of achievements){
      const n=Math.min(a.goal,a.value());const done=n>=a.goal;
      const item=document.createElement('div');item.className='achievement-row'+(done?' unlocked':'');
      const emoji=document.createElement('span');emoji.className='achievement-icon';emoji.textContent=a.emoji;
      const content=document.createElement('div');content.className='achievement-content';
      const title=document.createElement('div');title.className='achievement-name';title.textContent=a.name+(done?' · Unlocked ✓':'');
      const desc=document.createElement('div');desc.className='achievement-detail';desc.textContent=`${a.desc} · ${n}/${a.goal}`;
      const bar=document.createElement('div');bar.className='achievement-progress';const fill=document.createElement('span');fill.style.width=n/a.goal*100+'%';bar.append(fill);
      content.append(title,desc,bar);item.append(emoji,content);ach.append(item);
    }
    const hist=$('match-history');hist.replaceChildren();
    if(!stats.history.length){const empty=document.createElement('p');empty.className='difficulty-note';empty.textContent='No completed matches yet. Finish a match to see your journey.';hist.append(empty);}
    else for(const m of stats.history){
      const item=document.createElement('div');item.className='match-record';
      const left=document.createElement('span');
      const d=new Date(m.at);const when=!Number.isNaN(d.getTime())?d.toLocaleDateString(getLanguage()==='ta'?'ta-IN':'en-IN',{month:'short',day:'numeric'}):'—';
      left.textContent=`${when} · ${m.ai?'AI '+m.difficulty:'2 Players'}`;
      const right=document.createElement('strong');right.className=m.result;
      right.textContent=`${m.result==='win'?'Win':m.result==='loss'?'Loss':'Draw'} · ${m.score1}–${m.score2}`;
      item.append(left,right);hist.append(item);
    }
    $('stats-footnote').textContent=`Player 1 results: ${stats.wins} wins · ${stats.losses} losses · ${stats.draws} draws. Records show the latest 20 matches. Totals and achievements stay on this device only.`;
  }
  function openStats(){if(state.busy||state.activeMove){toast('Finish the current move before opening statistics.',1400);return;}renderStats();$('stats-modal').classList.remove('hidden');}
  function closeStats(){$('stats-modal').classList.add('hidden');}
  function resetStats(){
    const btn = $('reset-stats-btn');
    if (btn && btn.dataset.confirming !== 'true') {
      btn.dataset.confirming = 'true';
      btn.textContent = '⚠️ Tap again to confirm erase';
      clearTimeout(resetStatsConfirmTimer);
      resetStatsConfirmTimer = setTimeout(() => {
        btn.dataset.confirming = 'false';
        btn.textContent = '🗑 Clear match statistics';
      }, 3500);
      return;
    }
    if (btn) {
      btn.dataset.confirming = 'false';
      btn.textContent = '🗑 Clear match statistics';
    }
    clearTimeout(resetStatsConfirmTimer);
    stats=defaultStats();state.recordedStatsBefore=null;saveStats();renderStats();toast('Statistics cleared.',1300);
  }

  function playCoinSound() {
    const ctx = ensureAudio();
    if (!ctx || !options.sound || options.volume === 0) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2200, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.45);
      gain.gain.setValueAtTime(0.06 * options.volume, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      osc.connect(gain);
      gain.connect(ctx.pallanguzhiUI);
      osc.start(t);
      osc.stop(t + 0.46);

      [0.48, 0.54, 0.58].forEach((delay, i) => {
        const o2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(2800 + i * 200, t + delay);
        g2.gain.setValueAtTime((0.05 - i * 0.012) * options.volume, t + delay);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.04);
        o2.connect(g2);
        g2.connect(ctx.pallanguzhiUI);
        o2.start(t + delay);
        o2.stop(t + delay + 0.045);
      });
    } catch {}
  }

  function launchCoinToss(onComplete, forcedWinner=null) {
    const modal = $('coin-toss-modal');
    const coin = $('toss-coin');
    const resultText = $('toss-result-text');
    const startBtn = $('toss-start-btn');

    modal.classList.remove('hidden');
    startBtn.disabled = true;
    coin.style.transition = 'none';
    coin.style.transform = 'rotateY(0deg)';
    void coin.offsetWidth;

    const winner = (forcedWinner === 1 || forcedWinner === 2) ? forcedWinner : (Math.random() < 0.5 ? 1 : 2);
    const tossEpoch=state.epoch;
    resultText.textContent=getLanguage()==='ta'?`${displayName(1)}: ${options.coinCall==='heads'?'தலை':'பூ'} · நாணயம் சுழல்கிறது…`:`${names[1]} called ${options.coinCall}. Flipping the coin…`;

    playCoinSound();
    coin.style.transition = 'transform 2.2s cubic-bezier(0.18, 0.89, 0.32, 1.05)';
    const face=coinOutcome(winner,options.coinCall).face;
    const finalRot = 1800 + (face === 'tails' ? 180 : 0);
    coin.style.transform = `rotateY(${finalRot}deg)`;

    let finished = false;
    const finalize = () => {
      if (finished||tossEpoch!==state.epoch||modal.classList.contains('hidden')) return;
      finished = true;
      modal.classList.add('hidden');
      onComplete(winner);
    };

    setTimeout(() => {
      if(tossEpoch!==state.epoch||modal.classList.contains('hidden'))return;
      const winnerName = names[winner];
      resultText.textContent=getLanguage()==='ta'?`${face==='heads'?'தலை':'பூ'} · ${winnerName} வென்றார்! முதலில் ஆடுவார்.`:`${face==='heads'?'Heads':'Tails'} · ${winnerName} won the toss! Sowing first.`;
      startBtn.disabled = false;
      startBtn.onclick = finalize;
      setTimeout(() => {
        if (!modal.classList.contains('hidden')) finalize();
      }, 1600);
    }, 2250);
  }

  function simulateMove(pits,banks,player,selected,config=null) {
    return simulateRules(pits,banks,player,selected,{locked:state.kasiePits,pasu:options.pasu,...(config || {})});
  }

  /* Single, authoritative validMoves definition with Kasie pit filtering */
  function validMoves(player, pits=state.pits, locked=state.kasiePits){
    return row(player).filter(i => (!locked || !locked[i]) && pits[i] > 0);
  }

  function settleIfFinished(pits, banks) {
    const p1Moves = row(1).filter(i => (!state.kasiePits || !state.kasiePits[i]) && pits[i] > 0);
    const p2Moves = row(2).filter(i => (!state.kasiePits || !state.kasiePits[i]) && pits[i] > 0);
    if (p1Moves.length > 0 && p2Moves.length > 0) return false;

    for (let i = 0; i < N; i++) {
      if (!state.kasiePits || !state.kasiePits[i]) {
        banks[owner(i)] += pits[i];
        pits[i] = 0;
      }
    }
    return true;
  }

  function createBoard() {
    for (const [target, indices] of [['row-top',[13,12,11,10,9,8,7]],['row-bottom',[0,1,2,3,4,5,6]]]) {
      const fragment = document.createDocumentFragment();
      for (const index of indices) {
        const slot = document.createElement('div'); slot.className='pit-slot';
        const pit = document.createElement('button');
        pit.type='button'; pit.className='pit'; pit.id='pit-'+index;pit.dataset.owner=String(owner(index));
        const point=referenceCup(index);
        pit.style.setProperty('--cup-x',point.x+'%');
        pit.style.setProperty('--cup-y',point.y+'%');
        pit.style.setProperty('--cup-w',point.width+'%');pit.style.setProperty('--cup-h',point.height+'%');
        const badgeY=index<7?91:8;pit.style.setProperty('--count-y',((badgeY-point.y+point.height/2)/point.height*100)+'%');
        pit.addEventListener('click', e=>{if(e.detail>0&&performance.now()<boardGestureUntil)return;playPit(index);});
        slot.append(pit); fragment.append(slot);
      }
      $(target).append(fragment);
    }
    render();
  }

  const pieceWord=()=>options.seedStyle==='cowrie'?'cowries':options.seedStyle==='colored'?'beads':'seeds';
  function getSeedClass(index, serial) {
    if(options.seedStyle === 'cowrie') return 'seed-cowrie';
    if(options.seedStyle === 'colored') return 'seed-colored-' + ((index + serial) % 3);
    return 'seed-natural';
  }

  function seedNode(index, serial, store=false) {
    const el=document.createElement('span');
    const color=getSeedClass(index, serial);
    el.className='tamarind-seed '+color;
    const point=shellPosition(index,serial,store?30:20,store);
    el.style.left=point.x+'%';el.style.top=point.y+'%';
    const rotation=((serial*53+index*17)%105-50)+'deg';
    el.style.setProperty('--rot',rotation);
    el.style.transform='translate(-50%,-50%) rotate('+rotation+')';
    el.dataset.serial=String(serial);
    return el;
  }

  function nudgeNearbyBeads(pitIndex){
    if(options.fast||reducedMotion()||matchMedia('(pointer:coarse)').matches)return;
    const beads=Array.from($('pit-'+pitIndex).querySelectorAll('.seed-pit-cluster .tamarind-seed'));
    for(const bead of beads.slice(-3,-1)){
      const angle=Number(bead.dataset.serial||1)*2.4;
      const tx=(Math.cos(angle)*2.3).toFixed(1),ty=(Math.sin(angle)*1.7).toFixed(1);
      const rest=bead.style.transform;
      try{bead.animate([
        {transform:rest},{transform:rest+` translate(${tx}px,${ty}px)`,offset:.43},
        {transform:rest,offset:1}
      ],{duration:215,easing:'ease-out'});}catch{}
    }
  }

  function paintPit(index,landed=false){
    const el=$('pit-'+index);if(!el)return;
    const isKasie = Boolean(state.kasiePits && state.kasiePits[index]);
    el.classList.toggle('kasie', isKasie);

    const count=state.pits[index];
    let cluster=el.querySelector('.seed-pit-cluster');
    let countNode=el.querySelector('.pit-count');
    if(!cluster){cluster=document.createElement('span');cluster.className='seed-pit-cluster';el.append(cluster);}
    if(!countNode){countNode=document.createElement('span');countNode.className='pit-count';el.append(countNode);}
    const target=Math.min(count,lightEffects()?12:20);
    while(cluster.children.length>target)cluster.lastElementChild.remove();
    const old=cluster.children.length;
    for(let j=old;j<target;j++){
      const bead=seedNode(index,j);
      if(landed&&j===target-1){
        bead.classList.add('seed-landed');
        bead.addEventListener('animationend', () => bead.classList.remove('seed-landed'), { once: true });
      }
      cluster.append(bead);
    }
    Array.from(cluster.children).forEach((bead,j)=>{
      const point=shellPosition(index,j,target);
      bead.style.left=point.x+'%';bead.style.top=point.y+'%';
      bead.style.zIndex=String(point.layer||0);
      const color=getSeedClass(index, j);
      if(!bead.classList.contains(color)){
        bead.className='tamarind-seed '+color;
        if(landed&&j===target-1){
          bead.classList.add('seed-landed');
          bead.addEventListener('animationend', () => bead.classList.remove('seed-landed'), { once: true });
        }
      }
    });
    if(landed&&target>old)nudgeNearbyBeads(index);
    countNode.textContent=count;
    
    // In online mode, you can only play your assigned player side!
    const isMyTurnOnline = !options.online || (onlineState.connected && !peerStale && !onlineState.awaitingSync && !onlineState.undoPending && state.turn === onlineState.myPlayerIndex);
    const playable=state.started&&!state.busy&&!state.over&&!state.paused&&!onlineState.remotePaused&&!state.awaitingToss&&!isKasie&&count>0&&owner(index)===state.turn&&!(options.ai&&state.turn===2)&&isMyTurnOnline;
    el.disabled=!playable;el.classList.toggle('playable',playable);
    el.classList.toggle('hinted',state.hintPit===index && playable);
    el.setAttribute('aria-label',pitDescription({name:displayName(owner(index)),cup:index<7?index+1:14-index,count,locked:isKasie,playable,ta:getLanguage()==='ta'}));
  }

  function paintBank(player,newlyAdded=0){
    const total=state.banks[player];
    const bank=$('mc-pile-'+player);
    const visible=Math.min(total,lightEffects()?18:30);
    while(bank.children.length>visible)bank.lastElementChild.remove();
    const old=bank.children.length;
    for(let i=old;i<visible;i++){
      const bead=seedNode(player,i,true);
      if(newlyAdded){
        bead.classList.add('seed-landed');
        bead.addEventListener('animationend', () => bead.classList.remove('seed-landed'), { once: true });
      }
      bead.style.animationDelay=Math.min(140,(i-old)*17)+'ms';
      bank.append(bead);
    }
    Array.from(bank.children).forEach((bead,j)=>{
      const point=shellPosition(player,j,visible,true);
      bead.style.left=point.x+'%';bead.style.top=point.y+'%';
      bead.style.zIndex=String(point.layer||0);
      const color=getSeedClass(player, j);
      if(!bead.classList.contains(color))bead.className='tamarind-seed '+color;
    });
    $('mc-count-'+player).textContent=total;$('p'+player+'-score').textContent=total;
  }

  function displayName(p){return ['Player 1','Player 2','Azhagi (AI)'].includes(names[p])?translate(names[p]):names[p];}
  function updatePlayerDocks(){
    document.body.classList.toggle('table-facing',!options.ai&&!options.online);
    for(const p of [1,2]){
      const active=state.started&&!state.busy&&!state.over&&!state.paused&&!onlineState.remotePaused&&state.turn===p&&!state.awaitingToss&&!state.roundPending&&(!options.online||(onlineState.connected&&!peerStale&&!onlineState.awaitingSync&&!onlineState.undoPending));
      $('dock-name-'+p).textContent=displayName(p);$('dock-score-'+p).textContent=String(state.banks[p]);
      $('dock-turn-'+p).textContent=p===state.turn&&active?'Your turn':'Waiting';
      $('p'+p+'-label').textContent=displayName(p);
      $('side-highlight-'+p).classList.toggle('active',active);
      document.querySelector('.dock-'+p).classList.toggle('active',active);
      $('mc-'+p).classList.toggle('current-thaaikuli',active);
      $('mc-label-'+p).textContent=displayName(p);
      $('mc-label-'+p).title=displayName(p)+' · '+translate('Thaaikuli');
    }
  }
  function render() {
    for(let i=0;i<N;i++) paintPit(i);
    const turnVisible=state.started&&!state.busy&&!state.over&&!state.paused&&!onlineState.remotePaused&&!state.awaitingToss&&(!options.online||(onlineState.connected&&!peerStale&&!onlineState.awaitingSync&&!onlineState.undoPending));
    for(let p=1;p<=2;p++) {
      paintBank(p);
      $('p'+p+'-pod').classList.toggle('active',turnVisible&&state.turn===p);
      $('mc-'+p).classList.toggle('active-owner',turnVisible&&state.turn===p);
      $(p===1?'plank-bottom':'plank-top').classList.toggle('active-side',turnVisible&&state.turn===p);
    }
    updatePlayerDocks();
    const turnState={started:state.started,over:state.over,paused:state.paused||onlineState.remotePaused,awaitingToss:state.awaitingToss,roundPending:state.roundPending,busy:state.busy,turn:state.turn,ai:options.ai,online:options.online,connected:onlineState.connected&&!peerStale,awaitingPlayback:onlineState.awaitingPlayback,awaitingSync:onlineState.awaitingSync,undoPending:onlineState.undoPending,myPlayer:onlineState.myPlayerIndex,names};
    for(const p of [1,2]){const lamp=$('wish-lamp-'+p);lamp.hidden=options.online?p!==onlineState.myPlayerIndex:options.ai?p!==1:false;lamp.disabled=!shouldNotifyTurn(turnState)||p!==state.turn;lamp.classList.toggle('lamp-active',!lamp.disabled);}
    for(const player of [1,2]){const label=playerTurnLabel(turnState,player);$('ind-'+player).textContent=label;$('dock-turn-'+player).textContent=label;}
    if(shouldNotifyTurn(turnState)){
      const key=`${state.matchId}|${state.round}|${state.metrics.moves}|${state.turn}`;
      if(key!==lastTurnNotice){
        lastTurnNotice=key;
        const side=portraitBoard()?(state.turn===1?'left':'right'):(state.turn===1?'bottom':'top');
        toast(`${names[state.turn]}, your turn · ${side} side`,1800);
        turnSound(state.turn);
        const pod=$('p'+state.turn+'-pod');
        if(!reducedMotion()&&typeof pod.animate==='function')pod.animate([{filter:'brightness(1)'},{filter:'brightness(1.65)'},{filter:'brightness(1)'}],{duration:650});
      }
    }
    updateAssistButtons();
    updateOnlineControls();
    $('chat-fab').hidden=!options.online||!state.started;updatePauseUI();
    if(!lastDetail&&state.kasiePits.some(Boolean)){$('capture-detail-btn').hidden=false;document.querySelector('.play-guide').classList.add('has-reason');$('capture-detail-btn').textContent=translate('Kasie help');}
    updatePractice();updateTurnClock();
    $('turn-guide').textContent=turnGuidance({started:state.started,over:state.over,busy:state.busy,paused:state.paused||onlineState.remotePaused,awaitingToss:state.awaitingToss,roundPending:state.roundPending,turn:state.turn,name:names[state.turn],ai:options.ai,online:options.online,connected:onlineState.connected&&!peerStale,myPlayer:onlineState.myPlayerIndex,awaitingPlayback:onlineState.awaitingPlayback,awaitingSync:onlineState.awaitingSync,undoPending:onlineState.undoPending,portrait:matchMedia('(orientation:portrait) and (max-width:700px)').matches});
  }

  function clearCaptureFeedback(){lastCapture=null;lastDetail='';$('capture-guide').textContent='';$('capture-detail-btn').hidden=true;document.querySelector('.play-guide').classList.remove('has-reason');}
  function openExplanation(text){$('capture-detail-copy').textContent=text;$('capture-detail-modal').classList.remove('hidden');$('close-capture-detail').focus({preventScroll:true});}
  function setCaptureFeedback(event){
    lastCapture={...event};lastDetail=captureExplanation(event,state.kasiePits,{1:displayName(1),2:displayName(2)},getLanguage()==='ta');
    $('capture-guide').textContent=captureTips?lastDetail:captureGuidance(names[event.player],event.count,event.kind==='pasu');$('capture-detail-btn').hidden=false;document.querySelector('.play-guide').classList.add('has-reason');$('capture-detail-btn').textContent=translate('Why?');

  }
  function startPractice(){
    if(!practice)practiceOptions={...options};practice=true;practiceGuidance=true;practiceLastHint='';
    if(options.online)resetOnlineConnection();Object.assign(options,{online:false,ai:true,difficulty:'easy',format:'single',seedsPerPit:5,pasu:'on',turnSeconds:0,firstMove:'coin',seedStyle:'cowrie',pace:'natural',fast:false});boardEnlarged=false;fitBoard(true);
    $('practice-end-modal').classList.add('hidden');syncSetupModalUI();startGame(true,1);
  }
  function endPractice(){
    closeAnimations();state.aiTicket++;state.activeMove=null;state.busy=false;state.over=true;state.paused=false;updateSkipButton();hideHintExplanation();render();$('practice-summary').textContent=practiceComplete(state.metrics.moves)?translate('Four turns each. Ready for a full match?'):translate('You finished the practice position. Ready for a full match?');$('practice-end-modal').classList.remove('hidden');$('practice-full-btn').focus({preventScroll:true});
  }
  function updatePractice(){
    $('practice-bar').hidden=!practice||!state.started||state.over;
    if(!practice)return;$('practice-progress').textContent=getLanguage()==='ta'?`பயிற்சி · ${Math.min(8,state.metrics.moves)}/8 நகர்வுகள்`:`Practice · ${Math.min(8,state.metrics.moves)}/8 moves`;
    $('practice-guidance-btn').textContent=practiceGuidance?translate('Hints on'):translate('Hints off');
    const key=clockKey();if(practiceGuidance&&!state.busy&&!state.over&&!state.paused&&state.turn===1&&practiceLastHint!==key){practiceLastHint=key;queueMicrotask(()=>{if(practice&&practiceGuidance&&state.turn===1&&!state.busy&&!state.paused&&!state.over&&state.hintPit===null)showHint();});}
  }

  function clockKey(){return `${state.matchId}|${state.round}|${state.metrics.moves}|${state.turn}`;}
  function clockActive(){return (options.online||!['rules-modal','stats-modal','features-modal','tutorial-modal','capture-detail-modal'].some(isModalOpen))&&state.started&&!state.over&&!state.roundPending&&!state.awaitingToss&&!state.busy&&!state.paused&&!onlineState.remotePaused&&(!document.hidden||options.online)&&!(options.ai&&state.turn===2)&&(!options.online||(onlineState.connected&&!peerStale&&!onlineState.awaitingSync&&!onlineState.undoPending));}
  function updateTurnClock(){
    const now=performance.now(),key=clockKey(),source=!options.online||state.turn===onlineState.myPlayerIndex,active=clockActive();
    clockView=turnClock.step({turnKey:key,duration:options.turnSeconds,active:active&&source,now});
    let seconds=clockView.seconds;
    if(options.online&&!source&&remoteClock?.key===key){if(remoteClock.running)remoteClock.remaining=Math.max(0,remoteClock.remaining-(now-remoteClock.at));remoteClock.at=now;remoteClock.running=active;seconds=Math.ceil(remoteClock.remaining/1000);}
    for(const p of [1,2]){const el=$('turn-clock-'+p);el.hidden=!state.started||state.over||state.roundPending||state.awaitingToss||state.busy||state.paused||onlineState.remotePaused||!options.turnSeconds||p!==state.turn||options.ai&&p===2;el.textContent=String(seconds);el.setAttribute('aria-label',translate('Time to choose a cup')+': '+seconds);el.classList.toggle('clock-urgent',seconds<=10&&p===state.turn);}
    if(!active||!source||!options.turnSeconds){clockTick=-1;return;}
    if(options.online&&now-clockSentAt>=1000){clockSentAt=now;sendOnlinePacket({type:'TURN_CLOCK',matchId:state.matchId,key,player:state.turn,remaining:clockView.remaining});}
    if(seconds<=10&&seconds>0&&clockTick!==seconds){clockTick=seconds;if(!document.hidden)softNotes([seconds<=3?1040:760],.025);}
    if(clockView.expired&&clockHandled!==key){queueMicrotask(()=>{if(clockKey()!==key||!clockActive()||clockHandled===key)return;clockHandled=key;let choice=null;for(const pit of validMoves(state.turn)){try{simulateMove(state.pits,state.banks,state.turn,pit);choice=pit;break;}catch{}}if(choice!==null){toast(getLanguage()==='ta'?'நேரம் முடிந்தது · ஒரு குழி தானாகத் தேர்ந்தெடுக்கப்பட்டது':'Time is up · a legal cup was chosen automatically',2200);void playPit(choice);}else toast(getLanguage()==='ta'?'நகர்த்தக்கூடிய குழியைத் தேர்ந்தெடுக்கவும்':'Choose a playable cup',1800);});}
  }

  function setStatus(text) {$('status-text').textContent=text;}
  function toast(text,ms=1350) {
    clearTimeout(toastTimer); const el=$('toast'); el.textContent=text; el.classList.add('visible');
    toastTimer=setTimeout(()=>el.classList.remove('visible'),ms);
  }

  function fitBoard(recenter=false){
    const stage=document.querySelector('.arena-stage');
    if(!stage)return;
    const size=boardViewport(stage.clientWidth,stage.clientHeight,portraitBoard(),boardEnlarged);
    const arena=$('arena'),canvas=$('board-sizer'),viewport=$('board-scroll');
    for(const key of ['width','height']){
      const value=size[key]+'px';
      if(arena.style.getPropertyValue('--fit-'+key)!==value)arena.style.setProperty('--fit-'+key,value);
    }
    canvas.style.width=size.canvasWidth+'px';canvas.style.height=size.canvasHeight+'px';
    viewport.classList.toggle('enlarged',boardEnlarged);
    $('board-size-btn').textContent=boardEnlarged?'⤡ Whole board':'⤢ Bigger board';
    $('board-size-btn').setAttribute('aria-pressed',String(boardEnlarged));
    if(recenter){viewport.scrollLeft=Math.max(0,(size.canvasWidth-viewport.clientWidth)/2);viewport.scrollTop=Math.max(0,(size.canvasHeight-viewport.clientHeight)/2);}
    layoutDirty=true;
  }
  function invalidateLayout(){ fitBoard();layoutDirty=true; }
  function measureBoard(){
    if(!layoutDirty)return;
    layoutCenters.clear();
    for(let i=0;i<N;i++){
      const r=$('pit-'+i).getBoundingClientRect();
      layoutCenters.set('pit-'+i,{x:r.left+r.width*.5,y:r.top+r.height*.5});
    }
    for(const player of [1,2]){
      const r=$('mc-'+player).querySelector('.mother-cavity').getBoundingClientRect();
      layoutCenters.set('mc-'+player,{x:r.left+r.width*.5,y:r.top+r.height*.5});
    }
    layoutDirty=false;
  }
  function center(id) {
    if(typeof id==='string' && (id.startsWith('pit-')||id.startsWith('mc-'))){
      measureBoard();
      return layoutCenters.get(id) || {x:innerWidth/2,y:innerHeight/2};
    }
    const el=typeof id==='string'?$(id):id;
    if(!el)return {x:innerWidth/2,y:innerHeight/2};
    const r=el.getBoundingClientRect();
    return{x:r.left+r.width/2,y:r.top+r.height/2};
  }
  function hideHand(){
    lastHandPos=null;
    const el=$('player-hand');el.classList.remove('visible','grip','releasing');
    $('hand-visual-count').textContent='';
    $('hand-counter').style.display='none';
  }
  function handBadge(pos,count){
    $('hand-visual-count').textContent=count>0?String(count):'';
    $('hand-counter').style.display='none';
  }
  function handPose(pose='open'){
    const el=$('player-hand');
    el.classList.toggle('grip',pose==='grip');
    el.classList.toggle('releasing',pose==='release');
  }

  function handPoint(pitPos, player=state.turn){
    const outward = player===1 ? 1 : -1;
    return portraitBoard()
      ? {x:pitPos.x-outward*39,y:pitPos.y}
      : {x:pitPos.x,y:pitPos.y+outward*45};
  }
  function releasePoint(pitPos, player=state.turn){
    const outward = player===1 ? 1 : -1;
    return portraitBoard()
      ? {x:pitPos.x-outward*16,y:pitPos.y}
      : {x:pitPos.x+2,y:pitPos.y+outward*16};
  }

  async function moveHand(pitPos,player=state.turn,pose='open'){
    if(!await waitForPlay())return;
    const el=$('player-hand');
    const point=handPoint(pitPos,player);
    el.dataset.facing=player===1?'bottom':'top';
    el.classList.toggle('ai',player===2);
    const position = p => `translate3d(calc(${p.x}px - 50%),calc(${p.y}px - 50%),0)`;
    const target=position(point);
    const previous=lastHandPos;
    handPose(pose);
    if(!el.classList.contains('visible')){
      el.style.transform=target;
      lastHandPos=point;
      el.classList.add('visible');
      if(!reducedMotion())await wait(Math.round(35*paceMultiplier()));
      return;
    }
    const distance=previous?Math.hypot(point.x-previous.x,point.y-previous.y):0;
    if(distance<2)return;
    lastHandPos=point;
    const duration=reducedMotion()?0:Math.round(
      (options.online?220:Math.min(318,215+Math.max(0,distance-65)*.16))*paceMultiplier()
    );
    if(!duration){el.style.transform=target;return;}
    if(typeof el.animate!=='function'){
      el.style.transform=target;
      await wait(duration);
      return;
    }
    const anim=el.animate([{transform:position(previous||point)}, {transform:target}],{
      duration,easing:'cubic-bezier(.36,.07,.25,.98)',fill:'both'
    });
    activeAnims.add(anim);
    try{
      await anim.finished.catch(()=>{});
      if(anim.playState==='finished')el.style.transform=target;
    }finally{
      activeAnims.delete(anim);
      try{anim.cancel();}catch{}
    }
  }

  function highlightPit(index,kind='pulse',ms=200) {
    const p=$('pit-'+index);
    const old=pitTimers.get(index+'|'+kind);
    if(old)clearTimeout(old);
    p.classList.add(kind);
    pitTimers.set(index+'|'+kind,setTimeout(()=>{
      p.classList.remove(kind);
      pitTimers.delete(index+'|'+kind);
    },ms));
  }

  function clearCaptureFeedback(){
    for(const timer of feedbackTimers)clearTimeout(timer);
    feedbackTimers.clear();
    document.querySelectorAll('.gain-float').forEach(el=>el.remove());
    document.querySelectorAll('.outer-mother-cup.store-celebrate').forEach(el=>el.classList.remove('store-celebrate'));
    document.querySelectorAll('.score-bloom').forEach(el=>el.classList.remove('score-bloom'));
  }
  function celebrateCapture(player,amount,pasu=false){
    const cup=$('mc-'+player),score=$('p'+player+'-score'),counter=$('mc-count-'+player);
    if(!cup||amount<=0)return;
    if(reducedMotion()||lightEffects())return;
    const pos=center('mc-'+player);
    const badge=document.createElement('span');
    badge.className='gain-float'+(pasu?' pasu':'');
    badge.textContent=pasu?'Pasu! +4':'+'+amount+' 🌰';
    badge.style.left=Math.min(innerWidth-35,Math.max(35,pos.x))+'px';
    badge.style.top=Math.max(55,Math.min(innerHeight-110,pos.y))+'px';
    document.body.append(badge);
    for(const el of [cup,score,counter]){
      const name=el===cup?'store-celebrate':'score-bloom';
      el.classList.remove(name);
      void el.offsetWidth;
      el.classList.add(name);
    }
    const timer=setTimeout(()=>{
      badge.remove();
      cup.classList.remove('store-celebrate');
      score.classList.remove('score-bloom');counter.classList.remove('score-bloom');
      feedbackTimers.delete(timer);
    },810);
    feedbackTimers.add(timer);
  }
  function closeAnimations() {
    clearCaptureFeedback();
    for(const anim of activeAnims){try{anim.cancel();}catch{}}
    activeAnims.clear();
    for(const timer of pitTimers.values())clearTimeout(timer);
    pitTimers.clear();
    document.querySelectorAll('.flying-seed').forEach(el=>el.remove());
    document.querySelectorAll('.pit.pulse,.pit.capture-pulse,.pit.drop-impact').forEach(el=>el.classList.remove('pulse','capture-pulse','drop-impact'));
    hideHand();
  }

  function motionTime(kind){
    if(reducedMotion())return 0;
    const base={drop:235,scoop:112,capture:255}[kind]||163;
    return Math.round(base*paceMultiplier());
  }
  async function fly(from,to,{kind='drop',index=0,serial=0,delay=0}={}){
    if(!await waitForPlay())return;
    const duration=motionTime(kind);
    if(duration<=0)return;
    const el=document.createElement('span');
    const color=getSeedClass(index, serial);
    el.className='flying-seed tamarind-seed '+color+(kind==='scoop'?' scoop-seed':'');
    const variance=kind==='scoop'?5:3;
    const sx=from.x+(Math.random()-.5)*variance, sy=from.y+(Math.random()-.5)*variance;
    const spread=kind==='capture'?15:kind==='drop'?6:5;
    const tx=to.x+(Math.random()-.5)*spread,ty=to.y+(Math.random()-.5)*spread;
    const dx=tx-sx,dy=ty-sy,dist=Math.hypot(dx,dy);
    const spin=(Math.random()>.5?1:-1)*(15+Math.random()*67);
    const frames=ballisticFlight({dx,dy,duration,portrait:portraitBoard(),kind,spin}).map(p=>({
      offset:p.offset,filter:lightEffects()?'none':`drop-shadow(${(1+p.height*.13).toFixed(2)}px ${(2+p.height*.18).toFixed(2)}px ${(1+p.height*.07).toFixed(2)}px #0008)`,transform:`translate3d(calc(-50% + ${p.x.toFixed(2)}px),calc(-50% + ${p.y.toFixed(2)}px),0) rotate(${p.angle.toFixed(2)}deg) scale(${(1+.06*(1-p.offset)).toFixed(3)})`
    }));
    el.style.left=sx+'px';el.style.top=sy+'px';document.body.append(el);
    let animation;
    try{
      animation=el.animate(frames,{duration,delay,easing:'linear',fill:'both'});
      activeAnims.add(animation);
      await animation.finished.catch(()=>{});
    }finally{
      if(animation)activeAnims.delete(animation);
      el.remove();
    }
  }

  function makeImpactBuffer(ctx, material, variation){
    const sampleRate=ctx.sampleRate;
    const isCowrie = material === 'cowrie';
    const isGlass = material === 'colored';
    const profile=materialProfile(material);
    const duration=profile.duration;
    const length = Math.ceil(duration * sampleRate);
    const buf = ctx.createBuffer(1, length, sampleRate);
    const values = buf.getChannelData(0);

    let random = (variation + 1) * 2345678 + (isGlass ? 1987 : isCowrie ? 4321 : 6543);
    const nextNoise = () => {
      random ^= random << 13; random ^= random >>> 17; random ^= random << 5;
      return ((random >>> 0) / 2147483648) - 1;
    };

    const baseFreq=profile.frequency*(.93+variation*.021);
    const harmonics = isGlass
      ? [1, 2.14, 3.42, 4.88]
      : isCowrie
        ? [1, 1.48, 2.22, 3.65]
        : [1, 1.72, 2.65];

    const amplitudes = isGlass
      ? [0.75, 0.45, 0.22, 0.12]
      : isCowrie
        ? [0.85, 0.40, 0.18, 0.08]
        : [0.70, 0.28, 0.10];

    const twoPi = Math.PI * 2;
    let filteredNoise = 0;

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const raw = nextNoise();
      filteredNoise = filteredNoise * .68 + raw * .32;
      const decayRate = isGlass ? 140 : isCowrie ? 190 : 210;
      const initialSnap = Math.exp(-t * decayRate) * filteredNoise * profile.noise;

      let resonance = 0;
      for (let p = 0; p < harmonics.length; p++) {
        const freq = baseFreq * harmonics[p];
        const damping = isGlass ? (28 + p * 12) : isCowrie ? (45 + p * 20) : (68 + p * 28);
        resonance += Math.sin(twoPi * freq * t + (variation + p) * 0.4) * Math.exp(-t * damping) * amplitudes[p];
      }

      const woodenCavity = Math.sin(twoPi * (180 + variation * 15) * t) * Math.exp(-t * 85) * 0.35;
      const bounceTime = isGlass ? 0.034 : isCowrie ? 0.021 : 0.026;
      const dt = t - bounceTime;
      const bounce = dt >= 0 
        ? Math.exp(-dt * 185) * (nextNoise() * 0.18 + Math.sin(twoPi * baseFreq * 0.92 * dt) * 0.2)
        : 0;

      values[i] = Math.tanh((initialSnap + resonance * .28 + woodenCavity * .8 + bounce * .55) * profile.level);
    }
    return buf;
  }

  function ensureAudio(){
    if(!options.sound)return null;
    try{
      const A=window.AudioContext||window.webkitAudioContext;
      if(!A)return null;
      if(!audio){
        audio=new A({latencyHint:'interactive'});
        const master=audio.createGain();master.gain.value=options.volume;
        const limiter=audio.createDynamicsCompressor();
        limiter.threshold.value=-14;limiter.knee.value=7;limiter.ratio.value=6;
        limiter.attack.value=.002;limiter.release.value=.065;
        master.connect(limiter);limiter.connect(audio.destination);
        audio.pallanguzhiMaster=master;audio.pallanguzhiSeeds=audio.createGain();audio.pallanguzhiUI=audio.createGain();audio.pallanguzhiSeeds.connect(master);audio.pallanguzhiUI.connect(master);
        audio.pallanguzhiSamples={};
      }
      if(audio.seedLevel!==options.seedVolume){audio.seedLevel=options.seedVolume;audio.pallanguzhiSeeds.gain.setTargetAtTime(options.seedVolume,audio.currentTime,.015);}if(audio.uiLevel!==options.uiVolume){audio.uiLevel=options.uiVolume;audio.pallanguzhiUI.gain.setTargetAtTime(options.uiVolume,audio.currentTime,.015);}
      const material=options.seedStyle||'natural';
      if(!audio.pallanguzhiSamples[material])
        audio.pallanguzhiSamples[material]=Array.from({length:8},(_,i)=>makeImpactBuffer(audio,material,i));
      if(audio.state==='suspended')void audio.resume().catch(()=>{});
      return audio;
    }catch{return null;}
  }

  function beadImpact(kind='drop',strength=1,offset=0){
    if(options.seedVolume<=0)return;
    const ctx=ensureAudio();if(!ctx||!options.sound||options.volume===0)return;
    try{
      const style = options.seedStyle || 'natural';
      const samples = ctx.pallanguzhiSamples[style] || ctx.pallanguzhiSamples.natural;
      const source=ctx.createBufferSource();
      source.buffer=samples[Math.floor(Math.random()*samples.length)];
      source.playbackRate.value=.96+Math.random()*.08;
      const gain=ctx.createGain();
      const typeFactor=kind==='pickup'?.55:kind==='bank'?.82:1;
      const level=Math.min(1,Math.max(.005,.55*strength*typeFactor));
      const t=ctx.currentTime+offset;
      gain.gain.setValueAtTime(level,t);
      source.connect(gain);gain.connect(ctx.pallanguzhiSeeds);
      source.start(t);
      source.onended=()=>{try{source.disconnect();gain.disconnect();}catch{}};
    }catch{}
  }

  function softNotes(frequencies,level=.065){
    if(options.uiVolume<=0)return;
    const ctx=ensureAudio();if(!ctx||!options.sound||options.volume===0)return;
    try{
      frequencies.forEach((frequency,i)=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain(),t=ctx.currentTime+i*.075;
        osc.type='sine';osc.frequency.setValueAtTime(frequency,t);
        gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(level,t+.009);
        gain.gain.exponentialRampToValueAtTime(.0001,t+.14);
        osc.connect(gain);gain.connect(ctx.pallanguzhiUI);osc.start(t);osc.stop(t+.15);
        osc.onended=()=>{osc.disconnect();gain.disconnect();};
      });
    }catch{}
  }
  let lastUiClick=0;
  function uiClick(){const now=performance.now();if(!options.sound||options.volume<=0||now-lastUiClick<65)return;lastUiClick=now;softNotes([760],.018);}
  function turnSound(player){
    if(options.online&&player!==onlineState.myPlayerIndex||options.ai&&player!==1)return;
    softNotes(player===1?[440,660]:[523.25,783.99],.075);
    if(options.sound&&options.volume>0&&document.visibilityState==='visible'){
      try{navigator.vibrate?.([25,45,25]);}catch{}
    }
  }
  function scoopSound(count){
    for(const tap of pickupPattern(count))beadImpact('pickup',tap.strength,tap.offset);
  }
  function captureSound(count=4){
    const taps=Math.min(6,Math.max(3,Math.ceil(count/3)));
    for(let i=0;i<taps;i++)beadImpact('bank',1-i*.11,i*.034+(i%2)*.009);
    // Material clatter carries the reward; no repeated electronic capture melody.
    if(options.sound&&options.volume>0){try{navigator.vibrate?.(18);}catch{}}
  }

  function layeredLanding(count){
    const now=performance.now();
    if(now-lastDropSoundAt < (options.fast?55:27))return;
    lastDropSoundAt=now;
    beadImpact('drop',count>3?.89:1);
    if(count>7 && Math.random()>.75)beadImpact('pickup',.24,.027);
  }

  async function animateScoop(pit,count,player=state.turn,live=()=>true){
    const at=center('pit-'+pit);
    await moveHand(at,player,'open');
    if(!live())return;
    handPose('grip');
    scoopSound(count);
    const hand=releasePoint(at,player);
    const n=Math.min(count,options.fast?1:options.online?2:matchMedia('(pointer:coarse)').matches?2:3);
    await Promise.all(Array.from({length:n},(_,i)=>fly(
      {x:at.x+(i-(n-1)/2)*3.6,y:at.y+((i%2)*4)},
      {x:hand.x+(i-(n-1)/2)*1.5,y:hand.y},
      {kind:'scoop',index:pit,serial:i,delay:i*(options.fast?8:24)}
    )));
    if(!live())return;
    handBadge(at,count);
  }

  async function animateCapture(pit,player,count,live){
    const at=center('pit-'+pit),to=center('mc-'+player);
    await moveHand(at,player,'open');if(!live())return;
    handPose('grip');scoopSound(count);
    const lift=releasePoint(at,player);
    const n=Math.min(count,options.fast?2:options.online?3:matchMedia('(pointer:coarse)').matches?3:5);
    await Promise.all(Array.from({length:Math.min(n,6)},(_,i)=>
      fly({x:at.x+(i%3-1)*4,y:at.y+(Math.floor(i/3)*3)},lift,{kind:'scoop',index:pit,serial:i,delay:i*(options.fast?9:18)})
    ));
    if(!live())return;
    handBadge(at,count);
    await moveHand(to,player,'grip');if(!live())return;
    handPose('release');
    const seedStart=releasePoint(to,player);
    await Promise.all(Array.from({length:n},(_,i)=>fly(
      {x:seedStart.x+(i%3-1)*2,y:seedStart.y},to,
      {kind:'capture',index:pit,serial:i,delay:i*(options.fast?12:28)}
    ).then(()=>{if(live()&&i%3===0)beadImpact('bank',.32);})));
    if(live())captureSound(count);
  }

  const difficultyDescriptions={
    easy:'Easy chooses randomly among legal cups — ideal for beginners.',
    medium:'Medium compares immediate captures, Pasu, and remaining seeds.',
    hard:'Hard also considers the opponent’s best reply.',
    expert:'Expert considers a further response using a bounded 3-ply search.'
  };
  function evaluatePosition(pits,banks,perspective,finished=false) {
    const rival=other(perspective);
    const difference=banks[perspective]-banks[rival];
    if(finished) return difference*14+(difference>0?600:difference<0?-600:0);
    const ours=row(perspective).reduce((sum,i)=>sum+pits[i],0);
    const theirs=row(rival).reduce((sum,i)=>sum+pits[i],0);
    const mobility=validMoves(perspective,pits).length-validMoves(rival,pits).length;
    return difference*11+(ours-theirs)*.27+mobility*.45;
  }
  function applyCandidate(pits,banks,player,pit){
    const result=simulateMove(pits,banks,player,pit);
    const ps=result.pits.slice(), bs=result.banks.slice();
    const over=settleIfFinished(ps,bs);
    if(over)settleLockedSeeds(ps,bs,state.kasiePits);
    return {pits:ps,banks:bs,over};
  }
  function recommendMove(player,difficulty='hard',pits=state.pits,banks=state.banks){
    const available=[];
    for(const pit of validMoves(player,pits)){
      try{ available.push({pit,next:applyCandidate(pits,banks,player,pit)}); }
      catch{}
    }
    if(!available.length)return null;
    if(difficulty==='easy')return available[Math.floor(Math.random()*available.length)].pit;
    const depth={medium:1,hard:2,expert:3}[difficulty]||1;
    const started=performance.now();
    const deadline=started+(difficulty==='expert'?55:35);
    let explored=0;
    const maxNodes=difficulty==='expert'?200:85;
    function search(ps,bs,turn,left,alpha,beta,over){
      if(over||left===0||explored>=maxNodes||performance.now()>deadline)
        return evaluatePosition(ps,bs,player,over);
      const moves=validMoves(turn,ps);
      if(!moves.length)return evaluatePosition(ps,bs,player,true);
      const maximize=turn===player;
      let best=maximize?-Infinity:Infinity,found=false;
      for(const pit of moves){
        if(explored>=maxNodes||performance.now()>deadline)break;
        let next;
        try{next=applyCandidate(ps,bs,turn,pit);}catch{continue;}
        explored++;found=true;
        const score=search(next.pits,next.banks,other(turn),left-1,alpha,beta,next.over);
        best=maximize?Math.max(best,score):Math.min(best,score);
        if(maximize)alpha=Math.max(alpha,best);else beta=Math.min(beta,best);
        if(beta<=alpha)break;
      }
      return found?best:evaluatePosition(ps,bs,player,over);
    }
    const ordered=available.map(({pit,next})=>({pit,next,baseline:evaluatePosition(next.pits,next.banks,player,next.over)}))
      .sort((a,b)=>b.baseline-a.baseline || a.pit-b.pit);
    let choice=ordered[0].pit;
    for(let iteration=1;iteration<=depth;iteration++){
      let best=-Infinity,candidate=choice,complete=true;
      for(const item of ordered){
        if(explored>=maxNodes||performance.now()>deadline){complete=false;break;}
        const score=iteration===1?item.baseline:search(item.next.pits,item.next.banks,other(player),iteration-1,-Infinity,Infinity,item.next.over);
        if(iteration>1&&(explored>=maxNodes||performance.now()>deadline)){complete=false;break;}
        if(score>best){best=score;candidate=item.pit;}
      }
      if(complete)choice=candidate;else break;
    }
    return choice;
  }
  function chooseAI(){return recommendMove(2,options.difficulty);}

  function escapeMarkup(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function assertConservation(where='match') {
    const total=state.pits.reduce((n,v)=>n+v,0)+state.banks[1]+state.banks[2];
    if(total!==getTotalSeeds())throw Error(`Seed conservation error at ${where}: ${total} instead of ${getTotalSeeds()}`);
  }

  function handleRoundSettlement() {
    if(practice){endPractice();return;}
    settleLockedSeeds(state.pits,state.banks,state.kasiePits);
    render();
    assertConservation('round settlement');

    if (options.format === 'single') {
      finishMatch();
      return;
    }

    state.roundPending=true;
    saveStableMatch();
    showRoundSummary();
  }

  function restoreTournament(saved){
    tournament.allocations=Array.isArray(saved?.allocations)?saved.allocations.filter(x=>x&&Number.isInteger(x.round)&&x.round>0&&typeof x.signature==='string'&&x.signature.length<100).slice(-512):[];
    tournament.forcedDraw=saved?.forcedDraw===true;
    tournament.endReason=typeof saved?.endReason==='string'?saved.endReason.slice(0,200):'';
  }
  function showRoundSummary(){
    const S=options.seedsPerPit,s1=state.banks[1],s2=state.banks[2],ta=getLanguage()==='ta';
    if(s1<S||s2<S){state.roundPending=false;finishMatch();return;}
    const signature=`${s1}|${s2}|${S}|${options.pasu}|${options.firstMove==='alt'?state.currentRoundStarter:options.firstMove}`;
    if(tournament.allocations.at(-1)?.round!==state.round)tournament.allocations.push({round:state.round,signature});
    if(tournament.allocations.filter(x=>x.signature===signature).length>=3){
      tournament.forcedDraw=true;tournament.endReason='Kasie draw: the same seed allocation repeated three times. The tournament is declared a draw to prevent an endless cycle.';
      state.roundPending=false;finishMatch();return;
    }
    saveStableMatch();
    const fill1=Math.min(7,Math.floor(s1/S)),fill2=Math.min(7,Math.floor(s2/S));
    const rem1=s1-fill1*S,rem2=s2-fill2*S;
    $('round-modal-title').textContent=getLanguage()==='ta'?`சுற்று ${state.round} முடிந்தது!`:`Round ${state.round} complete!`;
    $('round-details').innerHTML=`<div style="margin-bottom:8px;font-weight:850;color:#ffd700">${ta?'சுற்று':'Round'} ${state.round} ${ta?'விதைகள்':'score'}</div>
       <div style="display:flex;justify-content:space-between;gap:8px"><span>${escapeMarkup(names[1])}: <b>${s1} ${ta?'விதைகள்':'seeds'}</b></span><span>${escapeMarkup(names[2])}: <b>${s2} ${ta?'விதைகள்':'seeds'}</b></span></div>
       <div style="margin-top:9px;border-top:1px dashed #644525;padding-top:8px"><div>${escapeMarkup(names[1])}: ${fill1} ${ta?'நிரப்பிய குழிகள்':'filled'}, ${7-fill1} ${ta?'காசி':'Kasie'} 🔒 (${rem1} ${ta?'மீதி விதைகள்':'surplus'})</div><div>${escapeMarkup(names[2])}: ${fill2} ${ta?'நிரப்பிய குழிகள்':'filled'}, ${7-fill2} ${ta?'காசி':'Kasie'} 🔒 (${rem2} ${ta?'மீதி விதைகள்':'surplus'})</div></div>`;
    $('kasie-explainer').textContent=kasieExplanation(displayName(1),fill1,ta)+' '+kasieExplanation(displayName(2),fill2,ta);
    const button=$('next-round-btn');
    button.disabled=options.online&&!onlineState.isHost;
    button.textContent=options.online&&!onlineState.isHost?'⏳ Waiting for host to begin next round…':'START NEXT ROUND';
    button.onclick=()=>{
      if(!state.roundPending||(options.online&&!onlineState.isHost))return;
      $('round-modal').classList.add('hidden');setupNextRound(fill1,fill2,S,true);
    };
    $('round-modal').classList.remove('hidden');
    processPendingNextRound();
    if(state.roundPending)playVictoryChime();
  }

  function setupNextRound(fill1, fill2, S, broadcast=true, forcedStarter=null) {
    if(options.online){cloud.send('NEXT_ROUND');return;}
    const previousRound=state.round;
    state.round++;
    $('round-brand-sub').textContent=`ROUND ${state.round} · KASIE TOURNAMENT`;

    for (let i = 0; i < 7; i++) {
      if (i < fill1) {
        state.pits[i] = S;
        state.kasiePits[i] = false;
      } else {
        state.pits[i] = 0;
        state.kasiePits[i] = true;
      }
    }
    state.banks[1] -= fill1 * S;

    for (let i = 7; i < 14; i++) {
      if (i < 7 + fill2) {
        state.pits[i] = S;
        state.kasiePits[i] = false;
      } else {
        state.pits[i] = 0;
        state.kasiePits[i] = true;
      }
    }
    state.banks[2] -= fill2 * S;

    state.over = false;
    state.roundPending = false;
    state.paused=false;
    state.started = true;
    state.history = [];
    state.awaitingToss=options.firstMove==='coin';
    assertConservation('new round refill');
    invalidateLayout();

    let nextStarter = forcedStarter;
    if (!nextStarter) {
      if (options.firstMove === 'coin') nextStarter = Math.random() < 0.5 ? 1 : 2;
      else if (options.firstMove === 'alt') nextStarter = other(state.currentRoundStarter);
      else nextStarter = options.firstMove === 'p2' ? 2 : 1;
    }

    if (options.online && broadcast) {
      sendOnlinePacket({type:'NEXT_ROUND',starter:nextStarter,fromRound:previousRound,matchId:state.matchId,rev:onlineState.revision});
    }

    if (options.firstMove === 'coin') {
      launchCoinToss((tossWinner) => {
        state.turn = tossWinner;
        state.currentRoundStarter = tossWinner;
        state.awaitingToss=false;finishTossRecovery();
        render();
        if(onlineState.syncPending)sendAuthoritativeState();
        processRemoteQueue();
        saveStableMatch();
        toast(`Round ${state.round} started! ${names[state.turn]}'s turn.`, 1800);
        if (options.ai && state.turn === 2) scheduleAiTurn(() => state.started && !state.over);
      }, nextStarter);
    } else {
      state.currentRoundStarter = nextStarter;
      state.turn = nextStarter;
      state.awaitingToss=false;finishTossRecovery();
      render();
      if(onlineState.syncPending)sendAuthoritativeState();
      processRemoteQueue();
      saveStableMatch();
      toast(`Round ${state.round} started! ${names[state.turn]}'s turn.`, 1800);
      if (options.ai && state.turn === 2) scheduleAiTurn(() => state.started && !state.over);
    }
  }

  function snapshot(){
    return {pits:state.pits.slice(),banks:state.banks.slice(),turn:state.turn,
      kasiePits:state.kasiePits.slice(),round:state.round,metrics:{...state.metrics}};
  }
  function updateAssistButtons(){
    const canHint=state.started&&!state.over&&!state.busy&&!state.paused&&!onlineState.remotePaused&&!state.awaitingToss&&(!options.online||(onlineState.connected&&!peerStale&&!onlineState.awaitingSync&&state.turn===onlineState.myPlayerIndex))&&!(options.ai&&state.turn===2)&&validMoves(state.turn).length>0;
    $('hint-btn').disabled=!canHint;
    $('hint-btn').setAttribute('aria-pressed',String(canHint&&state.hintPit!==null));
    const canUndo=!options.online&&state.started&&(
      options.online
        ? onlineState.connected&&!peerStale&&!onlineState.remotePaused&&!onlineState.awaitingSync&&!onlineState.undoPending&&!state.busy&&!state.awaitingToss&&!state.paused&&!state.roundPending&&(onlineState.isHost?state.history.length>0:onlineState.remoteUndoAvailable)
        : state.history.length>0);
    $('undo-btn').disabled=options.online||!canUndo;
    $('undo-end-btn').hidden=options.online||!canUndo;
    $('undo-btn').title=options.online?'Request a synchronized undo from the host':'Undo your previous move';
  }
  function hideHintExplanation(){
    $('hint-explanation').hidden=true;
    $('hint-explanation-text').textContent='';
  }
  function showHint(){
    if(!state.started||state.over||state.paused||onlineState.remotePaused||state.busy||state.awaitingToss||(options.online&&(!onlineState.connected||state.turn!==onlineState.myPlayerIndex))||(options.ai&&state.turn===2))return;
    if(state.hintPit!==null){state.hintPit=null;hideHintExplanation();render();return;}
    const pit=recommendMove(state.turn,'hard');
    if(pit===null){toast('No safe move found. Try a different cup.',1500);return;}
    let simulated;
    try{simulated=simulateMove(state.pits,state.banks,state.turn,pit);}catch{return;}
    state.hintPit=pit;
    const me=state.turn, rival=other(me);
    const myGain=simulated.banks[me]-state.banks[me],theirGain=simulated.banks[rival]-state.banks[rival];
    const caps=simulated.events.filter(e=>e.kind==='capture'&&e.player===me).reduce((n,e)=>n+e.count,0);
    const pasu=simulated.events.filter(e=>e.kind==='pasu'&&e.player===me).length;
    const local=pit<7?pit+1:14-pit;
    const effects=[];
    if(caps)effects.push(`captures ${caps}`);
    if(pasu)effects.push(`${pasu} Pasu`);
    if(!effects.length)effects.push('positions your seeds');
    $('hint-explanation-text').textContent=getLanguage()==='ta'?`💡 குழி ${local}: நீங்கள் உடனே ${myGain} விதைகளையும் எதிர்வீரர் ${theirGain} விதைகளையும் பெறுவர். அடுத்த பதில் நகர்வையும் கணக்கில் கொண்டு இக்குழி பரிந்துரைக்கப்படுகிறது.`:`💡 Cup ${local}: ${effects.join(' and ')}. You gain ${myGain}, the opponent gains ${theirGain} immediately. The recommendation considers the next response.`;
    $('hint-explanation').hidden=false;
    setStatus(`💡 Suggested cup ${local}.`);
    render();
  }
  function undoMove(){
    if(!options.online){performLocalUndo();return;}
    if(!state.started||!onlineState.connected||peerStale||onlineState.awaitingSync||onlineState.undoPending||state.paused||onlineState.remotePaused||state.busy||state.activeMove||state.awaitingToss||state.roundPending)return;
    if(onlineState.isHost){
      onlineState.revision++;
      if(performLocalUndo()){
        onlineState.pendingRemoteMoves=[];onlineState.pendingNextRound=null;
        saveStableMatch();sendAuthoritativeState();sendUndoAvailability();
      }else onlineState.revision--;
    }else{
      if(!onlineState.remoteUndoAvailable)return;
      onlineState.undoPending=true;
      sendOnlinePacket({type:'UNDO_REQUEST',matchId:state.matchId,round:state.round,
        seq:state.metrics.moves,rev:onlineState.revision});
      updateAssistButtons();render();toast('↶ Undo requested from host…',1600);
    }
  }
  function performLocalUndo(){
    if(!state.started||!state.history.length)return false;
    clearCaptureFeedback();
    rematch.localReady=false;rematch.remoteReady=false;
    const previous=state.history.pop();
    tournament.allocations=[];tournament.forcedDraw=false;tournament.endReason='';
    if(state.resultRecorded)rollbackFinishedResult();
    invalidateMatch();
    state.pits=previous.pits.slice();state.banks=previous.banks.slice();
    state.kasiePits=normalizeKasie(previous.kasiePits);state.round=normalizeRound(previous.round);
    state.metrics=cleanMetrics(previous.metrics);state.turn=previous.turn;
    state.over=false;state.roundPending=false;state.paused=false;state.started=true;
    $('round-brand-sub').textContent=options.format==='kasie'?`ROUND ${state.round} · KASIE TOURNAMENT`:'SINGLE MATCH';
    ['end-modal','round-modal','quit-modal'].forEach(id=>$(id).classList.add('hidden'));
    if(!practice)features?.undo(state.round,state.metrics.moves);
    assertConservation('undo');
    render();saveStableMatch();
    setStatus(`↶ Turn restored. ${names[state.turn]}'s turn.`);
    toast('↶ Previous turn restored',1000);
    return true;
  }
  function scheduleAiTurn(live){
    if(!live()||!state.started||state.over||state.paused||state.turn!==2||!options.ai||state.roundPending)return;
    const ticket=++state.aiTicket, epoch=state.epoch;
    state.busy=true;render();setStatus(`${names[2]} is thinking…`);
    void(async()=>{
      try{
        await wait(options.fast?130:430);
        if(!live()||epoch!==state.epoch||ticket!==state.aiTicket||state.paused||state.over||state.turn!==2)return;
        const pit=chooseAI();
        if(pit===null){
          state.busy=false;render();
          setStatus('No valid AI move. Open Match to change the rules.');
          return;
        }
        if(explainAI){try{const prediction=simulateMove(state.pits,state.banks,2,pit);$('capture-guide').textContent=getLanguage()==='ta'?`கணினி குழி ${14-pit}: உடனடி பலன் ${prediction.banks[2]-state.banks[2]} விதைகள்; எதிர்வீரருக்கு ${prediction.banks[1]-state.banks[1]}.`:`AI cup ${14-pit}: immediate gain ${prediction.banks[2]-state.banks[2]} seeds; opponent gains ${prediction.banks[1]-state.banks[1]}.`;}catch{}}
        state.busy=false;
        await playPit(pit,true);
      }catch(error){
        console.error('AI turn interrupted',error);
        if(epoch!==state.epoch||ticket!==state.aiTicket)return;
        state.busy=false;render();setStatus('AI interrupted. Open Match to restart.');
      }
    })();
  }
  function updateSkipButton(){
    const running=Boolean(state.activeMove)&&!state.paused&&!onlineState.remotePaused;
    $('skip-btn').hidden=!running;$('skip-btn').disabled=!running;
  }
  function skipCurrentMove(){
    const move=state.activeMove;
    if(!move||move.epoch!==state.epoch||state.paused||onlineState.remotePaused)return;
    state.epoch++;state.aiTicket++;
    closeAnimations();
    state.pits=move.simulated.pits.slice();state.banks=move.simulated.banks.slice();
    state.activeMove=null;updateSkipButton();
    completeMove(move.mover,()=>true,false,move.simulated);
    if(!state.over)toast('⏭ Move completed',750);
  }

  function playbackContext(mover=state.turn){return {matchId:state.matchId,round:state.round,seq:state.metrics.moves,rev:onlineState.revision,mover};}
  function sendPlaybackAck(){const b=playback.inspect();if(!options.online||!onlineState.connected||!b.localDone)return;lastPlaybackAck=Date.now();sendOnlinePacket({type:'MOVE_FINISHED',protocol:PLAYBACK_PROTOCOL,...b.context,sender:onlineState.myPlayerIndex,digest:b.digest});sendOnlinePacket({type:'MOVE_FINISHED_QUERY',protocol:PLAYBACK_PROTOCOL,...b.context,sender:onlineState.myPlayerIndex});}
  function recoverPlayback(){
    if(!options.online)return;
    if(onlineState.isHost){if(!pendingCompletion)return;const c=pendingCompletion;pendingCompletion=null;playback.clear();onlineState.awaitingPlayback=false;onlineState.syncPending=true;finishCompletedMove(c.mover,c.live,c.recovered,c.simulated);queueMicrotask(sendAuthoritativeState);}
    else{pendingCompletion=null;playback.reset();state.epoch++;state.aiTicket++;closeAnimations();state.activeMove=null;state.busy=false;onlineState.awaitingPlayback=false;onlineState.awaitingSync=true;sendOnlinePacket({type:'STATE_REQUEST'});render();}
  }
  function maybeCompleteOnlineMove(){
    if(!pendingCompletion||state.paused||onlineState.remotePaused)return;
    const b=playback.inspect();if(b.status==='mismatch'){recoverPlayback();return;}if(b.status!=='ready')return;
    const c=pendingCompletion;pendingCompletion=null;playback.clear();onlineState.awaitingPlayback=false;finishCompletedMove(c.mover,c.live,c.recovered,c.simulated);
  }
  function completeMove(mover,live,recovered=false,simulated=null){
    if(options.online&&cloudAnimating){
      if(!live())return;state.activeMove=null;hideHand();updateSkipButton();cloudAnimating=false;
      if(simulated){features?.recordAfter();for(const e of simulated.events){if(e.kind==='pasu'&&e.player===1)state.metrics.p1Pasu++;if(e.kind==='capture'&&e.player===1){state.metrics.p1Captured+=e.count;state.metrics.biggestCapture=Math.max(state.metrics.biggestCapture,e.count);}}}
      state.metrics.moves=cloudNext.seq;state.busy=true;onlineState.awaitingPlayback=true;render();
      cloud.send('DONE');if(cloudNext.phase!=='playback')applyCloudState(cloudNext);else setStatus('Waiting for the other phone to finish sowing…');return;
    }
    if(!live())return;
    if(!options.online||!simulated){finishCompletedMove(mover,live,recovered,simulated);return;}
    state.activeMove=null;hideHand();updateSkipButton();
    if(recovery.pendingSync){const packet=recovery.pendingSync;recovery.pendingSync=null;state.busy=false;handleOnlineMessage(packet);return;}
    pendingCompletion={mover,live,recovered,simulated};onlineState.awaitingPlayback=true;state.busy=true;
    playback.finish(playbackContext(mover));sendPlaybackAck();if(onlineState.isHost&&onlineState.syncPending){recoverPlayback();return;}maybeCompleteOnlineMove();if(pendingCompletion){render();setStatus('Waiting for the other phone to finish sowing…');}
  }

  function finishCompletedMove(mover, live, recovered=false, simulated=null) {
    if (!live()) return;
    state.activeMove=null;
    updateSkipButton();
    hideHand();
    if(simulated){
      if(!practice)features?.recordAfter();
      state.metrics.moves++;
      for(const e of simulated.events){
        if(e.kind==='pasu'&&e.player===1)state.metrics.p1Pasu++;
        if(e.kind==='capture'&&e.player===1){
          state.metrics.p1Captured+=e.count;
          state.metrics.biggestCapture=Math.max(state.metrics.biggestCapture,e.count);
        }
      }
    }
    if(practice&&practiceComplete(state.metrics.moves)){endPractice();return;}
    if (settleIfFinished(state.pits,state.banks)) {
      state.over=true;state.busy=false;render();
      handleRoundSettlement();
      if(recovery.pendingSync){const packet=recovery.pendingSync;recovery.pendingSync=null;handleOnlineMessage(packet);}
      return;
    }
    state.turn=other(mover);
    state.busy=false;
    render();
    saveStableMatch();
    if(options.online){
      if(recovery.pendingSync){const packet=recovery.pendingSync;recovery.pendingSync=null;handleOnlineMessage(packet);return;}
      if(onlineState.syncPending)queueMicrotask(sendAuthoritativeState);
      if(onlineState.isHost){queueMicrotask(sendUndoAvailability);queueMicrotask(processPendingUndo);}
      queueMicrotask(processRemoteQueue);
    }
    if (options.ai && state.turn===2) {
      scheduleAiTurn(live);
    } else {
      setStatus(recovered
        ? `Animation interrupted; move completed. ${names[state.turn]}'s turn.`
        : `${names[state.turn]}'s turn. Choose a cup on your side.`);
    }
  }

  async function playPit(index,fromAI=false,fromRemote=false,serverMove=false) {
    if(!state.started||state.busy||state.paused||onlineState.remotePaused||state.over||state.awaitingToss||owner(index)!==state.turn||state.pits[index]<=0)return;
    if(options.ai && state.turn===2 && !fromAI)return;
    if(options.online && !serverMove && (!onlineState.connected || peerStale || onlineState.awaitingSync || (fromRemote ? state.turn===onlineState.myPlayerIndex : state.turn!==onlineState.myPlayerIndex)))return;
    if(state.kasiePits[index])return;

    if(options.online&&!serverMove){if(cloud.view?.phase!=='turn'||cloud.view.pause||onlineState.awaitingSync)return;onlineState.awaitingSync=true;render();if(!cloud.send('MOVE',{pit:index})){onlineState.awaitingSync=false;onlineState.connected=false;render();cloud.reconnect();}return;}
    clearCaptureFeedback();
    const current=state.turn;
    const epoch=state.epoch;
    let simulated;
    try {simulated=simulateMove(state.pits,state.banks,current,index);}
    catch(err) {setStatus(err.message);toast(err.message,2300);return;}
    
    saveStableMatch();
    // Broadcast move to remote peer if online
    if (options.online && !fromRemote && !serverMove) {
      if(!sendOnlineMove(index)){onlineStatus('Move could not be sent. Reconnecting…',false);sessionNotice('Your move was not sent. Reconnect before trying again.');scheduleReconnect();return;}
    }

    if(!options.ai || current===1){
      state.history.push(snapshot());
      if(state.history.length>40)state.history.shift();
    }
    if(options.online&&!serverMove)playback.begin(playbackContext(current),boardDigest(simulated.pits,simulated.banks));
    if(!practice)features?.recordBefore(index,current,state);
    state.hintPit=null;
    hideHintExplanation();
    state.busy=true;
    state.activeMove={simulated,mover:current,epoch};
    updateSkipButton();
    render();
    let source=center('pit-'+index),hand=0;
    const live=()=>epoch===state.epoch;
    try {
      for(const event of simulated.events){
        if(!await waitForPlay(epoch)||!live())return;
        if(event.kind==='pickup'){
          hand=state.pits[event.pit];
          source=center('pit-'+event.pit);
          highlightPit(event.pit,'pulse',options.fast?130:340);
          setStatus(`${names[current]} scoops ${hand} ${pieceWord()}…`);
          await animateScoop(event.pit,hand,current,live);
          if(!live())return;
          state.pits[event.pit]=0;
          paintPit(event.pit);
          if(!reducedMotion()&&!options.fast)await wait(Math.round(12*paceMultiplier()));
        }else if(event.kind==='drop'){
          const dest=center('pit-'+event.pit);
          await moveHand(dest,current,'grip');
          if(!live())return;
          handPose('release');
          await fly(releasePoint(dest,current),dest,{kind:'drop',index:event.pit,serial:state.pits[event.pit]});
          if(!live())return;
          state.pits[event.pit]++;hand--;
          paintPit(event.pit,true);
          const pitEl=$('pit-'+event.pit);
          pitEl.classList.remove('drop-impact');
          requestAnimationFrame(()=>{if(live())highlightPit(event.pit,'drop-impact',options.fast?85:180);});
          highlightPit(event.pit,'pulse',options.fast?110:230);
          handBadge(dest,hand);
          source=dest;
          layeredLanding(state.pits[event.pit]);
          handPose('grip');
          if(!reducedMotion())await wait(Math.round((options.fast?4:10)*paceMultiplier()));
        }else if(event.kind==='pasu'){
          setCaptureFeedback(event);
          highlightPit(event.pit,'capture-pulse',500);
          toast(`Pasu! ${names[event.player]} +4 ${pieceWord()}`,options.fast?750:1600);
          setStatus(`Pasu! ${names[event.player]} wins 4.`);
          await animateCapture(event.pit,event.player,4,live);
          if(!live())return;
          state.pits[event.pit]=0;state.banks[event.player]+=4;
          paintPit(event.pit);paintBank(event.player,4);
          celebrateCapture(event.player,4,true);
          handBadge(source,hand);
          if(!options.fast&&!reducedMotion())await wait(Math.round(42*paceMultiplier()));
        }else if(event.kind==='capture'){
          setCaptureFeedback(event);
          highlightPit(event.pit,'capture-pulse',520);
          toast(`${names[event.player]} captured ${event.count} ${pieceWord()}!`,options.fast?900:1800);
          setStatus(`${names[event.player]} collects ${event.count} from the next cup.`);
          await animateCapture(event.pit,event.player,event.count,live);
          if(!live())return;
          state.pits[event.pit]=0;state.banks[event.player]+=event.count;
          paintPit(event.pit);paintBank(event.player,event.count);
          celebrateCapture(event.player,event.count);
          if(!options.fast&&!reducedMotion())await wait(Math.round(50*paceMultiplier()));
        }else if(event.kind==='no-capture'){
          setStatus('Empty cup followed by another empty cup. No capture.');
          if(!options.fast)await wait(100);
        }
      }
      if(!live())return;
      if(state.pits.some((v,i)=>v!==simulated.pits[i]) ||
          state.banks[1]!==simulated.banks[1] || state.banks[2]!==simulated.banks[2])
        throw new Error('Game engine/playback mismatch.');
      completeMove(current,live,false,simulated);
    } catch(err) {
      console.error('Recovered animation failure:',err);
      if(!live())return;
      closeAnimations();
      state.pits=simulated.pits.slice();
      state.banks=simulated.banks.slice();
      completeMove(current,live,true,simulated);
    }
  }

  function playVictoryChime(){
    const ctx=ensureAudio();if(!ctx||!options.sound||options.volume===0)return;
    try{
      [523.25,659.25,783.99].forEach((freq,i)=>{
        const osc=ctx.createOscillator(),gain=ctx.createGain();
        const start=ctx.currentTime+i*.12;
        osc.type='sine';osc.frequency.setValueAtTime(freq,start);
        gain.gain.setValueAtTime(.0001,start);
        gain.gain.linearRampToValueAtTime(.055,start+.016);
        gain.gain.exponentialRampToValueAtTime(.0001,start+.32);
        osc.connect(gain);gain.connect(ctx.pallanguzhiUI);
        osc.start(start);osc.stop(start+.34);
      });
    }catch{}
  }
  function updateRematchUI(){
    const view=rematchView({online:options.online,connected:onlineState.connected&&!peerStale,...rematch});
    $('again-btn').disabled=view.disabled;$('again-btn').textContent=view.label;
    $('rematch-status').textContent=view.message;
  }
  function tryStartRematch(){
    if(canStartRematch({online:options.online,connected:onlineState.connected&&!peerStale,isHost:onlineState.isHost,over:state.over,busy:state.busy,...rematch}))startGame(true);
  }
  function requestRematch(){
    if(options.online){if(state.over&&!state.roundPending&&!rematch.localReady&&onlineState.connected&&cloud.send('REMATCH')){rematch.localReady=true;updateRematchUI();}return;}
    if(!state.over||state.roundPending)return;
    if(!options.online){startGame(true);return;}
    if(!onlineState.connected||rematch.localReady)return;
    rematch.localReady=true;
    sendOnlinePacket({type:'REMATCH_READY',matchId:state.matchId});
    updateRematchUI();tryStartRematch();
  }

  function finishMatch(){
    if(practice){endPractice();return;}
    closeAnimations();
    hideHintExplanation();
    assertConservation('final score');
    recordFinishedMatch();
    removeSavedMatch();
    const total = getTotalSeeds();
    const score1=state.banks[1],score2=state.banks[2];
    const tied=tournament.forcedDraw||score1===score2;
    const winner=score1>score2?1:2;
    document.body.dataset.dialogOwner=String(tied?1:winner);
    const text=tournament.forcedDraw?'Kasie tournament drawn — repeated position':tied?'A beautiful draw! 🤝':`${names[winner]} wins!`;
    $('winner-text').textContent=text;
    $('result-heading').textContent=tied?'Draw!':'Congratulations!';
    $('result-subtitle').textContent=tied?'A MATCH WELL PLAYED':'HERITAGE CHAMPION';
    $('result-message').textContent=tournament.forcedDraw?tournament.endReason:tied
      ? 'Both players collected the same number of seeds. Ready for a rematch?'
      : `${names[winner]} gathered ${state.banks[winner]} out of ${total} seeds. Play again and try a different strategy!`;
    $('final-scores').replaceChildren();
    for(const p of [1,2]){
      const box=document.createElement('div');box.className='result-player';
      const playerName=document.createElement('span');playerName.dataset.noI18n='';playerName.textContent=displayName(p);
      const score=document.createElement('strong');score.textContent=state.banks[p];
      const label=document.createElement('small');label.textContent='seeds collected';
      if(!tied&&p===winner)box.classList.add('result-winner');
      box.append(playerName,score,label);$('final-scores').append(box);
    }
    $('score-share-1').style.width=Math.min(100, Math.round(score1/total*100))+'%';
    $('score-share-2').style.width=Math.min(100, Math.round(score2/total*100))+'%';
    $('score-comparison').setAttribute('aria-label',`${names[1]} ${score1} seeds, ${names[2]} ${score2} seeds`);
    setStatus(`Game over — ${text} (${score1} – ${score2})`);
    $('result-match-info').textContent=`${options.format==='kasie'?'Kasie tournament · '+state.round+' rounds':'Single Match'} · ${state.metrics.moves} moves`;
    updateRematchUI();
    $('end-modal').classList.remove('hidden');
    if(!tied)fireworks?.start();
    $('again-btn').focus({preventScroll:true});
    playVictoryChime();
    if(options.online&&onlineState.isHost){sendUndoAvailability();if(onlineState.syncPending)sendAuthoritativeState();}
    tryStartRematch();
  }

  function invalidateMatch(){playback.reset();pendingCompletion=null;onlineState.awaitingPlayback=false;clearCaptureFeedback();turnClock.reset();clockHandled='';remoteClock=null;features?.discardPending();fireworks?.stop();hideHintExplanation();state.epoch++;state.aiTicket++;state.busy=false;state.activeMove=null;state.hintPit=null;updateSkipButton();closeAnimations();clearTimeout(toastTimer);$('toast').classList.remove('visible');}
  
  function startGame(broadcast=true,forcedStarter=null,remoteMatchId=null){
    if(options.online&&broadcast){requestCloudStart();return;}
    recovery.pauseAfterToss=false;options.firstMove='coin';
    clearCaptureFeedback();
    if(options.online&&broadcast&&!roomCanStart()&&!canStartRematch({online:options.online,connected:onlineState.connected&&!peerStale,isHost:onlineState.isHost,over:state.over,busy:state.busy,...rematch})){
      toast(onlineState.isHost?'Both players must tap Ready first.':'Only the host can start the match.',2300);return;
    }
    lastTurnNotice=null;
    tournament.allocations=[];tournament.forcedDraw=false;tournament.endReason='';
    rematch.localReady=false;rematch.remoteReady=false;
    invalidateMatch();
    if(!practice)saveSettings();
    const S=options.seedsPerPit||5;
    state.pits=Array(N).fill(S);state.banks=[0,0,0];
    state.over=false;state.roundPending=false;state.paused=false;state.started=true;
    state.history=[];state.round=1;state.kasiePits=Array(N).fill(false);
    pauseBudget.reset();roomPause={revision:-1,used:[0,0,0],owner:0,remaining:0,id:'',at:Date.now()};
    state.metrics=emptyMetrics();state.matchId=remoteMatchId||`${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
    state.matchStartedAt=Date.now();state.recordedStatsBefore=null;state.resultRecorded=false;
    onlineState.pendingRemoteMoves=[];onlineState.pendingNextRound=null;
    onlineState.revision=0;onlineState.remoteUndoAvailable=false;onlineState.undoPending=false;
    onlineState.pendingUndoRequest=null;
    if(!options.online)names=modeIdentity({mode:options.ai?'ai':'two',ownName:selfName,peerName:passName});
    else names[onlineState.myPlayerIndex]=selfName;
    applyPlayerLabels();
    $('round-brand-sub').textContent=options.format==='kasie'?'ROUND 1 · KASIE TOURNAMENT':'SINGLE MATCH';
    for(const id of ['setup-modal','end-modal','stats-modal','quit-modal','round-modal'])$(id).classList.add('hidden');
    removeSavedMatch();ensureAudio();
    let starter=forcedStarter;
    if(![1,2].includes(starter)){
      if(options.firstMove==='coin')starter=Math.random()<.5?1:2;
      else if(options.firstMove==='alt')starter=state.lastStarter?other(state.lastStarter):1;
      else starter=options.firstMove==='p2'?2:1;
    }
    if(options.online&&broadcast){
      sendOnlinePacket({type:'START_GAME',protocol:PLAYBACK_PROTOCOL,starter,matchId:state.matchId,options:{...options},names:{...names}});
    }
    onlineState.awaitingSync=false;
    state.awaitingToss=options.firstMove==='coin';
    const begin=who=>{
      state.turn=who;state.currentRoundStarter=who;state.lastStarter=who;
      state.awaitingToss=false;finishTossRecovery();render();
      if(onlineState.syncPending)sendAuthoritativeState();
      setStatus(`${names[state.turn]}'s turn. Choose a cup on your side.`);
      saveStableMatch();processRemoteQueue();
      if(options.online&&onlineState.isHost)sendUndoAvailability();
      if(options.ai&&state.turn===2)scheduleAiTurn(()=>state.started&&!state.over);
    };
    if(practice)begin(1);else if(options.firstMove==='coin')launchCoinToss(begin,starter);
    else begin(starter);
  }
  async function fullscreen(){
    try {if(document.fullscreenElement)await document.exitFullscreen();
    else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}
    catch{toast('Fullscreen is unavailable in this browser.');}
  }

  /* ========================================================
     6 INTERACTIVE BILINGUAL TUTORIAL LESSONS
     Includes Lessons 1-4 (Basics) & Lessons 5-6 (Kasie Tournament)
     ======================================================== */
  const tutorialLessons=[
    {id:'sowing',selected:0,pits:[5,0,0,0,0,0,0,0,11,11,11,11,11,10],
      en:{title:'1. Sow one at a time',copy:'Tap the glowing bottom cup with 5 seeds. Watch one seed go into each following cup.',ready:'Tap the glowing cup to begin!',done:'Excellent! Five seeds were planted, one in each following cup.'},
      ta:{title:'1. விதைகளை விதைப்போம்',copy:'கீழே ஒளிரும் 5 விதைகள் உள்ள குழியைத் தொடுங்கள். அடுத்தடுத்த குழிகளில் ஒவ்வொரு விதையாகப் போகும்.',ready:'ஒளிரும் குழியைத் தொடுங்கள்!',done:'அருமை! ஐந்து குழிகளில் தலா ஒரு விதை விதைக்கப்பட்டது.'}},
    {id:'chain',selected:0,pits:[2,0,0,2,0,0,0,0,11,11,11,11,11,11],
      en:{title:'2. Keep sowing',copy:'After the first 2 seeds are placed, the next cup has seeds. The hand picks them up and continues.',ready:'Tap the highlighted cup with 2 seeds.',done:'Great! When the next cup contains seeds, sowing continues.'},
      ta:{title:'2. தொடர் விதைத்தல்',copy:'முதல் 2 விதைகள் தீர்ந்ததும் அடுத்த குழியில் விதைகள் இருந்தால் அவற்றையும் எடுத்துத் தொடர வேண்டும்.',ready:'ஒளிரும் 2 விதைகள் உள்ள குழியைத் தொடுங்கள்.',done:'நன்று! அடுத்த குழியில் விதைகள் இருந்ததால் தொடர்ந்து விதைத்தோம்.'}},
    {id:'pasu',selected:0,pits:[1,3,0,0,7,7,7,7,7,7,7,7,5,5],
      en:{title:'3. Pasu',copy:'The next cup already has 3 seeds. Drop one more to make exactly 4: its owner wins all four!',ready:'Tap the highlighted cup to trigger Pasu.',done:'Pasu! Four seeds moved into the owner’s store.'},
      ta:{title:'3. பசு · நான்கு விதைகள்',copy:'அடுத்த குழியில் 3 விதைகள் உள்ளன. மேலும் 1 விதை விழுந்தால் 4 விதைகளும் அந்தக் குழியின் உரிமையாளருக்குச் சேரும்.',ready:'பசு பெற ஒளிரும் குழியைத் தொடுங்கள்.',done:'பசு! நான்கு விதைகளும் உரிமையாளரின் தாய்க்குழியில் சேர்ந்தன.'}},
    {id:'capture',selected:0,pits:[1,0,0,6,7,7,7,7,7,7,7,7,4,3],
      en:{title:'4. Capture',copy:'After your last seed lands, if the next cup is empty, you collect seeds from the cup after that.',ready:'Tap the glowing cup to make a capture.',done:'You did it! Six seeds were captured. You’re ready for a real match!'},
      ta:{title:'4. விதைகளைக் கைப்பற்றுதல்',copy:'கையில் விதைகள் முடிந்ததும் அடுத்த குழி காலியாக இருந்தால், அதற்கு அடுத்த குழியின் விதைகளை எடுத்துக்கொள்ளலாம்.',ready:'விதைகளைக் கைப்பற்ற ஒளிரும் குழியைத் தொடுங்கள்.',done:'சூப்பர்! ஆறு விதைகள் கைப்பற்றப்பட்டன. இப்போது ஆடத் தயாராகிவிட்டீர்கள்!'}},
    {id:'kasie_lock',selected:0,pits:[5,5,5,5,5,0,0, 5,5,5,5,5,10,10],
      kasie:[false,false,false,false,false,true,true, false,false,false,false,false,false,false],
      en:{title:'5. Kasie Pit Lock',copy:'When a player cannot fill all 7 cups after a round, unfilled cups are locked as Kasie (locked). You cannot scoop from locked cups!',ready:'Tap the highlighted cup 1 to sow into the board.',done:'Notice that seeds can land into locked cups, but the owner cannot scoop them!'},
      ta:{title:'5. காசி அடைப்பு · பூட்டிய குழிகள்',copy:'சுற்றின் முடிவில் போதிய விதைகள் இன்றி நிரப்ப முடியாத குழிகள் "காசி" என பூட்டப்படும் (🔒). பூட்டிய குழியிலிருந்து விதைகளை எடுக்க முடியாது!',ready:'ஒளிரும் குழி 1-ஐத் தொட்டு விதைத்துப் பாருங்கள்.',done:'விதைகள் காசி குழிக்குள் விழலாம், ஆனால் அதன் உரிமையாளர் அவற்றை எடுக்க முடியாது!'}},
    {id:'kasie_roadblock',selected:0,pits:[1,0,2,6,7,7,7, 7,7,7,7,7,5,0],
      kasie:[false,false,true,false,false,false,false, false,false,false,false,false,false,false],
      en:{title:'6. Kasie Roadblock',copy:'Locked Kasie cups cannot be picked up to continue sowing—they act as a stop, letting you capture the cup right after them!',ready:'Tap the glowing cup to capture 6 seeds across the Kasie roadblock.',done:'Brilliant! You are now a master of both Single Match and Traditional Kasie Tournaments!'},
      ta:{title:'6. காசி உத்தி & அறுவடை',copy:'கையில் விதை முடிந்ததும் அடுத்த குழி காசியாக (🔒) இருந்தால் தொடர் விதைப்பு நின்று, அதற்கடுத்த குழியின் விதைகளைக் கைப்பற்றலாம்!',ready:'ஒளிரும் குழியைத் தொட்டு காசி ஆட்ட உத்தியைப் பாருங்கள்.',done:'அற்புதம்! ஒற்றைச் சுற்று மற்றும் பாரம்பரிய காசி ஆட்ட விதிகளை முழுமையாகக் கற்றுக்கொண்டீர்கள்!'}}
  ];
  const tutorial={open:false,step:0,lang:'en',pits:[],banks:[0,0,0],kasiePits:Array(N).fill(false),running:false,complete:false,ticket:0};
  function tutorialText(){return tutorialLessons[tutorial.step][tutorial.lang];}
  function tutorialFeedback(text){$('tutorial-feedback').textContent=text;}
  function tutorialRebuild(){
    const lesson=tutorialLessons[tutorial.step];
    tutorial.ticket++;tutorial.running=false;tutorial.complete=false;
    tutorial.pits=lesson.pits.slice();tutorial.banks=[0,0,0];
    tutorial.kasiePits=lesson.kasie ? lesson.kasie.slice() : Array(N).fill(false);
    if(tutorial.pits.reduce((a,b)=>a+b,0)!==TOTAL_SEEDS)throw new Error('Tutorial model must have exactly 70 seeds');
    $('tut-hand').classList.remove('visible');
    $('tutorial-next').disabled=true;
    $('tutorial-back').disabled=tutorial.step===0;
    tutorialDraw();
    tutorialFeedback(tutorialText().ready);
  }
  function tutorialDraw(activePit=null){
    const lesson=tutorialLessons[tutorial.step];
    $('tutorial-progress').textContent=tutorial.lang==='ta'?`பாடம் ${tutorial.step+1} / ${tutorialLessons.length}`:`LESSON ${tutorial.step+1} / ${tutorialLessons.length}`;
    $('tutorial-replay').textContent=tutorial.lang==='ta'?'↻ மீண்டும் பார்க்க':'↻ Replay';
    $('tutorial-exit').textContent=tutorial.lang==='ta'?'பயிற்சியை மூடு':'Close tutorial';
    $('tutorial-title').textContent=tutorialText().title;
    $('tutorial-copy').textContent=tutorialText().copy;
    $('tutorial-next').textContent=tutorial.step===tutorialLessons.length-1
      ? (state.started?(tutorial.lang==='ta'?'ஆட்டத்திற்குத் திரும்பு →':'Return to match →'):(tutorial.lang==='ta'?'ஆடத் தொடங்கலாம் →':'Play a match →'))
      : (tutorial.lang==='ta'?'அடுத்த பாடம் →':'Next lesson →');
    $('tut-bank1').textContent=tutorial.banks[1];$('tut-bank2').textContent=tutorial.banks[2];
    for(let i=0;i<N;i++){
      const btn=$('tut-pit-'+i),choice=!tutorial.running&&!tutorial.complete&&i===lesson.selected;
      const isKasie = Boolean(tutorial.kasiePits[i]);
      btn.textContent=tutorial.pits[i];
      btn.disabled=!choice;
      btn.classList.toggle('tut-choice',choice);
      btn.classList.toggle('tut-current',i===activePit);
      btn.classList.toggle('tut-kasie',isKasie);
      btn.setAttribute('aria-label',`${owner(i)===1?'Bottom':'Top'} cup ${i<7?i+1:14-i}, ${tutorial.pits[i]} seeds${isKasie?', locked as Kasie':''}${choice?', select this cup':''}`);
    }
  }

  function tutorialPoint(index){
    const pit=$('tut-pit-'+index),area=$('tutorial-board');
    const p=pit.getBoundingClientRect(),b=area.getBoundingClientRect();
    const hand=$('tut-hand');
    hand.style.left=p.left-b.left+p.width/2+'px';hand.style.top=p.top-b.top+p.height/2+'px';
    hand.classList.add('visible');
  }
  function tutorialMessage(event){
    const ta=tutorial.lang==='ta';
    switch(event.kind){
      case 'pickup':return ta?`${event.count} விதைகள் எடுக்கப்பட்டன`:`Picked up ${event.count} seeds`;
      case 'drop':return ta?'ஒரு விதையை அடுத்த குழியில் போட்டோம்':'One seed lands in the next cup';
      case 'pasu':return ta?'பசு! உரிமையாளருக்கு +4 விதைகள்':'Pasu! +4 seeds for the cup owner';
      case 'capture':return ta?`${event.count} விதைகள் கைப்பற்றப்பட்டன`:`Captured ${event.count} seeds!`;
      case 'no-capture':return ta?'அடுத்த குழிகள் காலி; விதைத்தல் முடிந்தது':'The next cup is empty. Sowing ends.';
      default:return '';
    }
  }
  async function tutorialPlay(index){
    if(!tutorial.open||tutorial.running||tutorial.complete||index!==tutorialLessons[tutorial.step].selected)return;
    let result;
    try{result=simulateMove(tutorial.pits,tutorial.banks,1,index,{pasu:'on',locked:tutorial.kasiePits});}
    catch(err){tutorialFeedback(err.message);return;}
    tutorial.running=true;const ticket=++tutorial.ticket;
    tutorialDraw();
    const still=()=>tutorial.open&&ticket===tutorial.ticket;
    for(const event of result.events){
      if(!still())return;
      if(event.kind==='pickup'){tutorial.pits[event.pit]=0;scoopSound(event.count);}
      if(event.kind==='drop'){tutorial.pits[event.pit]++;beadImpact('drop',.35);}
      if(event.kind==='pasu'){
        tutorial.pits[event.pit]=0;tutorial.banks[event.player]+=4;
        captureSound();
      }
      if(event.kind==='capture'){
        tutorial.pits[event.pit]=0;tutorial.banks[event.player]+=event.count;
        captureSound();
      }
      if(event.pit!==undefined)tutorialPoint(event.pit);
      tutorialDraw(event.pit??null);tutorialFeedback(tutorialMessage(event));
      if(!reducedMotion())await wait(event.kind==='pasu'||event.kind==='capture'?540:260);
      else await wait(30);
    }
    if(!still())return;
    if(tutorial.pits.some((v,i)=>v!==result.pits[i])||tutorial.banks[1]!==result.banks[1]||tutorial.banks[2]!==result.banks[2]){
      tutorial.running=false;tutorialFeedback('Tutorial playback mismatch. Press Replay.');return;
    }
    tutorial.running=false;tutorial.complete=true;tutorialDraw();
    try{localStorage.setItem('pallanguzhi.lesson',String(Math.min(5,tutorial.step+1)));}catch{}
    $('tut-hand').classList.remove('visible');
    $('tutorial-next').disabled=false;
    tutorialFeedback(tutorialText().done);
  }
  function tutorialSetLanguage(lang){
    if(lang!=='en'&&lang!=='ta')return;
    tutorial.lang=lang;
    document.querySelectorAll('[data-tut-lang]').forEach(btn=>{
      const active=btn.dataset.tutLang===lang;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active));
    });
    tutorialDraw();
    if(!tutorial.running)tutorialFeedback(tutorialText()[tutorial.complete?'done':'ready']);
  }
  function tutorialOpen(){
    if(state.busy||state.activeMove){$('rules-modal').classList.add('hidden');toast('Finish the current move before opening the tutorial.',2300);return;}
    $('rules-modal').classList.add('hidden');
    if(options.online&&state.started&&!state.over&&!state.paused){toast(getLanguage()==='ta'?'பயிற்சிக்கு முகப்பைப் பயன்படுத்தவும் அல்லது முதலில் ஆட்டத்தை இடைநிறுத்தவும்':'Learn from Home, or explicitly pause the room match first',2300);return;}
    if(state.started&&!state.over&&!state.paused)openQuitModal();
    tutorial.open=true;try{tutorial.step=Math.min(5,Math.max(0,Number(localStorage.getItem('pallanguzhi.lesson')||0)||0));}catch{tutorial.step=0;}tutorialRebuild();
    $('tutorial-modal').classList.remove('hidden');
  }
  function tutorialClose(){
    tutorial.ticket++;tutorial.running=false;tutorial.open=false;
    $('tutorial-modal').classList.add('hidden');$('tut-hand').classList.remove('visible');
  }
  function tutorialNext(){
    if(!tutorial.open||tutorial.running||!tutorial.complete)return;
    if(tutorial.step===tutorialLessons.length-1){
      tutorialClose();
      if(!state.started){
        if(options.online){toast('Connect to a room, then the host starts the match.',2400);}
        else startGame();
      }
    }else{tutorial.step++;tutorialRebuild();}
  }
  function tutorialInit(){
    for(const [target,indices] of [['tut-top-row',[13,12,11,10,9,8,7]],['tut-bottom-row',[0,1,2,3,4,5,6]]]){
      const fragment=document.createDocumentFragment();
      for(const index of indices){
        const btn=document.createElement('button');btn.type='button';btn.id='tut-pit-'+index;
        btn.className='tutorial-pit';btn.addEventListener('click',()=>tutorialPlay(index));
        fragment.append(btn);
      }
      $(target).append(fragment);
    }
    $('tutorial-setup-btn').addEventListener('click',tutorialOpen);
    $('tutorial-rules-btn').addEventListener('click',tutorialOpen);
    $('tutorial-exit').addEventListener('click',tutorialClose);
    $('tutorial-replay').addEventListener('click',tutorialRebuild);
    $('tutorial-next').addEventListener('click',tutorialNext);
    $('tutorial-back').addEventListener('click',()=>{if(!tutorial.running&&tutorial.step>0){tutorial.step--;tutorialRebuild();}});
    document.querySelectorAll('[data-tut-lang]').forEach(btn=>btn.addEventListener('click',()=>{if(getLanguage()!==btn.dataset.tutLang)$('language-btn').click();else tutorialSetLanguage(btn.dataset.tutLang);}));
    tutorialRebuild();
  }

  function init(){
    loadSettings();
    stats=loadStats();
    state.pits = Array(N).fill(options.seedsPerPit);
    createBoard();
    installDialogAccess();$('dismiss-session-notice').addEventListener('click',()=>$('session-notice').hidden=true);
    tutorialInit();
    for(const p of [1,2]){$('wish-lamp-'+p).innerHTML=menuArt('lamp',String(p));$('wish-lamp-'+p).addEventListener('click',()=>{if(state.turn===p)showHint();});}
    wizard=setupWizard({mode:()=>options.online?'online':options.ai?'ai':'two',changed:()=>{},language:getLanguage});
    document.addEventListener('click',e=>{if(e.isTrusted&&e.target.closest('button:not(:disabled)')&&!e.target.closest('.pit'))uiClick();},true);
    ['room-ready-btn','room-final-ready-btn'].forEach(id=>$(id).addEventListener('click',()=>{if(!options.online||state.started)return;requestCloudStart();}));
    features=createFeatures({language:getLanguage,names:()=>names,state:()=>state,pasu:()=>options.pasu,toast,tutorial:tutorialOpen,send:sendOnlinePacket,network:()=>({connected:options.online&&onlineState.connected,player:onlineState.myPlayerIndex,matchId:state.matchId}),explanationEnabled:()=>explainAI,toggleExplanation:()=>{explainAI=!explainAI;try{localStorage.setItem('pallanguzhi.ai.explain',explainAI?'1':'0');}catch{}},chatBadge:n=>{$('chat-fab').dataset.unread=n||'';}});
    $('features-btn').addEventListener('click',()=>features.open());
    $('chat-fab').addEventListener('click',()=>features.openChat());
    $('home-puzzle-btn').addEventListener('click',()=>features.openPuzzle());
    $('home-replays-btn').addEventListener('click',()=>features.openHistory());
    $('practice-btn').addEventListener('click',startPractice);$('practice-again-btn').addEventListener('click',startPractice);$('practice-home-btn').addEventListener('click',showSetup);$('practice-exit-btn').addEventListener('click',showSetup);
    $('practice-full-btn').addEventListener('click',()=>{practice=false;practiceOptions=null;$('practice-end-modal').classList.add('hidden');startGame(true);});
    $('practice-guidance-btn').addEventListener('click',()=>{practiceGuidance=!practiceGuidance;practiceLastHint='';if(!practiceGuidance){state.hintPit=null;hideHintExplanation();}render();});
    $('capture-detail-btn').addEventListener('click',()=>{const text=lastCapture?captureExplanation(lastCapture,state.kasiePits,{1:displayName(1),2:displayName(2)},getLanguage()==='ta'):[1,2].map(player=>kasieExplanation(displayName(player),7-state.kasiePits.filter((v,i)=>v&&owner(i)===player).length,getLanguage()==='ta')).join(' ');openExplanation(text);});
    $('close-capture-detail').addEventListener('click',()=>$('capture-detail-modal').classList.add('hidden'));
    const syncGameAudio=()=>{$('audio-mute-btn').textContent=options.sound?translate('Mute'):translate('Unmute');for(const [prefix,property] of [['game','volume'],['game-seed','seedVolume'],['game-ui','uiVolume']]){$(prefix+'-volume-input').value=Math.round(options[property]*100);$(prefix+'-volume-display').textContent=Math.round(options[property]*100)+'%';}};
    $('audio-btn').addEventListener('click',()=>{syncGameAudio();$('audio-modal').classList.remove('hidden');});$('close-audio').addEventListener('click',()=>$('audio-modal').classList.add('hidden'));
    for(const [prefix,property] of [['game','volume'],['game-seed','seedVolume'],['game-ui','uiVolume']])$(prefix+'-volume-input').addEventListener('input',e=>{options[property]=Number(e.target.value)/100;$(prefix+'-volume-display').textContent=e.target.value+'%';saveSettings();ensureAudio();if(audio)audio.pallanguzhiMaster.gain.setTargetAtTime(options.sound?options.volume:0,audio.currentTime,.02);});
    $('audio-mute-btn').addEventListener('click',()=>{$('sound-btn').click();syncGameAudio();});$('daily-puzzle-art').innerHTML=menuArt('puzzle');
    $('room-pause-resume').addEventListener('click',resumeOwnedPause);
    if('serviceWorker' in navigator&&!window.PallanguzhiNative&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});

    refreshResumePanel();
    initBackButtonHandler();
    installRecovery();
    setInterval(()=>{pauseTick();if(state.started&&!state.over&&!state.roundPending)updateTurnClock();},250);
    installNativeLifecycle();
    installLanguage(lang=>{wizard?.refresh();features?.refresh();document.querySelectorAll('#final-scores .result-player > span').forEach((el,i)=>el.textContent=displayName(i+1));tutorialSetLanguage(lang);refreshResumePanel();if(isModalOpen('stats-modal'))renderStats();if(isModalOpen('round-modal'))showRoundSummary();render();});
    // Treat a direct room link as a guest, not a new host room.
    const incomingRoom=new URLSearchParams(window.location.search).get('room');
    if(incomingRoom&&/^[A-Z2-9]{8}$/i.test(incomingRoom)){
      options.online=true;options.ai=false;onlineState.isHost=false;onlineState.myPlayerIndex=2;wizard?.goto(2);
    }
    syncSetupModalUI();
    const peerLoader=$('peerjs-loader');
    if(peerLoader)peerLoader.addEventListener('load',()=>{
      if(!options.online||onlineState.connected)return;
      if(onlineState.isHost&&!onlineState.peer)initOnlineHost();
      if(!onlineState.isHost&&!onlineState.peer&&onlineState.roomCode)joinOnlineRoom(onlineState.roomCode);
    });

    // Check URL parameters for direct room join: e.g. index.html?room=7K9X2
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if(roomParam&&/^[A-Z2-9]{8}$/i.test(roomParam)){
      $('join-room-input').value = roomParam.trim().toUpperCase();
      setTimeout(() => joinOnlineRoom(roomParam), 400);
    }

    // Connect Pause/Quit Dialog Controls
    $('quit-resume-btn').addEventListener('click', closeQuitModal);
    $('quit-menu-btn').addEventListener('click', () => {
      closeQuitModal(false);
      saveStableMatch();
      showSetup();
    });

    $('stats-btn').addEventListener('click',openStats);
    $('result-stats-btn').addEventListener('click',()=>{openStats();});
    $('close-stats-btn').addEventListener('click',closeStats);
    $('reset-stats-btn').addEventListener('click',resetStats);
    $('resume-btn').addEventListener('click',resumeMatch);
    $('discard-save-btn').addEventListener('click',discardSavedMatch);
    
    document.querySelectorAll('[data-mode],[data-toss],[data-format],[data-seedscount],[data-pasu],[data-difficulty],[data-theme],[data-seeds],[data-clock],[data-call]').forEach(btn=>{
      const group=btn.dataset.mode!==undefined?'mode':btn.dataset.toss!==undefined?'toss':btn.dataset.format!==undefined?'format':btn.dataset.seedscount!==undefined?'seedscount':btn.dataset.pasu!==undefined?'pasu':btn.dataset.difficulty!==undefined?'difficulty':btn.dataset.theme!==undefined?'theme':btn.dataset.clock!==undefined?'clock':btn.dataset.call!==undefined?'call':'seeds';
      btn.addEventListener('click',()=>selectOption(group,btn.dataset[group]));
    });

    $('room-retry-btn').addEventListener('click',()=>{if(cloud.seat&&cloud.seat.code===onlineState.roomCode){cloud.reconnect();}else if(onlineState.isHost){void cloudHost();}else void cloudJoin($('join-room-input').value);});
    $('room-create-tab').addEventListener('click',()=>chooseRoomTab(false));$('room-join-tab').addEventListener('click',()=>chooseRoomTab(true));
    // Online UI Event Listeners
    document.querySelectorAll('[data-emote]').forEach(button=>button.addEventListener('click',()=>{
      if(!options.online||!onlineState.connected)return;
      const emoji=button.dataset.emote;
      showEmoteReaction(emoji,onlineState.myPlayerIndex);
      sendOnlinePacket({type:'REACTION',emoji});
    }));
    $('copy-code-btn').addEventListener('click', async () => {
      const code = ensureRoomCode();
      const ok = await copyTextSafe(code);
      toast(ok ? `🔢 Room Code ${code} copied!` : `Room Code: ${code}`, 1800);
    });

    $('copy-room-btn').addEventListener('click', async () => {
      const code = ensureRoomCode();
      const shareUrl = getShareableGameUrl(code);
      const payload = getLanguage()==='ta'?(shareUrl?`${shareUrl} (அறைக் குறியீடு: ${code})`:`பல்லாங்குழி அறைக் குறியீடு: ${code}`):(shareUrl ? `${shareUrl} (Room Code: ${code})` : `Pallanguzhi Room Code: ${code}`);
      const ok = await copyTextSafe(payload);
      toast(ok ? '📋 Room invite copied to clipboard!' : `Room Code: ${code}`, 1800);
    });

    $('wa-share-btn').addEventListener('click', () => {
      const code = ensureRoomCode();
      const shareUrl = getShareableGameUrl(code);
      const ta=getLanguage()==='ta';
      const text=ta?`🎲 என்னுடன் பல்லாங்குழி ஆடுங்கள்!\n🔑 அறைக் குறியீடு: *${code}*${shareUrl?'\n👉 இணையுங்கள்: '+shareUrl:''}`:`🎲 Play Pallanguzhi with me!\n🔑 Room Code: *${code}*${shareUrl?'\n👉 Tap to join: '+shareUrl:''}`;
      void shareToWhatsApp(text);
    });

    $('result-wa-btn').addEventListener('click', () => {
      const s1 = state.banks[1], s2 = state.banks[2];
      const total = getTotalSeeds();
      const shareUrl = getShareableGameUrl('');
      const summary = tournament.forcedDraw || s1 === s2
        ? `🤝 Draw match (${s1}–${s2})`
        : `${s1 > s2 ? names[1] : names[2]} won with ${Math.max(s1, s2)}/${total} seeds!`;
      const ta=getLanguage()==='ta';
      const localizedSummary=ta?(tournament.forcedDraw||s1===s2?`🤝 சமநிலை (${s1}–${s2})`:`${s1>s2?names[1]:names[2]} ${Math.max(s1,s2)}/${total} விதைகளுடன் வென்றார்!`):summary;
      const text=`${ta?'🏆 பல்லாங்குழி · பாரம்பரியம்':'🏆 Pallanguzhi Heritage'}\n${localizedSummary}\n${names[1]}: ${s1} | ${names[2]}: ${s2}${shareUrl?'\n👉 '+(ta?'இங்கே ஆடுங்கள்: ':'Play here: ')+shareUrl:''}`;
      void shareToWhatsApp(text);
    });

    $('join-room-btn').addEventListener('click', () => {
      const code = $('join-room-input').value.trim();
      joinOnlineRoom(code);
    });

    $('p1-input').addEventListener('input', e => {
      selfName=e.target.value.trim().slice(0,18)||'Player 1';names[options.online?onlineState.myPlayerIndex:1]=selfName;
      if(options.online){lobby.localReady=false;if(onlineState.connected){broadcastReady();sendOnlinePacket(onlineState.isHost?{type:'CONFIG_SYNC',options:{...options},hostName:selfName}:{type:'GUEST_HELLO',guestName:selfName});}updateOnlineControls();}
      saveSettings();
    });


    $('p2-input').addEventListener('input',e=>{if(options.ai||options.online)return;passName=e.target.value.trim().slice(0,18)||'Player 2';names[2]=passName;$('setup-opponent-name').textContent=displayName(2);saveSettings();});

    for(const kind of ['seed','ui'])$(kind+'-volume-input').addEventListener('input',e=>{options[kind+'Volume']=Number(e.target.value)/100;$(kind+'-volume-display').textContent=e.target.value+'%';saveSettings();ensureAudio();});
    $('volume-input').addEventListener('input',e=>{
      options.volume=Number(e.target.value)/100;
      $('volume-display').textContent=e.target.value+'%';
      saveSettings();
      if(audio)audio.pallanguzhiMaster.gain.setTargetAtTime(options.sound?options.volume:0,audio.currentTime,.02);
      uiClick();
    });
    const closeTools=(focus=false)=>{
      $('tools-panel').hidden=true;$('tools-toggle').setAttribute('aria-expanded','false');
      if(focus)$('tools-toggle').focus();
    };
    fireworks=createFireworks($('fireworks-canvas'));
    document.querySelectorAll('.header-tools button').forEach(b=>b.addEventListener('pointerdown',()=>{document.body.dataset.dialogOwner='neutral';document.body.dataset.toolsOwner='neutral';}));
    document.querySelectorAll('[data-side-tools]').forEach(b=>b.addEventListener('click',()=>{document.body.dataset.dialogOwner=b.dataset.sideTools;document.body.dataset.toolsOwner=b.dataset.sideTools;$('tools-toggle').click();}));
    document.querySelectorAll('[data-side-pause]').forEach(b=>b.addEventListener('click',()=>{document.body.dataset.dialogOwner=b.dataset.sidePause;$('pause-btn').click();}));
    document.querySelectorAll('[data-side-owner]').forEach(b=>b.addEventListener('click',()=>{document.body.dataset.dialogOwner=b.dataset.sideOwner;}));
    $('tool-stats-btn').addEventListener('click',openStats);
    $('mat-btn').addEventListener('click',()=>{
      document.querySelectorAll('.mat-choice[data-mat]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mat===options.mat)));
      $('extra-mat-choices').open=!PRIMARY_MATS.includes(options.mat);$('mat-modal').classList.remove('hidden');
    });
    document.querySelectorAll('.mat-choice[data-mat]').forEach(b=>b.addEventListener('click',()=>{options.mat=validMat(b.dataset.mat);document.body.dataset.mat=options.mat;saveSettings();$('mat-modal').classList.add('hidden');}));
    $('close-mat').addEventListener('click',()=>$('mat-modal').classList.add('hidden'));
    $('tools-toggle').addEventListener('click',event=>{
      if(event.isTrusted){document.body.dataset.toolsOwner='neutral';document.body.dataset.dialogOwner='neutral';}
      const opening=$('tools-panel').hidden;if(!opening){closeTools();return;}
      $('tools-panel').hidden=false;$('tools-toggle').setAttribute('aria-expanded','true');
    });
    $('tools-panel').addEventListener('click',e=>{if(e.target.closest('button'))closeTools();});
    document.addEventListener('pointerdown',e=>{if(!$('tools-panel').hidden&&!e.target.closest('#tools-panel,#tools-toggle,[data-side-tools]'))closeTools();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('tools-panel').hidden){e.preventDefault();e.stopImmediatePropagation();closeTools(true);}},true);
    $('speed-btn').setAttribute('aria-label','Gameplay pace: natural. Tap to change.');
    $('skip-btn').addEventListener('click',skipCurrentMove);
    $('hint-btn').addEventListener('click',showHint);
    $('hint-dismiss').addEventListener('click',()=>{state.hintPit=null;hideHintExplanation();render();});
    $('undo-btn').addEventListener('click',undoMove);
    $('undo-end-btn').addEventListener('click',undoMove);
    $('quick-play-btn').addEventListener('click',()=>{
      selectOption('mode','ai');
      selectOption('format','single');
      selectOption('toss','p1');
      selectOption('seedscount','5');
      selectOption('pasu','on');
      selectOption('difficulty','easy');
      startGame(true);
    });
    $('start-btn').addEventListener('click',()=>startGame(true));
    $('again-btn').addEventListener('click',requestRematch);
    $('match-btn').addEventListener('click',showSetup);
    $('change-btn').addEventListener('click',showSetup);
    $('rules-btn').addEventListener('click',()=>$('rules-modal').classList.remove('hidden'));
    $('close-rules').addEventListener('click',()=>$('rules-modal').classList.add('hidden'));
    $('fit-btn').addEventListener('click',fullscreen);
    $('board-size-btn').addEventListener('click',()=>{if(state.busy){toast(getLanguage()==='ta'?'நகர்வு முடிந்ததும் பலகையின் அளவை மாற்றவும்':'Finish the move before changing board size',1600);return;}boardEnlarged=!boardEnlarged;fitBoard(true);if(boardEnlarged)toast(getLanguage()==='ta'?'பெரிய பலகை · முழுவதையும் பார்க்க நகர்த்தவும்':'Bigger board · pan to see the whole board',2400);});
    $('board-scroll').addEventListener('scroll',()=>{layoutDirty=true;lastHandPos=null;boardGestureUntil=performance.now()+200;}, {passive:true});
    $('board-scroll').addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};},{passive:true});
    $('board-scroll').addEventListener('pointercancel',()=>{boardGestureUntil=performance.now()+250;pointerStart=null;},{passive:true});
    $('board-scroll').addEventListener('pointerup',e=>{if(pointerStart&&Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>8)boardGestureUntil=performance.now()+200;pointerStart=null;},{passive:true});

    const toggleAppearance=()=>{options.uiTheme=options.uiTheme==='light'?'dark':'light';saveSettings();syncSetupModalUI();};
    $('theme-btn').addEventListener('click',toggleAppearance);$('appearance-setup-btn').addEventListener('click',toggleAppearance);

    $('speed-btn').addEventListener('click',()=>{
      if(options.online){toast('Room pace is fixed for this match.',1800);return;}
      if(options.online&&(!onlineState.isHost||state.busy)){toast(onlineState.isHost?'Wait until both phones finish sowing.':'The host controls the room pace.',1800);return;}
      options.pace=options.pace==='natural'?'relaxed':options.pace==='relaxed'?'fast':'natural';
      options.fast=options.pace==='fast';
      updatePaceUI();
      if(options.online&&onlineState.connected)sendOnlinePacket({type:'ROOM_PACE',matchId:state.matchId,pace:options.pace});
      saveSettings();
    });
    $('sound-btn').addEventListener('click',()=>{
      options.sound=!options.sound;
      $('sound-btn').textContent=options.sound?'🔊 Sound':'🔇 Muted';
      $('sound-btn').setAttribute('aria-pressed',String(options.sound));
      $('sound-btn').classList.toggle('sound-off',!options.sound);
      saveSettings();
      if(audio)audio.pallanguzhiMaster.gain.setTargetAtTime(options.sound?options.volume:0,audio.currentTime,.02);
      if(options.sound)beadImpact('drop',1);
    });

    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        if(isModalOpen('mat-modal')){$('mat-modal').classList.add('hidden');return;}
        handleSystemBack();
      }
    });

    window.addEventListener('pointerdown', () => ensureAudio(), { once: true });
    window.addEventListener('resize',()=>{invalidateLayout();updatePaceUI();render();},{passive:true});
    window.addEventListener('orientationchange', invalidateLayout, {passive:true});
    document.addEventListener('fullscreenchange',()=>{invalidateLayout();requestAnimationFrame(invalidateLayout);});
    if(typeof ResizeObserver==='function'){
      const boardObserver=new ResizeObserver(invalidateLayout);
      boardObserver.observe(document.querySelector('.arena-stage'));
      boardObserver.observe(document.querySelector('.play-guide'));
      boardObserver.observe(document.querySelector('.top-strip'));
      boardObserver.observe(document.querySelector('.bottom-strip'));
    }
    fitBoard(true);
    window.PallanguzhiTest={simulateMove,settleIfFinished,validMoves,owner,skipCurrentMove,undoMove,showHint,recommendMove,getSnapshot:()=>({pits:state.pits.slice(),banks:state.banks.slice(),turn:state.turn,over:state.over,busy:state.busy,epoch:state.epoch,handVisible:$('player-hand').classList.contains('visible'),activeMove:Boolean(state.activeMove),pace:options.pace,difficulty:options.difficulty,history:state.history.length,hintPit:state.hintPit,handFacing:$('player-hand').dataset.facing}),startGame,chooseAI,
      getClock:()=>({...clockView,turnSeconds:options.turnSeconds}),
      tutorialOpen,tutorialRebuild,tutorialNext,tutorialPlay,tutorialSetLanguage,
      getTutorial:()=>({open:tutorial.open,step:tutorial.step,running:tutorial.running,complete:tutorial.complete,pits:tutorial.pits.slice(),banks:tutorial.banks.slice(),lang:tutorial.lang}),
      getStats:()=>JSON.parse(JSON.stringify(stats)),getSaved:()=>loadSavedMatch(),resumeMatch,discardSavedMatch,openStats,
      getPresentation:()=>({mat:options.mat,fireworks:fireworks?.inspect()}),
      getMetrics:()=>({...state.metrics}),playPit,showSetup,
      getRound:()=>({round:state.round,locked:state.kasiePits.slice(),pending:state.roundPending,options:{...options}}),
      setTestPosition:(p)=>{if(!p||!Array.isArray(p.pits)||p.pits.length!==N||!Array.isArray(p.banks))throw Error('Invalid test input'); invalidateMatch();state.pits=p.pits.slice();state.banks=p.banks.slice();state.kasiePits=normalizeKasie(p.kasiePits);state.turn=p.turn||1;state.round=p.round||1;state.started=true;state.over=false;render();},
      getMatch:()=>({matchId:state.matchId,started:state.started,over:state.over,resultRecorded:state.resultRecorded,round:state.round,awaitingToss:state.awaitingToss}),
      getRecovery:()=>({attempt:recovery.attempt,age:Date.now()-recovery.lastHeard,hidden:document.hidden,connOpen:Boolean(onlineState.conn?.open),awaitingSync:onlineState.awaitingSync,paused:state.paused,remotePaused:onlineState.remotePaused}),
      getPlayback:()=>playback.inspect(),
      getOnline:()=>({awaitingPlayback:onlineState.awaitingPlayback,isHost:onlineState.isHost,player:onlineState.myPlayerIndex,connected:onlineState.connected,roomCode:onlineState.roomCode,queued:onlineState.pendingRemoteMoves.length}),
      inspect:()=>({pits:state.pits.slice(),banks:state.banks.slice(),turn:state.turn,started:state.started,over:state.over,round:state.round,roundPending:state.roundPending,busy:state.busy,awaitingToss:state.awaitingToss,kasiePits:state.kasiePits.slice(),moves:state.metrics.moves,matchId:state.matchId}),
      injectOnlinePacket:handleOnlineMessage,drainOnline:processRemoteQueue};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();


