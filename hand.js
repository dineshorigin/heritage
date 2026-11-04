// Hand presentation only. Seed counts, legal moves and completion remain in the game controller.
const pivots=[[30,90],[50,90],[68,90],[86,94],[39,109]];
export const HAND_POSES={
 open:[[0,0,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1],[0,0,0,1]],
 grip:[[4,7,9,.77],[2,10,5,.71],[-2,10,-5,.74],[-5,8,-12,.78],[12,-8,-12,1]],
 release:[[5,3,12,.52],[2,11,5,.67],[-2,12,-5,.68],[-5,10,-12,.72],[0,0,65,1]]
};
export function fingerTransform(pose,index,css=true){
 const [x,y,angle,scale]=(HAND_POSES[pose]||HAND_POSES.open)[index],p=pivots[index],u=css?'px':'';
 return `translate(${x}${u},${y}${u}) translate(${p[0]}${u},${p[1]}${u}) rotate(${angle}${css?'deg':''}) scale(1,${scale}) translate(${-p[0]}${u},${-p[1]}${u})`;
}
export function poseHand(root,pose='open'){
 const key=pose==='release'?'release':pose==='grip'?'grip':'open';root.dataset.pose=key;
 root.classList.toggle('grip',key==='grip');root.classList.toggle('releasing',key==='release');
 root.querySelectorAll('.hand-finger,.hand-thumb').forEach((el,i)=>{el.style.transform=fingerTransform(key,i);});
}
export function handGeometry(point,player=1,{width=70,height=width*165/116,portrait=false}={}){
 const sign=player===1?1:-1,angle=portrait?sign*Math.PI/2:player===1?0:Math.PI;
 const offset={x:-17*width/116,y:-14.5*height/165},delta={x:offset.x*Math.cos(angle)-offset.y*Math.sin(angle),y:offset.x*Math.sin(angle)+offset.y*Math.cos(angle)};
 const clearance=Math.min(16,Math.max(9,height*.12)),release=portrait?{x:point.x-sign*clearance,y:point.y}:{x:point.x,y:point.y+sign*clearance};
 return {center:{x:release.x-delta.x,y:release.y-delta.y},release};
}
export function handTravel(from,to,{player=1,portrait=false,pace=1,reduced=false,light=false}={}){
 const start=from||to,distance=Math.hypot(to.x-start.x,to.y-start.y),duration=reduced||distance<2?0:Math.round(Math.min(280,160+distance*.18)*pace);
 const lift=light?0:Math.min(12,Math.max(3,distance*.045)),sign=player===1?1:-1,lean=light?0:Math.max(-6,Math.min(6,(portrait?to.y-start.y:to.x-start.x)*.025))*sign;
 const at=t=>({x:start.x+(to.x-start.x)*t+(portrait?-sign*lift*Math.sin(Math.PI*t):0),y:start.y+(to.y-start.y)*t+(portrait?0:-sign*lift*Math.sin(Math.PI*t))});
 return {duration,frames:[{...start,angle:0,scale:1,offset:0},{...at(.35),angle:lean,scale:light?1:1.025,offset:.35},{...at(.75),angle:lean*.5,scale:light?1:1.01,offset:.75},{...to,angle:0,scale:1,offset:1}]};
}
export function handGesture(kind,player=1,{portrait=false,pace=1,reduced=false,light=false}={}){
 const sign=player===1?1:-1,dip=kind==='release'?3:6;
 return {duration:reduced||light?0:Math.round((kind==='release'?95:145)*pace),frames:[{transform:'translate(0px,0px) scale(1)',offset:0},{transform:`translate(${portrait?sign*dip:0}px,${portrait?0:-sign*dip}px) scale(.97)`,offset:.42},{transform:'translate(0px,0px) scale(1)',offset:1}]};
}
export function heldSeedLayout(count){return Array.from({length:Math.min(4,Math.max(0,Math.floor(count)))},(_,i)=>({x:39+(i%2)*12,y:91+Math.floor(i/2)*10,angle:-24+i*19}));}
