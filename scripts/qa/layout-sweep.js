// 横あふれ・タップ領域(24px未満)の全ページ検査。代表31ページ×6幅(320〜1440px)。out/ を内蔵サーバーで配信するため serve.js は不要。
// 使い方（リポジトリのルートで）: NODE_PATH=$(npm root -g) node scripts/qa/layout-sweep.js   ※事前に npm run build。成功＝「横あふれ 0件」「タップ領域 0件」
const http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
const OUT=path.resolve('out');
function resolve(u){let p=decodeURIComponent(u.split('?')[0]);if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);for(const x of [p,p+'.html',path.join(p,'index.html')]){const f=path.join(OUT,x);if(fs.existsSync(f)&&fs.statSync(f).isFile())return f;}return null;}
const T={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.txt':'text/plain','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{const f=resolve(q.url);if(!f){r.writeHead(404,{'content-type':T['.html']});return fs.createReadStream(path.join(OUT,'404.html')).pipe(r);}
 r.writeHead(200,{'content-type':T[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(r);});
// 代表ページ: 全種別×代表自治体（大都市/中規模/小規模村/県）
const govs=['gifu-shi','ogaki-shi','shirakawa-mura','gifu-ken'];
const pages=['/','/about','/data','/corrections','/search','/search#q='+encodeURIComponent('岐阜'),'/gifu-pref','/no-such'];
for(const g of govs){pages.push(`/gifu-pref/${g}`);for(const t of['machi','gyosei','gikai','kurashi'])pages.push(`/gifu-pref/${g}/${t}`);}
for(const c of['finance','fiscal-health','spending'])pages.push(`/gifu-pref/gifu-shi/trends/${c}`);
const widths=[320,360,390,768,1024,1440];
(async()=>{await new Promise(o=>srv.listen(0,o));const base='http://localhost:'+srv.address().port;
const br=await chromium.launch();const res={overflow:[],small:[],mid:[]};
for(const w of widths){
  const ctx=await br.newContext({viewport:{width:w,height:900},hasTouch:w<1024,isMobile:w<768});const pg=await ctx.newPage();
  for(const u of pages){
    await pg.goto(base+u,{waitUntil:'networkidle'});
    const r=await pg.evaluate(()=>{
      const de=document.documentElement; const over=de.scrollWidth-de.clientWidth;
      // 横あふれの原因要素（画面右端を超える要素）
      const culprits=[]; if(over>0){for(const el of document.querySelectorAll('body *')){const b=el.getBoundingClientRect();if(b.width>0&&b.right>de.clientWidth+1){const cs=getComputedStyle(el);let p=el.parentElement,clipped=false;while(p&&p!==document.body){const o=getComputedStyle(p).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'){clipped=true;break;}p=p.parentElement;}if(!clipped&&culprits.length<3)culprits.push(el.tagName.toLowerCase()+'.'+(el.className||'').toString().split(' ').slice(0,3).join('.')+` right=${Math.round(b.right)}`);}}}
      // タップ領域: 可視のa/button/input/select/[role=button]
      const small=[];
      for(const el of document.querySelectorAll('a[href],button,input,select,textarea,[role=button]')){
        const b=el.getBoundingClientRect(); if(b.width===0||b.height===0)continue;
        const cs=getComputedStyle(el); if(cs.visibility==='hidden'||cs.display==='none')continue;
        // 段落内インラインリンクは WCAG 2.5.8 例外（inline）。display:inline の a は除外
        if(el.tagName==='A'&&cs.display==='inline')continue;
        // 視覚的に隠した要素（sr-only＝clip-path:inset(50%)等で1x1。例：Tabで初めて現れる「本文へスキップ」）は押せる面を持たないため対象外
        if(cs.position==='absolute'&&(cs.clipPath==='inset(50%)'||cs.clip==='rect(0px, 0px, 0px, 0px)'))continue;
        if(b.width<24||b.height<24)small.push(`${el.tagName.toLowerCase()} "${(el.innerText||el.getAttribute('aria-label')||'').trim().slice(0,14)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return {over,culprits,small};
    });
    if(r.over>0)res.overflow.push(`w=${w} ${u} +${r.over}px  ${r.culprits.join(' | ')}`);
    if(w<=390&&r.small.length)res.small.push(`w=${w} ${u} ${r.small.slice(0,4).join('; ')}`);
  }
  await ctx.close();
}
await br.close();srv.close();
console.log(`pages×widths = ${pages.length}×${widths.length}`);
console.log('\n[横あふれ] '+res.overflow.length+'件'); res.overflow.slice(0,40).forEach(x=>console.log('  '+x));
console.log('\n[タップ領域<24px(WCAG2.5.8最小)・幅≤390] '+res.small.length+'件'); res.small.slice(0,25).forEach(x=>console.log('  '+x));
})();
