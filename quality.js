// Shared result wording and deliberately limited, device-local technical diagnostics.
export function matchOutcome({scores=[0,0,0],names={},forcedDraw=false,language='en'}={}){
 const ta=language==='ta',a=Number(scores[1])||0,b=Number(scores[2])||0;
 const reason=forcedDraw?'repeated-position':a===b?'equal-score':'higher-score';
 const winner=reason==='higher-score'?(a>b?1:2):0;
 const title=reason==='repeated-position'?(ta?'சமநிலை — மீண்டும் வந்த நிலை':'Draw — repeated position'):reason==='equal-score'?(ta?'சமநிலை — சமமான மதிப்பெண்கள்':'Draw — equal scores'):(ta?`${names[winner]} வென்றார்!`:`${names[winner]} wins!`);
 const explanation=reason==='repeated-position'?(ta?'அதே காசி விதை ஒதுக்கீடு மூன்று முறை வந்ததால் ஆட்டம் சமநிலையில் முடிந்தது. மதிப்பெண்கள் வேறுபடலாம்.':'The same Kasie seed allocation occurred three times. The match is a draw even when scores differ.'):reason==='equal-score'?(ta?'இரு வீரர்களும் சமமான விதைகளைச் சேகரித்தனர்.':'Both players collected the same number of seeds.'):(ta?'அதிக விதைகளைச் சேகரித்த வீரர் வென்றார்.':'The player who collected more seeds wins.');
 return {reason,winner,draw:winner===0,title,explanation};
}
const EVENTS=new Set(['connected','disconnected','room-error','offline','online','background','foreground','animation-recovery','engine-error','script-error','promise-error','update-ready','storage-error']);
const CODES=new Set(['CONNECTION_TIMEOUT','ROOM_FULL_OR_STARTED','ROOM_EXPIRED_OR_NOT_FOUND','ROOM_CREATION_DISABLED','MESSAGE_TOO_FAST','BOTH_PLAYERS_MUST_BE_READY','STALE_MOVE','STALE_MATCH','STALE_PLAYBACK','MATCH_NOT_PLAYABLE','NOT_YOUR_TURN','INVALID_COMMAND','INTERNAL_ERROR','SEAT_UNAVAILABLE']);
export function createDiagnostics(storage){
 const key='pallanguzhi.diagnostics.v1';let entries=[];
 const safe=e=>e&&EVENTS.has(e.event)&&Number.isFinite(e.at)&&e.at>=0&&e.at<=8.64e15?{at:e.at,event:e.event,...(CODES.has(e.code)?{code:e.code}:{})}:null;
 try{entries=(JSON.parse(storage?.getItem(key)||'[]')||[]).map(safe).filter(Boolean).slice(-24);}catch{}
 function add(event,code=''){if(!EVENTS.has(event))return;const now=Date.now(),last=entries.at(-1);if(last?.event===event&&last?.code===(CODES.has(code)?code:undefined)&&now-last.at<2000)return;entries.push({at:now,event,...(CODES.has(code)?{code}:{})});entries=entries.slice(-24);try{storage?.setItem(key,JSON.stringify(entries));}catch{}}
 return {add,list:()=>entries.map(e=>({...e})),clear(){entries=[];try{storage?.removeItem(key);}catch{}},report:()=>entries.slice(-12).map(e=>`${new Date(e.at).toISOString()} ${e.event}${e.code?' '+e.code:''}`).join('\n')||'No technical events recorded.'};
}
export function connectionDetail({online=true,connected=false,transport={},phase='',mineDone=false,opponentDone=false,language='en',now=Date.now()}={}){
 const ta=language==='ta',t=(en,tamil)=>ta?tamil:en;
 if(!online)return t('You are offline. Turn on internet, then Retry. Moves are locked.','இணையம் இல்லை. இணையத்தை இயக்கி மீண்டும் முயலவும். நகர்வுகள் பூட்டப்பட்டுள்ளன.');
 if(transport.phase==='retrying')return t(`Reconnecting in ${Math.max(1,Math.ceil((transport.retryAt-now)/1000))}s · attempt ${transport.attempt}.`,`மீண்டும் இணைப்பு ${Math.max(1,Math.ceil((transport.retryAt-now)/1000))} வினாடிகளில் · முயற்சி ${transport.attempt}.`);
 if(transport.phase==='failed')return t('Connection stopped. Tap Retry, or return Home to use a new room.','இணைப்பு நின்றது. மீண்டும் முயலவும் அல்லது முகப்பில் புதிய அறையைப் பயன்படுத்தவும்.');
 if(['creating','joining','connecting','authenticating','synchronizing'].includes(transport.phase))return t(({creating:'Creating room…',joining:'Joining room…',connecting:'Opening connection…',authenticating:'Confirming your seat…',synchronizing:'Restoring the server board…'})[transport.phase],({creating:'அறை உருவாக்கம்…',joining:'அறையில் இணைப்பு…',connecting:'இணைப்பைத் திறக்கிறோம்…',authenticating:'உங்கள் இடத்தை உறுதிப்படுத்துகிறோம்…',synchronizing:'சேவையகப் பலகையை மீட்டெடுக்கிறோம்…'})[transport.phase]);
 if(!connected)return t('Waiting for your friend to connect. If they disconnected, they can reconnect to the same room.','நண்பர் இணைவதற்காகக் காத்திருக்கிறோம். துண்டிக்கப்பட்டால் அதே அறையில் மீண்டும் இணையலாம்.');
 if(phase==='playback')return mineDone&&!opponentDone?t('Your move animation is finished. Waiting for your friend’s animation; the next turn is locked.','உங்கள் நகர்வு காட்சி முடிந்தது. நண்பரின் காட்சி முடியும் வரை அடுத்த முறை பூட்டப்பட்டுள்ளது.'):t('Finishing the move on both phones…','இரு தொலைபேசிகளிலும் நகர்வை முடிக்கிறோம்…');
 return t('Connected · both phones use the room server’s board.','இணைக்கப்பட்டது · இரு தொலைபேசிகளும் அறைச் சேவையகப் பலகையைப் பயன்படுத்துகின்றன.');
}
export function installQualityUI(api){
 const $=id=>document.getElementById(id),ta=()=>api.language()==='ta',t=(en,tamil)=>ta()?tamil:en;
 let reduce=false,vibrate=false;try{const p=JSON.parse(localStorage.getItem('pallanguzhi.access.v1')||'{}');reduce=p.reduce===true;vibrate=p.vibrate===true;}catch{}
 function persist(){try{localStorage.setItem('pallanguzhi.access.v1',JSON.stringify({reduce,vibrate}));}catch{}refresh();}
 const extras=document.createElement('div');extras.className='quality-tools';extras.innerHTML='<button type="button" class="action-btn" id="motion-setting"></button><button type="button" class="action-btn" id="vibration-setting"></button><button type="button" class="action-btn" id="clear-diagnostics"></button>';$('tools-panel').append(extras);
 const detail=document.createElement('p');detail.id='room-network-detail';detail.dataset.noI18n='';detail.setAttribute('role','status');$('online-status-badge').after(detail);
 const life=document.createElement('p');life.id='room-lifetime';life.dataset.noI18n='';detail.after(life);
 const first=document.createElement('div');first.className='first-game-tip';first.innerHTML='<p id="first-game-copy"></p><button type="button" class="action-btn" id="first-game-learn"></button><button type="button" class="action-btn" id="first-game-skip"></button>';document.querySelector('.home-extras').before(first);
 try{first.hidden=localStorage.getItem('pallanguzhi.intro.v1')==='1'||Number(localStorage.getItem('pallanguzhi.lesson'))>0;}catch{}
 const dismiss=()=>{first.hidden=true;try{localStorage.setItem('pallanguzhi.intro.v1','1');}catch{}};
 $('first-game-learn').onclick=()=>{dismiss();api.tutorial();};$('first-game-skip').onclick=dismiss;
 $('motion-setting').onclick=()=>{reduce=!reduce;persist();};$('vibration-setting').onclick=()=>{vibrate=!vibrate;persist();};
 $('clear-diagnostics').onclick=()=>{if(confirm(t('Clear technical events saved on this device?','இச்சாதனத்தில் சேமித்த தொழில்நுட்ப நிகழ்வுகளை அழிக்கவா?'))){api.diagnostics.clear();api.toast(t('Technical events cleared.','தொழில்நுட்ப நிகழ்வுகள் அழிக்கப்பட்டன.'));}};
 const retry=document.createElement('button');retry.type='button';retry.id='session-retry';retry.onclick=api.retry;$('session-notice').append(retry);
 function tick(){const c=api.connection();detail.hidden=!c.enabled;life.hidden=!c.enabled;if(!c.enabled)return;const copy=connectionDetail({...c,language:api.language()});if(detail.textContent!==copy)detail.textContent=copy;const hours=Number.isFinite(c.expiresAt)?Math.max(0,Math.ceil((c.expiresAt-Date.now())/3600000)):null;life.textContent=t('Rooms expire after 24 hours without game activity. Reconnect in the same browser to keep your seat.','விளையாட்டு செயல்பாடு இல்லாமல் 24 மணிநேரத்தில் அறை காலாவதியாகும். உங்கள் இடத்தைத் தக்கவைக்க அதே உலாவியில் மீண்டும் இணையவும்.')+(hours===null?'':t(` About ${hours}h remaining.`,` சுமார் ${hours} மணி மீதமுள்ளது.`));retry.hidden=!c.enabled||c.connected||c.transport.phase==='retrying'||c.transport.phase==='connecting';retry.textContent=t('Retry connection','மீண்டும் இணை');}
 function refresh(){document.body.classList.toggle('reduce-motion',reduce);$('motion-setting').textContent=t('Reduced motion: ','குறைந்த அசைவு: ')+(reduce?t('On','இயக்கு'):t('Use device setting','சாதன அமைப்பு'));$('motion-setting').setAttribute('aria-pressed',String(reduce));$('vibration-setting').textContent=t('Turn vibration: ','முறை அதிர்வு: ')+(vibrate?t('On','இயக்கு'):t('Off','நிறுத்து'));$('vibration-setting').setAttribute('aria-pressed',String(vibrate));$('clear-diagnostics').textContent=t('Clear technical events','தொழில்நுட்ப நிகழ்வுகளை அழி');$('first-game-copy').textContent=t('New to Pallanguzhi? Learn sowing and captures with a short guided tutorial. Computer and two-player modes can work offline after the game is cached.','பல்லாங்குழி புதிதா? சிறு பயிற்சியில் விதைத்தல், கைப்பற்றல் கற்கலாம். சேமித்த பிறகு கணினி மற்றும் இருவர் முறைகளை இணையமின்றி ஆடலாம்.');$('first-game-learn').textContent=t('Show me how','பயிற்சியைக் காட்டு');$('first-game-skip').textContent=t('Skip for now','இப்போது தவிர்');tick();}
 window.addEventListener('beforeunload',e=>{if(api.active()){e.preventDefault();e.returnValue='';}});
 window.addEventListener('error',()=>api.diagnostics.add('script-error'));window.addEventListener('unhandledrejection',()=>api.diagnostics.add('promise-error'));
 window.addEventListener('pageshow',e=>{if(e.persisted)api.retry();});setInterval(tick,1000);refresh();
 return {refresh,reduced:()=>reduce,notifyTurn(){if(vibrate&&!document.hidden)try{navigator.vibrate?.(35);}catch{}}};
}
