// Small, code-native menu artwork and mode-specific setup helpers.
export const FIXED_AI_NAME='Azhagi (AI)';
export function modeIdentity({mode,ownName='Player 1',peerName='Player 2',player=1}){
 const own=String(ownName).trim().slice(0,18)||'Player 1';
 if(mode==='ai')return {1:own,2:FIXED_AI_NAME};
 if(mode==='two')return {1:own,2:String(peerName||'Player 2').trim().slice(0,18)||'Player 2'};
 return player===2?{1:peerName,2:own}:{1:own,2:peerName};
}
export function lobbySignature(o){return [o.firstMove,o.format,o.seedsPerPit,o.pasu,o.turnSeconds??30].join('|');}
export function canStartRoom({connected,host,localReady,remoteReady,localSignature,remoteSignature}){
 return Boolean(connected&&host&&localReady&&remoteReady&&localSignature===remoteSignature);
}
export function acceptReady(packet,{room,player,signature}){
 return Boolean(packet&&packet.type==='LOBBY_READY'&&packet.room===room&&packet.player===player&&typeof packet.ready==='boolean'&&packet.signature===signature);
}
const defs='<defs><linearGradient id="gold" x2=".7" y2="1"><stop stop-color="#fff3ae"/><stop offset=".45" stop-color="#ffc848"/><stop offset="1" stop-color="#b36a0f"/></linearGradient><linearGradient id="jade" x2=".6" y2="1"><stop stop-color="#aaf9dc"/><stop offset="1" stop-color="#087b68"/></linearGradient></defs>';
export function menuArt(type,variant=''){
 const art={ai:'<rect x="23" y="31" width="74" height="57" rx="19" fill="url(#jade)" stroke="#d4fff1" stroke-width="3"/><path d="M60 31V18" stroke="#f6d284" stroke-width="5"/><circle cx="60" cy="15" r="6" fill="url(#gold)"/><ellipse cx="43" cy="53" rx="7" ry="9" fill="#14332f"/><ellipse cx="77" cy="53" rx="7" ry="9" fill="#14332f"/><path d="M43 72Q60 84 77 72" fill="none" stroke="#14332f" stroke-width="4"/><path d="M28 91H92L99 104H21Z" fill="url(#gold)"/>',two:'<circle cx="31" cy="31" r="14" fill="url(#gold)"/><circle cx="89" cy="31" r="14" fill="url(#jade)"/><path d="M17 87V60Q31 43 45 60L57 72L47 82L32 70V95H17M103 87V60Q89 43 75 60L63 72L73 82L88 70V95H103" fill="url(#gold)" stroke="#f9e4a4" stroke-width="3"/><rect x="40" y="86" width="40" height="17" rx="6" fill="#7a3822" stroke="#e9c07a" stroke-width="3"/>',online:'<circle cx="60" cy="53" r="36" fill="url(#jade)" stroke="#baffeb" stroke-width="3"/><ellipse cx="60" cy="53" rx="17" ry="36" fill="none" stroke="#136553" stroke-width="3"/><path d="M25 52H95M32 32Q60 48 88 32M32 74Q60 59 88 74" fill="none" stroke="#136553" stroke-width="3"/><rect x="8" y="66" width="27" height="39" rx="5" fill="url(#gold)" stroke="#fff0b0" stroke-width="2"/><rect x="85" y="66" width="27" height="39" rx="5" fill="url(#gold)" stroke="#fff0b0" stroke-width="2"/><path d="M41 94Q60 108 79 94" fill="none" stroke="#fce4a5" stroke-width="4"/>',lamp:'<path d="M25 58Q32 85 77 76Q92 73 95 58L111 43L88 49Q64 39 30 51L13 39Q7 36 7 46Q8 58 25 58Z" fill="url(#gold)" stroke="#8c5417" stroke-width="2"/><ellipse cx="58" cy="49" rx="29" ry="6" fill="#ffe7a0"/><path d="M45 43Q58 27 71 43M58 29V23M52 83H75L84 94H36Z" fill="url(#gold)" stroke="#8c5417" stroke-width="2"/><path d="M92 29Q104 17 97 6" fill="none" stroke="#b9efdf" stroke-width="4" stroke-linecap="round"/>'};
 // Separate SVG roots scope their gradients through unique IDs per artwork.
 const id='art-'+type+variant;return '<svg viewBox="0 0 120 120" aria-hidden="true">'+defs.replaceAll('id="gold"',`id="${id}-gold"`).replaceAll('id="jade"',`id="${id}-jade"`)+(art[type]||art.lamp).replaceAll('url(#gold)',`url(#${id}-gold)`).replaceAll('url(#jade)',`url(#${id}-jade)` )+'</svg>';
}
export function setupWizard({mode,changed,language}){
 const $=id=>document.getElementById(id);let step=1;
 const show=n=>{step=Math.max(1,Math.min(3,n));document.querySelectorAll('[data-setup-step]').forEach(el=>el.hidden=Number(el.dataset.setupStep)!==step);$('setup-progress').textContent=language()==='ta'?`படி ${step} / 3`:`Step ${step} of 3`;$('setup-back').hidden=step===1;$('setup-next').hidden=step===1||step===3;const card=$('setup-modal').querySelector('.home-card');card.scrollTop=0;};
 document.querySelectorAll('[data-mode]').forEach(b=>{b.querySelector('.mode-icon').innerHTML=menuArt(b.dataset.mode);b.addEventListener('click',()=>{changed(b.dataset.mode);show(2);});});
 $('setup-back').onclick=()=>show(step-1);$('setup-next').onclick=()=>show(3);
 return {goto:show,home:()=>show(1),refresh:()=>show(step),step:()=>step};
}
