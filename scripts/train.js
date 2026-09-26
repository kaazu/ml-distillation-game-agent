// 教師（余裕度プランナー）のプレイを記録 → GBDTを学習 → DAggerで追加学習し、最良のモデルを model/model.json に保存する。
// 使い方: node scripts/train.js [先読みの深さ=8] [DAgger回数=3]   ※数十分かかります
const G=require('../src/core.js');const fs=require('fs');const c=G.makeCourse(1);
const DEP=+process.argv[2]||8, IT=+process.argv[3]||3;G.setTeacher('margin',1.5,DEP);
const trainW=Array.from({length:60},(_,i)=>i*3);const testW=[];for(let w=0;w<180;w++)if(w%3)testW.push(w);
const X=[],y=[],seen=new Set();const add=r=>{for(const d of r){const k=d.x.join();if(seen.has(k))continue;seen.add(k);X.push(d.x);y.push(d.y);}};
const train=()=>{const cnt=[0,0];y.forEach(v=>cnt[v]++);return G.trainGBDT(X,y,{weight:y.map(v=>(X.length/2)/cnt[v]),bins:128,leaves:31,trees:300});};
let tc=0;for(const w of trainW){const rec=[];if(G.runEpisode(c,w,s=>G.teacher(c,s),{record:rec}).clear){tc++;add(rec);}}
let m=train();const pol=s=>G.predictProb(m,G.features(c,s))>0.5?1:0;
const ev=()=>{let k=0;const f=[];for(const w of testW){const r=G.runEpisode(c,w,pol);if(r.clear)k++;else f.push(w+':'+(r.x|0));}return [k,f];};
let [k,f]=ev();console.log(`depth${DEP} teacher ${tc}/60 iter0 n=${X.length} student ${k}/120`);
let bestK=k,bestM=m;
for(let it=1;it<=IT;it++){
  for(const w of trainW){const rec=[];G.runEpisode(c,w,s=>{rec.push({x:G.features(c,s),y:G.teacher(c,s)});return pol(s);});add(rec);}
  m=train();[k,f]=ev();console.log(`iter${it} n=${X.length} student ${k}/120 ${f.slice(0,6).join(' ')}`);
  if(k>=bestK){bestK=k;bestM=m;}
}
fs.writeFileSync(__dirname+'/../model/model.json',JSON.stringify(bestM));console.log('saved model/model.json',bestK,'/120');
