// axe-core（WCAG2.0/2.1/2.2 A・AA＋best-practice）で代表ページを検査し、違反をルール別に集約。色コントラストは前景/背景/比率/文字サイズ付きで出力。
// 使い方（リポジトリのルートで）: NODE_PATH=$(npm root -g) node scripts/qa/axe-scan.js   ※事前に npm run build。axe-core が無ければ npm i -g axe-core
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const OUT=path.resolve('out');const axeSrc=fs.readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
function resolve(u){let p=decodeURIComponent(u.split('?')[0]);if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);for(const x of [p,p+'.html',path.join(p,'index.html')]){const f=path.join(OUT,x);if(fs.existsSync(f)&&fs.statSync(f).isFile())return f;}return null;}
const T={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const f=resolve(q.url);if(!f){r.writeHead(404,{'content-type':T['.html']});return fs.createReadStream(path.join(OUT,'404.html')).pipe(r);}r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
const govs=['gifu-shi','shirakawa-mura','gifu-ken'];
const pages=['/','/about','/data','/corrections','/search','/search#q='+encodeURIComponent('岐阜'),'/gifu-pref','/no-such'];
for(const g of govs){pages.push(`/gifu-pref/${g}`);for(const t of['machi','gyosei','gikai','kurashi'])pages.push(`/gifu-pref/${g}/${t}`);}
for(const c of['finance','fiscal-health','spending'])pages.push(`/gifu-pref/gifu-shi/trends/${c}`);
(async()=>{await new Promise(o=>srv.listen(0,o));const base='http://localhost:'+srv.address().port;const br=await chromium.launch();
const agg={};
for(const scheme of ['light']){const pg=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();
for(const u of pages){await pg.goto(base+u,{waitUntil:'networkidle'});await pg.evaluate(axeSrc);
 const r=await pg.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}}));
 for(const v of r.violations){const k=v.id+' ['+v.impact+']';agg[k]=agg[k]||{help:v.help,pages:new Set(),nodes:new Set()};agg[k].pages.add(u);v.nodes.forEach(n=>{const d=(n.any[0]&&n.any[0].data)||{};agg[k].nodes.add(v.id==='color-contrast'?`${d.fgColor} on ${d.bgColor} ${d.contrastRatio} ${d.fontSize} w${d.fontWeight} | ${n.html.replace(/\s+/g,' ').slice(0,90)}`:n.target.join(' '));});}}}
for(const [k,v] of Object.entries(agg))console.log(k,'-',v.help,'| pages',v.pages.size,'| e.g.',[...v.pages].slice(0,3).join(','),'\n   ',[...v.nodes].join('\n    '));
await br.close();srv.close();})();
