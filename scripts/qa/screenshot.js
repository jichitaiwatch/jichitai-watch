// 指定ページのフルページスクリーンショット（幅375/1280）と横あふれ有無を出力。serve.js を起動してから使う。
// 使い方（リポジトリのルートで）: NODE_PATH=$(npm root -g) node scripts/qa/screenshot.js <出力先接頭辞> '[["名前","/gifu-pref/gifu-shi/machi"]]'
const {chromium}=require('playwright');
const pages=JSON.parse(process.argv[3]);
(async()=>{
  const b=await chromium.launch();
  for(const [name,url] of pages) for(const w of [375,1280]){
    const p=await (await b.newContext({viewport:{width:w,height:900}})).newPage();
    await p.goto('http://localhost:4174'+url,{waitUntil:'networkidle'});
    const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
    console.log(name,w,'overflow',ov);
    await p.screenshot({path:`${process.argv[2]}${name}${w}.png`,fullPage:true});
  }
  await b.close();
})();
