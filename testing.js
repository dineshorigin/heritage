export const APP_VERSION='3.29.1';
export const FEEDBACK_EMAIL='dineshbabuj1127@gmail.com';
const clean=(v,n=1200)=>String(v||'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').trim().slice(0,n);
export function feedbackDraft({message,category='Problem',device='',mode='Home',language='en',userAgent='',technicalDetails=''}={}){
 const text=clean(message);if(!text)throw Error('Please describe your feedback.');
 const topic=['Problem','Suggestion','Game rules','Other'].includes(category)?category:'Other';
 const subject=`Pallanguzhi ${APP_VERSION} — ${topic}`;
 const body=`Pallanguzhi feedback\nVersion: ${APP_VERSION}\nCategory: ${topic}\nMode: ${clean(mode,60)}\nLanguage: ${language==='ta'?'Tamil':'English'}\nDevice: ${clean(device,120)||'Not specified'}\nBrowser: ${clean(userAgent,250)||'Not specified'}\n\nFeedback / steps to reproduce:\n${text}\n${technicalDetails?'\nOptional technical events (no room codes, names, messages or tokens):\n'+clean(technicalDetails,1200)+'\n':''}\nPlease attach a screenshot or recording in your email app if helpful.\n`;
 return {subject,body,mailto:`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,copy:`To: ${FEEDBACK_EMAIL}\nSubject: ${subject}\n\n${body}`};
}
export function portraitRequired({coarse=false,orientation='',portrait=false,userAgent='',touchPoints=0}={}){
 const mobile=coarse||/Android|iPhone|iPad|iPod/i.test(userAgent)||touchPoints>1;
 return mobile&&(orientation?orientation.startsWith('portrait'):portrait);
}
export async function requestLandscape(doc,screen){
 let locked=false;
 try{if(!doc.fullscreenElement&&doc.documentElement.requestFullscreen)await doc.documentElement.requestFullscreen();}catch{}
 try{if(screen?.orientation?.lock){await screen.orientation.lock('landscape');locked=true;}}catch{}
 return {locked,fullscreen:Boolean(doc.fullscreenElement)};
}
export function installTestingUI(api){
 const $=id=>document.getElementById(id),ta=()=>api.language()==='ta',t=(en,tamil)=>ta()?tamil:en;
 let blocked=false,lockPending=null,autoAttempted=false,chatTimer=null,previousFocus=null,chatPacket=null;
 const gate=document.createElement('section');gate.id='landscape-gate';gate.className='overlay';gate.setAttribute('role','dialog');gate.setAttribute('aria-modal','true');gate.hidden=true;gate.setAttribute('aria-labelledby','landscape-heading');
 gate.innerHTML='<div class="landscape-card"><svg viewBox="0 0 100 70" aria-hidden="true"><rect x="18" y="20" width="64" height="34" rx="6" fill="none" stroke="currentColor" stroke-width="4"/><path d="M20 12Q55 -2 80 16m-1-11 4 14-15-1" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="74" cy="37" r="2" fill="currentColor"/></svg><h2 id="landscape-heading"></h2><p id="landscape-copy"></p><button type="button" class="primary-btn" id="landscape-enter"></button><button type="button" class="action-btn" data-feedback></button><small class="build-version" data-no-i18n></small></div>';
 document.body.append(gate);
 const notification=document.createElement('aside');notification.id='chat-notification';notification.hidden=true;notification.setAttribute('role','status');notification.setAttribute('aria-live','polite');notification.innerHTML='<strong id="chat-preview-name" data-no-i18n></strong><p id="chat-preview-text" data-no-i18n></p><div><button type="button" id="chat-preview-open"></button><button type="button" id="chat-preview-close" aria-label="Dismiss">×</button></div>';document.body.append(notification);
 const modal=document.createElement('section');modal.id='feedback-modal';modal.className='overlay hidden';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-labelledby','feedback-heading');
 modal.innerHTML='<div class="modal-card"><h2 id="feedback-heading"></h2><p id="feedback-explanation"></p><p class="feedback-address" data-no-i18n>'+FEEDBACK_EMAIL+'</p><form id="feedback-form"><label for="feedback-category" id="feedback-category-label"></label><select id="feedback-category"><option value="Problem"></option><option value="Suggestion"></option><option value="Game rules"></option><option value="Other"></option></select><label for="feedback-device" id="feedback-device-label"></label><input id="feedback-device" maxlength="120" autocomplete="off"><label for="feedback-message" id="feedback-message-label"></label><textarea id="feedback-message" maxlength="1200" rows="5" required></textarea><label class="feedback-technical"><input type="checkbox" id="feedback-technical"><span id="feedback-technical-label"></span></label><p id="feedback-status" role="status"></p><button type="submit" class="primary-btn" id="feedback-send"></button></form><button type="button" class="secondary-btn" id="feedback-copy"></button><button type="button" class="secondary-btn" id="feedback-close"></button><small class="build-version" data-no-i18n></small></div>';
 document.body.append(modal);
 const mobile=()=>matchMedia('(pointer:coarse)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)||navigator.maxTouchPoints>1;
 function orientationChanged(){
  const previous=blocked;blocked=portraitRequired({coarse:matchMedia('(pointer:coarse)').matches,orientation:globalThis.screen?.orientation?.type||'',portrait:matchMedia('(orientation:portrait)').matches,userAgent:navigator.userAgent,touchPoints:navigator.maxTouchPoints||0});
  gate.hidden=!blocked;document.body.classList.toggle('portrait-blocked',blocked);
  $('game-frame').inert=blocked;document.querySelectorAll('.overlay:not(#feedback-modal):not(#landscape-gate)').forEach(el=>el.inert=blocked);
  if(previous!==blocked)api.orientationChanged?.(blocked);
 }
 function enterLandscape(){if(lockPending)return lockPending;lockPending=requestLandscape(document,globalThis.screen).then(result=>{orientationChanged();return result;}).finally(()=>{lockPending=null;});return lockPending;}
 function hideChat(){clearTimeout(chatTimer);notification.hidden=true;chatPacket=null;}
 function notifyChat(packet){if(!packet){hideChat();return;}chatPacket=packet;$('chat-preview-name').textContent=api.names()[packet.player]||t('Player','வீரர்');$('chat-preview-text').textContent=packet.text;notification.hidden=false;clearTimeout(chatTimer);chatTimer=setTimeout(hideChat,6500);api.chatSound?.();}
 function openFeedback(){previousFocus=document.activeElement;refresh();$('feedback-status').textContent='';modal.classList.remove('hidden');$('feedback-message').focus({preventScroll:true});}
 function closeFeedback(){if(modal.classList.contains('hidden'))return false;modal.classList.add('hidden');const focus=blocked?$('landscape-enter'):previousFocus;focus?.focus?.({preventScroll:true});return true;}
 function draft(){return feedbackDraft({message:$('feedback-message').value,category:$('feedback-category').value,device:$('feedback-device').value,mode:api.mode(),language:api.language(),userAgent:navigator.userAgent,technicalDetails:$('feedback-technical').checked?api.diagnostics?.()||'':''});}
 $('feedback-form').addEventListener('submit',e=>{e.preventDefault();try{const value=draft();const link=document.createElement('a');link.href=value.mailto;document.body.append(link);link.click();link.remove();$('feedback-status').textContent=t('Finish sending in your email app. If it did not open, copy the feedback below and paste it into an email.','உங்கள் மின்னஞ்சல் செயலியில் அனுப்பு என்பதைத் தொடவும். திறக்கவில்லை என்றால் கீழே நகலெடுத்து மின்னஞ்சலில் ஒட்டவும்.');}catch{$('feedback-status').textContent=t('Please describe your feedback.','உங்கள் கருத்தை எழுதவும்.');}});
 $('feedback-copy').addEventListener('click',async()=>{try{const value=draft();if(!await api.copy(value.copy))throw Error();$('feedback-status').textContent=t('Copied. Paste into an email to '+FEEDBACK_EMAIL+'.','நகலெடுக்கப்பட்டது. '+FEEDBACK_EMAIL+' முகவரிக்கு மின்னஞ்சலில் ஒட்டவும்.');}catch{$('feedback-status').textContent=t('Write your feedback first. If copying is unavailable, send it directly to '+FEEDBACK_EMAIL+'.','முதலில் கருத்தை எழுதவும். நகலெடுக்க முடியவில்லை என்றால் '+FEEDBACK_EMAIL+' முகவரிக்கு நேரடியாக அனுப்பவும்.');}});
 $('feedback-close').addEventListener('click',closeFeedback);modal.addEventListener('click',e=>{if(e.target===modal)closeFeedback();});
 modal.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeFeedback();}if(e.key==='Tab'){const items=[...modal.querySelectorAll('button,input,select,textarea')].filter(el=>!el.disabled);if(e.shiftKey&&document.activeElement===items[0]){e.preventDefault();items.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===items.at(-1)){e.preventDefault();items[0].focus();}}});
 $('chat-preview-open').addEventListener('click',()=>{hideChat();api.openChat();});$('chat-preview-close').addEventListener('click',hideChat);$('landscape-enter').addEventListener('click',()=>void enterLandscape());
 document.addEventListener('click',e=>{if(e.target.closest('[data-feedback]'))openFeedback();});
 document.addEventListener('click',e=>{if(e.isTrusted&&!autoAttempted&&mobile()&&!e.target.closest('[data-feedback],#feedback-modal')){autoAttempted=true;void enterLandscape();}},true);
 window.addEventListener('resize',orientationChanged);window.addEventListener('orientationchange',orientationChanged);document.addEventListener('fullscreenchange',orientationChanged);globalThis.screen?.orientation?.addEventListener?.('change',orientationChanged);
 function refresh(){
  document.querySelectorAll('.build-version').forEach(el=>el.textContent='v'+APP_VERSION);
  document.querySelectorAll('[data-feedback]').forEach(el=>el.textContent=t('Send feedback','கருத்து அனுப்பு'));
  $('landscape-heading').textContent=t('Play in landscape','கிடைமட்டமாக விளையாடவும்');$('landscape-copy').textContent=t('Turn your phone sideways. Tap below to request fullscreen and landscape lock. If your browser cannot lock, keep the phone sideways to play.','தொலைபேசியைக் கிடைமட்டமாகத் திருப்பவும். முழுத்திரை மற்றும் திசைப் பூட்டுக்கு கீழே தொடவும். உலாவி அனுமதிக்கவில்லை என்றால் கிடைமட்டமாக வைத்தே விளையாடவும்.');$('landscape-enter').textContent=t('Enter landscape','கிடைமட்டத் திரை');
  $('chat-preview-open').textContent=t('Open chat','உரையாடலைத் திற');$('chat-preview-close').setAttribute('aria-label',t('Dismiss','மூடு'));
  $('feedback-heading').textContent=t('Send feedback','கருத்து அனுப்பு');$('feedback-explanation').textContent=t('Your email app will open a draft addressed to the developer. Review it and tap Send. Nothing is emailed automatically.','உருவாக்குநருக்கான வரைவு உங்கள் மின்னஞ்சல் செயலியில் திறக்கும். சரிபார்த்து அனுப்பு என்பதைத் தொடவும். தானாக மின்னஞ்சல் அனுப்பப்படாது.');
  $('feedback-technical-label').textContent=t('Include recent technical events (optional; no chat, names or room tokens).','சமீபத்திய தொழில்நுட்ப நிகழ்வுகளைச் சேர் (விருப்பம்; உரையாடல், பெயர், அறை இரகசியங்கள் இல்லை).');
  $('feedback-category-label').textContent=t('Category','வகை');$('feedback-device-label').textContent=t('Phone model (optional)','தொலைபேசி வகை (விருப்பம்)');$('feedback-message-label').textContent=t('What happened, or what could be better?','என்ன நடந்தது அல்லது எதை மேம்படுத்தலாம்?');
  [...$('feedback-category').options].forEach((el,i)=>el.textContent=t(['Problem','Suggestion','Game rules','Other'][i],['சிக்கல்','பரிந்துரை','விளையாட்டு விதிகள்','மற்றவை'][i]));
  $('feedback-send').textContent=t('Open email draft','மின்னஞ்சல் வரைவைத் திற');$('feedback-copy').textContent=t('Copy feedback instead','கருத்தை நகலெடு');$('feedback-close').textContent=t('Back to game','ஆட்டத்திற்குத் திரும்பு');
 }
 refresh();orientationChanged();
 return {refresh,notifyChat,hideChat,enterLandscape,openFeedback,closeFeedback,orientationBlocked:()=>blocked};
}
