import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./rules.js',import.meta.url),'utf8');
const {simulateMove,settleLockedSeeds}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
let seed=2701;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
let moves=0,rounds=0,maxRounds=0,maxMoveEvents=0,errors=[],unfinished=0;
const total=(p,b)=>p.reduce((a,v)=>a+v,0)+b[1]+b[2];
for(const pasu of ['on','off'])for(const S of [4,5])for(const kasie of [false,true])for(let match=0;match<100;match++){
 let p=Array(14).fill(S),b=[0,0,0],locked=Array(14).fill(false),player=1,done=false;
 for(let round=1;round<=1000&&!done;round++){
  rounds++;maxRounds=Math.max(maxRounds,round);
  for(let step=0;step<2000;step++){
   const available=q=>p.map((v,i)=>v>0&&!locked[i]&&(i<7?1:2)===q?i:-1).filter(i=>i>=0);
   if(!available(1).length||!available(2).length){for(let i=0;i<14;i++){if(!locked[i]){b[i<7?1:2]+=p[i];p[i]=0;}}settleLockedSeeds(p,b,locked);break;}
   const choices=available(player),idx=choices[Math.floor(rand()*choices.length)];
   try{const beforeP=p.slice(),beforeB=b.slice();const r=simulateMove(p,b,player,idx,{pasu,locked});
    if(JSON.stringify(p)!==JSON.stringify(beforeP)||JSON.stringify(b)!==JSON.stringify(beforeB))throw Error('input mutation');
    if(total(r.pits,r.banks)!==14*S||r.pits.some(x=>!Number.isInteger(x)||x<0))throw Error('invalid result');
    p=r.pits;b=r.banks;moves++;maxMoveEvents=Math.max(maxMoveEvents,r.events.length);player=3-player;
   }catch(e){errors.push({pasu,S,kasie,match,round,step,error:e.message,p,b,idx});done=true;break;}
   if(step===1999){unfinished++;done=true;}
  }
  if(done)break;
  if(!kasie||b[1]<S||b[2]<S){done=true;break;}
  for(let q=1;q<=2;q++){const fill=Math.min(7,Math.floor(b[q]/S));b[q]-=fill*S;for(let j=0;j<7;j++){const i=j+(q===1?0:7);p[i]=j<fill?S:0;locked[i]=j>=fill;}}
  if(total(p,b)!==14*S)throw Error('refill total');
  if(round===1000)unfinished++;
 }
}
console.log(JSON.stringify({matches:800,moves,rounds,maxRounds,maxMoveEvents,errors:errors.slice(0,3),errorCount:errors.length,unfinished},null,2));

const p=Array(14).fill(0), b=[0,0,10], locked=Array(14).fill(false);p[0]=1;p[7]=20;locked[7]=true;
const candidate=simulateMove(p,b,1,0,{locked,pasu:'off'});
for(let i=0;i<14;i++)if(!locked[i]){candidate.banks[i<7?1:2]+=candidate.pits[i];candidate.pits[i]=0;}
settleLockedSeeds(candidate.pits,candidate.banks,locked);
if(JSON.stringify(candidate.banks)!=='[0,21,10]')throw Error('Kasie AI regression');
settleLockedSeeds(candidate.pits,candidate.banks,locked);
if(JSON.stringify(candidate.banks)!=='[0,21,10]')throw Error('Non-idempotent settlement');
console.log('Kasie terminal-score regression and idempotency PASS');
