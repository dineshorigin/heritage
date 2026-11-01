// Lightweight visual physics. Rules and seed counts remain authoritative elsewhere.
// Fixed-step bowl simulation is cached; there is no idle animation loop.
const cache=new Map();
export const BOWL_PHYSICS=Object.freeze({gravity:9.81,friction:5.6,restitution:.16,dt:1/120,steps:180,capacity:6});
export function settledCowries(count,index=0,store=false){
 const n=Math.max(0,Math.min(store?30:20,Math.floor(count)||0));
 const key=n+'|'+index+'|'+store;
 if(cache.has(key))return cache.get(key);
 const particles=[];
 for(let i=0;i<n;i++){
  const angle=i*2.39996323+index*.31;
  particles.push({x:Math.cos(angle)*.48,y:Math.sin(angle)*.38,vx:0,vy:0,layer:Math.floor(i/BOWL_PHYSICS.capacity)});
 }
 const {dt,gravity,friction,restitution}=BOWL_PHYSICS;
 for(let step=0;step<BOWL_PHYSICS.steps;step++){
  for(const p of particles){
   // Tangential component of gravity on a concave parabolic bowl, with friction.
   p.vx+=(-gravity*p.x-friction*p.vx)*dt;
   p.vy+=(-gravity*p.y-friction*p.vy)*dt;
   p.x+=p.vx*dt;p.y+=p.vy*dt;
  }
  for(let pass=0;pass<2;pass++){
   for(let a=0;a<n;a++)for(let b=a+1;b<n;b++){
    const p=particles[a],q=particles[b];if(p.layer!==q.layer)continue;
    let dx=q.x-p.x,dy=q.y-p.y;
    const contact=Math.hypot(dx/.66,dy/.48);
    if(contact>=1)continue;
    if(contact<1e-8){dx=.001;dy=.001;}
    const c=Math.max(contact,.001),push=(1-c)*.5;
    p.x-=dx/c*push;p.y-=dy/c*push;q.x+=dx/c*push;q.y+=dy/c*push;
    const length=Math.hypot(dx,dy),nx=dx/length,ny=dy/length;
    const relative=(q.vx-p.vx)*nx+(q.vy-p.vy)*ny;
    if(relative<0){const impulse=-(1+restitution)*relative*.5;p.vx-=impulse*nx;p.vy-=impulse*ny;q.vx+=impulse*nx;q.vy+=impulse*ny;}
   }
   for(const p of particles){
    const radius=Math.hypot(p.x,p.y-.12),limit=.77-p.layer*.025;
    if(radius>limit){const nx=p.x/radius,ny=p.y/radius;p.x=nx*limit;p.y=ny*limit;const vn=p.vx*nx+p.vy*ny;if(vn>0){p.vx-=(1+restitution)*vn*nx;p.vy-=(1+restitution)*vn*ny;}}
   }
  }
 }
 // Centre each resting layer exactly on the measured bowl floor.
 for(let layer=0;layer<=Math.floor((n-1)/BOWL_PHYSICS.capacity);layer++){
  const group=particles.filter(p=>p.layer===layer);const mx=group.reduce((v,p)=>v+p.x,0)/group.length,my=group.reduce((v,p)=>v+p.y,0)/group.length;
  for(const p of group){p.x-=mx;p.y-=my;}
  const max=Math.max(...group.map(p=>Math.hypot(p.x,p.y)));if(max>.77)for(const p of group){p.x*=.77/max;p.y*=.77/max;}
 }
 const result=Object.freeze(particles.map((p,i)=>Object.freeze({x:50+p.x*(store?37:34),y:50+p.y*31,layer:p.layer,rotation:((i*53+index*17)%105-50)})));
 if(cache.size>=256)cache.delete(cache.keys().next().value);
 cache.set(key,result);return result;
}
export function ballisticFlight({dx,dy,duration,portrait=false,kind='drop',spin=30}){
 const seconds=Math.max(.001,duration/1000),impact=kind==='scoop'?1:.82;
 const fall=seconds*impact,gravity=9.81,pixelsPerMetre=180;
 const frames=[];
 for(let i=0;i<=12;i++){
  const p=i/12,progress=Math.min(1,p/impact);
  let height;
  if(p<=impact){const t=seconds*p;const initialVelocity=gravity*fall/2;height=initialVelocity*t-.5*gravity*t*t;}
  else{const t=seconds*(p-impact),bounceTime=seconds*(1-impact);height=.5*gravity*bounceTime*t-.5*gravity*t*t;}
  const z=Math.max(0,height)*pixelsPerMetre;
  frames.push({offset:p,x:dx*progress-(portrait?z:0),y:dy*progress-(portrait?0:z),angle:spin*p,height:z});
 }
 frames[0]={offset:0,x:0,y:0,angle:0,height:0};frames[12]={offset:1,x:dx,y:dy,angle:spin,height:0};
 return frames;
}
