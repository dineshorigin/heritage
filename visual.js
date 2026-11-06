// Presentation helpers use game state only; they never decide moves or scores.
import {matchOutcome} from './quality.js?v=3.30.2';
export function matchStatus(g){
 const ta=g.language==='ta',t=(en,tamil)=>ta?tamil:en;
 if(!g.started)return {kind:'idle',title:t('Ready to play','விளையாடத் தயார்')};
 if(g.over)return {kind:'complete',title:t('Match complete','ஆட்டம் முடிந்தது')};
 if(g.online&&!g.connected)return {kind:'connection',title:t('Reconnecting — moves locked','மீண்டும் இணைப்பு — நகர்வுகள் பூட்டு')};
 if(g.paused)return {kind:'paused',title:t('Match paused','ஆட்டம் இடைநிறுத்தம்')};
 if(g.roundPending)return {kind:'round',title:t('Round complete','சுற்று முடிந்தது')};
 if(g.awaitingToss)return {kind:'toss',title:t('Choosing the first player','முதல் வீரரைத் தேர்ந்தெடுக்கிறோம்')};
 if(g.awaitingPlayback)return {kind:'waiting',title:t('Finishing on both phones…','இரு தொலைபேசிகளிலும் முடிக்கிறோம்…')};
 if(g.awaitingSync)return {kind:'waiting',title:t('Synchronizing boards…','பலகைகள் ஒத்திசைவு…')};
 if(g.thinking)return {kind:'waiting',title:t('Computer is thinking…','கணினி யோசிக்கிறது…')};
 if(g.busy)return {kind:'sowing',title:t(`${g.name} is sowing`,`${g.name} விதைக்கிறார்`)};
 if(g.ai&&g.turn===2)return {kind:'waiting',title:t('Computer is thinking…','கணினி யோசிக்கிறது…')};
 if(g.online&&g.turn!==g.player)return {kind:'opponent',title:t(`${g.name}’s turn`,`${g.name} முறை`)};
 return {kind:'your-turn',title:g.online||g.ai?t('Your turn — choose a cup','உங்கள் முறை — குழியைத் தேர்வு செய்'):t(`${g.name}’s turn`,`${g.name} முறை`)};
}
export function lobbyCards({players=[],self=1,online=false,language='en',names={}}={}){
 const ta=language==='ta',t=(en,tamil)=>ta?tamil:en;
 return [1,2].map(player=>{const p=players[player];return {player,name:p?.name||names[player]||t(player===self?'You':'Your friend',player===self?'நீங்கள்':'உங்கள் நண்பர்'),state:!p?'empty':!online||!p.connected?'offline':p.ready?'ready':'connected',label:!p?t('Waiting to join','இணைவதற்குக் காத்திருக்கிறது'):!online||!p.connected?t('Reconnecting','மீண்டும் இணைப்பு'):p.ready?t('Ready','தயார்'):t('Connected · not ready','இணைப்பு · இன்னும் தயாரில்லை'),role:player===self?t('You','நீங்கள்'):t('Friend','நண்பர்')};});
}
export function shareModel({scores,names,forcedDraw,language='en',url='',version='3.30.2',mat='emerald'}={}){
 const result=matchOutcome({scores,names,forcedDraw,language}),safeNames=[1,2].map(p=>String(names[p]||'Player').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,36));
 let link='';try{const u=new URL(url);if(['https:','http:'].includes(u.protocol))link=u.origin+u.pathname;}catch{}
 return {title:result.title,reason:result.reason,draw:result.draw,names:safeNames,scores:[scores[1],scores[2]],language,url:link,version,mat};
}
function wrapped(ctx,text,x,y,maxWidth,lineHeight,maxLines=3){
 let lines=[],line='';for(const word of String(text).split(/\s+/)){const trial=line?line+' '+word:word;if(ctx.measureText(trial).width<=maxWidth){line=trial;continue;}if(line)lines.push(line);line=word;while(ctx.measureText(line).width>maxWidth){let n=line.length;while(n>1&&ctx.measureText(line.slice(0,n)).width>maxWidth)n--;lines.push(line.slice(0,n));line=line.slice(n);}}if(line)lines.push(line);
 if(lines.length>maxLines){lines=lines.slice(0,maxLines);let last=lines.at(-1);while(last&&ctx.measureText(last+'…').width>maxWidth)last=last.slice(0,-1);lines[lines.length-1]=last+'…';}
 lines.forEach((value,i)=>ctx.fillText(value,x,y+i*lineHeight));return lines.length*lineHeight;
}
export function drawResultCard(ctx,m,board){
 const ta=m.language==='ta',t=(en,tamil)=>ta?tamil:en,colour={emerald:'#0b483c',burgundy:'#5a233b',navy:'#203b65',sand:'#645231',plum:'#49325c',slate:'#34434c'}[m.mat]||'#0b483c';
 const round=(x,y,w,h,r,fill)=>{ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
 ctx.fillStyle=colour;ctx.fillRect(0,0,1080,1350);round(30,30,1020,1290,35,'#0a2020');ctx.strokeStyle='#d8b66d';ctx.lineWidth=3;ctx.stroke();
 ctx.textAlign='center';ctx.fillStyle='#e4c88f';ctx.font='bold 27px "Noto Sans Tamil",sans-serif';ctx.fillText('PALLANGUZHI · HERITAGE',540,100);
 ctx.fillStyle='#fff3d5';ctx.font='bold 50px "Noto Sans Tamil",sans-serif';wrapped(ctx,m.title,540,190,900,67,2);
 ctx.fillStyle='#d4ddce';ctx.font='27px "Noto Sans Tamil",sans-serif';ctx.fillText(m.reason==='repeated-position'?t('Repeated allocation · match declared a draw','மீண்டும் வந்த விதை ஒதுக்கீடு · சமநிலை'):m.draw?t('Both players collected equal seeds','இருவரும் சமமான விதைகள் பெற்றனர்'):t('A match well played','சிறப்பாக ஆடிய ஆட்டம்'),540,305);
 round(65,345,950,370,24,colour);if(board)ctx.drawImage(board,75,354,930,349);
 for(let i=0;i<2;i++){const x=70+i*480;round(x,775,460,245,24,'#193c37');ctx.fillStyle='#d9e4d5';ctx.font='bold 31px "Noto Sans Tamil",sans-serif';wrapped(ctx,m.names[i],x+230,827,410,39,2);ctx.fillStyle='#f8d793';ctx.font='bold 85px sans-serif';ctx.fillText(String(m.scores[i]),x+230,961);}
 ctx.fillStyle='#d1dbc9';ctx.font='26px "Noto Sans Tamil",sans-serif';ctx.fillText(t('Play with a friend','நண்பருடன் விளையாடுங்கள்'),540,1090);ctx.fillStyle='#f9d88d';ctx.font='bold 32px sans-serif';wrapped(ctx,m.url.replace(/^https?:\/\//,''),540,1150,900,42,2);ctx.fillStyle='#9db9aa';ctx.font='22px sans-serif';ctx.fillText('v'+m.version,540,1270);
}
export function installVisualUI(api){
 document.body.classList.add('ui-polished');
 const $=id=>document.getElementById(id),t=(en,ta)=>api.language()==='ta'?ta:en;
 // Consolidate live messages and primary controls into one reserved bottom row.
 const bar=document.createElement('div');bar.className='match-status-bar';bar.innerHTML='<div class="match-status-copy"><strong id="match-status-heading" role="status" aria-live="polite" data-no-i18n></strong><div id="match-status-detail"></div></div><div id="match-primary-actions"></div>';
 $('turn-guide').before(bar);$('match-status-detail').append($('turn-guide'),$('capture-guide'),$('capture-detail-btn'));$('match-primary-actions').append($('chat-fab'),$('tools-toggle'));
 bar.prepend($('chat-notification'));const chatVisibility=()=>bar.classList.toggle('chat-visible',!$('chat-notification').hidden);new MutationObserver(chatVisibility).observe($('chat-notification'),{attributes:true,attributeFilter:['hidden']});chatVisibility();
 $('status-text').setAttribute('aria-live','off');$('status-text').hidden=true;
 const cards=document.createElement('div');cards.id='lobby-player-cards';cards.className='lobby-player-cards';cards.dataset.noI18n='';
 for(const p of [1,2]){const card=document.createElement('div');card.className='lobby-player-card';card.id='lobby-card-'+p;card.innerHTML='<small id="lobby-role-'+p+'"></small><strong id="lobby-name-'+p+'"></strong><span id="lobby-state-'+p+'"></span>';cards.append(card);const dot=document.createElement('span');dot.id='dock-connection-'+p;dot.className='dock-connection';dot.setAttribute('role','img');$('dock-name-'+p).before(dot);}
 $('room-peer-name').parentElement.before(cards);
 const summary=document.createElement('p');summary.id='match-settings-summary';summary.dataset.noI18n='';$('advanced-rules').before(summary);
 const imageButton=document.createElement('button');imageButton.type='button';imageButton.id='result-image-btn';imageButton.className='secondary-btn';$('again-btn').after(imageButton);
 const download=document.createElement('button');download.type='button';download.id='result-save-image-btn';download.className='secondary-btn';$('result-wa-btn').after(download);
 const output=document.createElement('p');output.id='result-image-status';output.setAttribute('role','status');download.after(output);
 const options=document.createElement('details');options.className='result-extra-actions';const label=document.createElement('summary');label.id='result-extra-label';options.append(label);$('result-stats-btn').before(options);options.append(download,$('result-wa-btn'),$('result-stats-btn'),$('change-btn'),$('end-modal').querySelector('[data-feedback]'));
 let busy=false,boardPromise=null;
 const boardImage=()=>boardPromise||=(new Promise(resolve=>{const img=new Image(),timer=setTimeout(()=>resolve(null),5000);img.onload=()=>{clearTimeout(timer);resolve(img);};img.onerror=()=>{clearTimeout(timer);resolve(null);};img.src=new URL('./reference-board.webp',import.meta.url).href;}));
 async function imageAction(share){
  if(busy)return;busy=true;imageButton.disabled=download.disabled=true;output.textContent=t('Preparing your result image…','முடிவுப் படத்தைத் தயாரிக்கிறோம்…');
  try{const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;const ctx=canvas.getContext('2d');if(!ctx)throw Error('CANVAS');const model=shareModel(api.result());const board=await boardImage();await document.fonts?.ready;drawResultCard(ctx,model,board);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG');const file=new File([blob],'Pallanguzhi-result.png',{type:'image/png'});
   if(share&&navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:'Pallanguzhi Heritage'});output.textContent=t('Result image shared.','முடிவுப் படம் பகிரப்பட்டது.');}
   else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);output.textContent=t('Image download opened. Attach the PNG in WhatsApp to share it.','படப் பதிவிறக்கம் திறக்கப்பட்டது. PNG படத்தை வாட்ஸ்அப்பில் இணைத்துப் பகிரவும்.');}
  }catch(e){output.textContent=e.name==='AbortError'?t('Sharing cancelled. You can try again.','பகிர்வு ரத்து. மீண்டும் முயலலாம்.'):t('Could not create the image. Use Share text instead.','படம் உருவாக்க முடியவில்லை. உரையாகப் பகிரவும்.');}finally{busy=false;imageButton.disabled=download.disabled=false;}
 }
 imageButton.onclick=()=>void imageAction(true);download.onclick=()=>void imageAction(false);
 function update(){const g=api.state();if(g.over){$('end-modal').querySelector('.victory-emblem').textContent=api.result().forcedDraw||api.result().scores[1]===api.result().scores[2]?'🤝':'🏆';}const status=matchStatus({...g,language:api.language()});bar.dataset.kind=status.kind;const heading=$('match-status-heading');if(heading.textContent!==status.title)heading.textContent=status.title;
  const models=lobbyCards({...api.lobby(),language:api.language()});for(const m of models){$('lobby-card-'+m.player).dataset.state=m.state;$('lobby-name-'+m.player).textContent=m.name;$('lobby-role-'+m.player).textContent=m.role;$('lobby-state-'+m.player).textContent=m.label;const dot=$('dock-connection-'+m.player),online=g.online?api.lobby().players[m.player]?.connected:g.started;dot.dataset.state=online?'online':'offline';dot.title=g.online?(online?t('Connected','இணைப்பு'):t('Disconnected','துண்டிப்பு')):t('On this device','இச்சாதனத்தில்');dot.setAttribute('aria-label',dot.title);}
  const settings=api.settings();summary.textContent=t(`${settings.seeds} seeds · ${settings.format==='kasie'?'Kasie tournament':'Single match'} · Pasu ${settings.pasu} · ${g.online||!settings.seconds?'Untimed':settings.seconds+'s turns'}`,`${settings.seeds} விதைகள் · ${settings.format==='kasie'?'காசிப் போட்டி':'ஒற்றை ஆட்டம்'} · பசு ${settings.pasu==='on'?'உண்டு':'இல்லை'} · ${g.online||!settings.seconds?'நேர வரம்பில்லை':settings.seconds+' வினாடி'}`);
 }
 function refresh(){imageButton.textContent=t('Share result image','முடிவுப் படத்தைப் பகிர்');download.textContent=t('Save result image','முடிவுப் படத்தைச் சேமி');$('result-wa-btn').textContent=t('Share text on WhatsApp','வாட்ஸ்அப்பில் உரையாகப் பகிர்');$('result-extra-label').textContent=t('More options','மேலும் விருப்பங்கள்');$('advanced-rules').querySelector('summary').textContent=t('More match settings','மேலும் ஆட்ட அமைப்புகள்');update();}
 refresh();return {update,refresh};
}
