export const MATS=Object.freeze(['emerald','burgundy','navy','sand','plum','slate','forest','teal','wine','saffron','charcoal','ivory','indigo','rose']);
export function validMat(value){return MATS.includes(value)?value:'emerald';}
export function materialProfile(material){
 return material==='cowrie'?{frequency:1540,duration:.095,noise:.58,decay:76,level:.68}:material==='colored'?{frequency:920,duration:.115,noise:.36,decay:52,level:.55}:{frequency:310,duration:.08,noise:.74,decay:100,level:.82};
}
export function createFireworks(canvas){
 let raf=0,start=0,previous=0,lastBurst=-1,particles=[],bursts=0,frames=0;
 const ctx=canvas.getContext('2d');
 const stop=()=>{cancelAnimationFrame(raf);raf=0;particles=[];canvas.hidden=true;ctx?.clearRect(0,0,canvas.width,canvas.height);};
 const fire=()=>{
  stop();if(!ctx||matchMedia('(prefers-reduced-motion: reduce)').matches||document.hidden)return;
  const ratio=Math.min(1.5,devicePixelRatio||1),r=canvas.parentElement.getBoundingClientRect();canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);canvas.hidden=false;
  const w=canvas.width,h=canvas.height,colors=['#f8d383','#f39ca5','#95dcd0','#b4caff'];start=previous=0;lastBurst=-1;bursts=frames=0;
  const tick=now=>{
   if(!start)start=previous=now;
   const elapsed=(now-start)/1000,dt=Math.min(.035,(now-previous)/1000);previous=now;
   if(elapsed>6||canvas.closest('.hidden')||document.hidden){stop();return;}
   const slot=Math.floor(elapsed/1.05);
   if(slot!==lastBurst&&slot<5){lastBurst=slot;bursts++;const x=w*(.2+(slot*.27)% .6),y=h*(.15+(slot%3)*.08);for(let j=0;j<40;j++){const a=j*Math.PI*2/40;const speed=(58+(j%5)*13)*ratio;particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,age:0,life:1.45+(j%3)*.12,color:colors[slot%4]});}}
   ctx.clearRect(0,0,w,h);frames++;
   particles=particles.filter(p=>p.age<p.life);
   for(const p of particles){p.age+=dt;p.vx*=Math.exp(-.8*dt);p.vy+=62*ratio*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;ctx.globalAlpha=Math.max(0,1-p.age/p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,1.5*ratio,0,Math.PI*2);ctx.fill();}
   ctx.globalAlpha=1;raf=requestAnimationFrame(tick);
  };raf=requestAnimationFrame(tick);
 };
 return {start:fire,stop,inspect:()=>({running:Boolean(raf),bursts,frames,particles:particles.length})};
}
