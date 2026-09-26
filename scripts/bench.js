// 教師（停止方式 / 260ms遅延）と生徒の成績・判断時間を計測する。
// 使い方: node scripts/bench.js
const G=require('../src/core.js');const c=G.makeCourse(1);G.setTeacher('margin',1.5,8);
const testW=[];for(let w=0;w<180;w++)if(w%3)testW.push(w);
const sub=testW.filter((_,i)=>i%3===0); // 40通り
const ms=[];let k=0;for(const w of sub)if(G.runEpisode(c,w,s=>{const t=performance.now();const a=G.teacher(c,s);ms.push(performance.now()-t);return a;}).clear)k++;
ms.sort((a,b)=>a-b);console.log('stop',k,sub.length,'median ms',ms[ms.length>>1].toFixed(2));
let r=0;const sub2=sub.filter((_,i)=>i%2===0);for(const w of sub2)if(G.runEpisode(c,w,s=>G.teacher(c,s),{latency:16}).clear)r++;console.log('rt',r,sub2.length);
const m=JSON.parse(require('fs').readFileSync(__dirname+'/../model/model.json'));const s=G.newState(c,50);const xs=[];for(let i=0;i<400;i++){if(i%4==0)xs.push(G.features(c,s));G.step(c,s,0);}
const t0=performance.now();for(let i=0;i<100000;i++)G.predictProb(m,xs[i%xs.length]);console.log('student us',((performance.now()-t0)/100000*1000).toFixed(2));
const ok=[];for(const w of testW)if(G.runEpisode(c,w,s=>G.predictProb(m,G.features(c,s))>0.5?1:0).clear)ok.push(w);console.log('ok',ok.length,ok.slice(0,40).join(','));
