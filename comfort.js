import {validClockSeconds} from './clock.js?v=3.24.0';
export const PRIMARY_MATS=Object.freeze(['emerald','burgundy','navy','sand','plum','slate']);
export const clampVolume=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
// Only old preferences migrate. A saved in-progress match retains its original rules.
export function comfortSettings(saved={}){
 return {comfortVersion:1,turnSeconds:saved.comfortVersion===1?validClockSeconds(saved.turnSeconds):0,seedVolume:clampVolume(saved.seedVolume,.85),uiVolume:clampVolume(saved.uiVolume,.22)};
}
export function captureExplanation(event,locked=[],names={},ta=false){
 if(!event)return '';
 const name=names[event.player]||(ta?'வீரர்':'Player');
 if(event.kind==='pasu')return ta?`இந்தக் குழியில் சரியாக 4 விதைகள் சேர்ந்ததால், குழியின் உரிமையாளர் ${name} அவற்றைப் பெறுகிறார். கடைசி விதையை யார் போட்டார் என்பது முக்கியமல்ல.`:`This cup reached exactly four seeds, so its owner ${name} collects all four—even if the other player dropped the last seed.`;
 if(event.kind==='capture'){
  const blocked=locked[event.emptyPit]===true;
  return ta?`கையில் விதைகள் தீர்ந்ததும் அடுத்த குழி ${blocked?'காசியாகப் பூட்டப்பட்டுள்ளது':'காலியாக உள்ளது'}. அதற்கு அடுத்த குழியின் ${event.count} விதைகளை ${name} கைப்பற்றுகிறார்.`:`The hand is empty and the next cup is ${blocked?'locked as Kasie':'empty'}. ${name} captures the ${event.count} seeds from the cup immediately beyond it.`;
 }
 return '';
}
export function kasieExplanation(name,filled,ta=false){
 const safe=Math.max(0,Math.min(7,Math.floor(filled))),locked=7-safe;
 return ta?`${name}: ${safe} குழிகளை நிரப்பலாம்; ${locked} குழிகள் காசியாகப் பூட்டப்படும். பூட்டிய குழிகளில் விதைகள் விழலாம்; அவற்றை எடுத்து விதைக்க முடியாது. சுற்றின் முடிவில் அவற்றிலுள்ள விதைகள் எதிர்வீரருக்குச் செல்லும்.`:`${name} can refill ${safe} cups; ${locked} will be locked as Kasie. Seeds may land in locked cups, but cannot be picked up for sowing. At round end, seeds left there go to the opponent.`;
}
export function practiceComplete(moves){return Number.isInteger(moves)&&moves>=8;}
