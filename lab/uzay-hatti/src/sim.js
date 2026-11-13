const E = require('./econ.js');
function fresh(){ return {lvA:1,lvC:1,money:0,stars:0,souvenirs:[],research:{},routes:E.ROUTES.map((r,i)=>({u:i===0,seats:1,speed:1,fleet:1,auto:true}))}; }
function clone(s){ return JSON.parse(JSON.stringify(s)); }
function options(s){
  const o=[];
  for(const n of [1,3,10]){
    o.push({k:'A'+n,cost:E.cost.A(s.lvA,n),apply:x=>x.lvA+=n});
    o.push({k:'C'+n,cost:E.cost.C(s.lvC,n),apply:x=>x.lvC+=n});
    o.push({k:'AC'+n,cost:E.cost.A(s.lvA,n)+E.cost.C(s.lvC,n),apply:x=>{x.lvA+=n;x.lvC+=n;}});
  }
  s.routes.forEach((r,i)=>{
    if(r.u){
      for(const n of [1,5]) o.push({k:'seats'+i+'x'+n,cost:E.cost.seats(i,r.seats,n),apply:x=>x.routes[i].seats+=n});
      if(r.speed<E.CFG.speedMax) o.push({k:'speed'+i,cost:E.cost.speed(i,r.speed),apply:x=>x.routes[i].speed++});
      if(r.fleet<3) o.push({k:'fleet'+i,cost:E.cost.fleet(i,r.fleet),apply:x=>x.routes[i].fleet++});
    } else if(i>0 && s.routes[i-1].u){
      o.push({k:'unlock'+i,cost:E.cost.unlock(i),apply:x=>x.routes[i].u=true});
    }
  });
  return o;
}
function run(label, activeMult){
  let s=fresh(), t=0; const log=[]; let buys=0;
  while(t<8*3600){
    const inc=E.flow(s).income*activeMult;
    let best=null,bs=Infinity;
    for(const op of options(s)){
      const s2=clone(s); op.apply(s2);
      const gain=E.flow(s2).income*activeMult-inc;
      if(gain<=0) continue;
      const wait=Math.max(0,op.cost-s.money)/inc;
      const score=wait+op.cost/gain;
      if(score<bs){bs=score;best=op;}
    }
    if(!best) break;
    const wait=Math.max(0,best.cost-s.money)/inc;
    t+=wait; s.money+=wait*inc; s.money-=best.cost; best.apply(s); buys++;
    if(best.k.startsWith('unlock')){ const i=+best.k.slice(6); log.push(`${E.ROUTES[i].name} @ ${(t/60).toFixed(1)} min (buys ${buys}) inc now ${E.flow(s).income.toExponential(2)}/s A${s.lvA} C${s.lvC}`); }
    if(s.routes.every(r=>r.u)){ break; }
  }
  const f=E.flow(s);
  console.log(`== ${label}: end t=${(t/60).toFixed(1)}min income=${f.income.toExponential(2)} A=${f.A.toFixed(1)} C=${f.C.toFixed(1)} F=${f.F.toFixed(1)} bn=${f.bottleneck}`);
  log.forEach(l=>console.log('  '+l));
  console.log('  routes', JSON.stringify(s.routes.map(r=>[r.seats,r.speed,r.fleet])));
}
run('passive',1);
run('active x1.4',1.4);
