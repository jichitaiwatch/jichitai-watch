// ページ移動の検査（先読みを止め、補助ファイルを消した out/ 用・D-26）。内蔵サーバーで out/ を配信するので serve.js は不要。
// 検査：①全ページ（.html）に同名の .txt があり、全ページが取得できる ②実ブラウザでリンクをクリックして各種別のページを巡り、
//        全て「クライアント遷移」（全ページ読込でない）・4xx/5xx の応答 0・__next.* への要求 0・JSエラー 0 ③戻る・進む ④検索。
// 使い方（リポジトリのルートで）: NODE_PATH=$(npm root -g) node scripts/qa/nav-check.js   ※事前に npm run build。成功＝最後に「検査OK」
// 失敗すると終了コード1。Next.js の版を上げたら、build のあとに必ず実行する。
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const OUT = path.resolve('out');

function resolve(u) {
  let p = decodeURIComponent(u.split('?')[0]);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '/') p = '/index';
  for (const x of [p, p + '.html', path.join(p, 'index.html')]) {
    const f = path.join(OUT, x);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}
// index.txt は / のデータ。ページ名.txt は p + '.txt'（上の resolve が p を先に試すので .txt はそのまま見つかる）
const T = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml' };
const srv = http.createServer((q, r) => {
  const f = resolve(q.url);
  if (!f) { r.writeHead(404, { 'content-type': T['.html'] }); return fs.createReadStream(path.join(OUT, '404.html')).pipe(r); }
  r.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});

const problems = [];
const bad = (m) => { problems.push(m); console.log('  NG', m); };

// ① ファイルの対応（全 .html に同名 .txt）
const pages = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '_next') walk(p); }
    else if (e.name.endsWith('.html')) pages.push(path.relative(OUT, p).split(path.sep).join('/'));
  }
})(OUT);
let htmlNoTxt = 0;
for (const f of pages) {
  if (f === '404.html' || f === '_not-found.html') continue;
  const t = f === 'index.html' ? 'index.txt' : f.replace(/\.html$/, '.txt');
  if (!fs.existsSync(path.join(OUT, t))) { htmlNoTxt++; if (htmlNoTxt <= 3) bad(`ページ名.txt が無い: ${f}`); }
}
const leftover = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '_next') walk(p); }
    else if (e.name.startsWith('__next.')) leftover.push(path.relative(OUT, p));
  }
})(OUT);
if (leftover.length) bad(`消し忘れの __next.* が ${leftover.length} 件（例 ${leftover[0]}）。npm run build の postbuild が動いていない`);
console.log(`① 全ページ ${pages.length} 件／ページ名.txt 欠け ${htmlNoTxt} 件／消し忘れ ${leftover.length} 件`);

(async () => {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const B = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const reqs = [], errs = [];
  pg.on('response', (r) => reqs.push([r.status(), r.url().replace(B, ''), r.request().resourceType()]));
  pg.on('pageerror', (e) => errs.push(String(e)));
  // 外部（アクセス解析の配信元）への接続失敗は対象外。自サイトの失敗要求だけ数える。
  const failed = [];
  pg.on('requestfailed', (r) => { if (r.url().startsWith(B)) failed.push(r.url()); });

  const docs = () => reqs.filter((r) => r[2] === 'document').length;
  async function go(href) {
    const before = docs();
    const loc = pg.locator(`a[href="${href}"]`).first();
    if ((await loc.count()) === 0) { console.log(`  （リンクなし：${href}）`); return false; }
    await loc.scrollIntoViewIfNeeded();
    await loc.click();
    await pg.waitForURL('**' + href, { timeout: 15000 });
    await pg.waitForLoadState('networkidle');
    if (docs() > before) bad(`全ページ読込になった: ${href}`);
    if ((await pg.locator('h1').count()) === 0) bad(`h1 が無い: ${href}`);
    return true;
  }

  // 代表の県・自治体：out/ にある *-pref のうち先頭2つ（岐阜＋試作県があればその1つ）
  const prefs = fs.readdirSync(OUT, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.endsWith('-pref')).map((e) => e.name);
  const order = ['gifu-pref', ...prefs.filter((p) => p !== 'gifu-pref').slice(0, 1)];
  await pg.goto(B + '/');
  await pg.waitForLoadState('networkidle');
  let moves = 0;
  for (const pref of order) {
    const city = fs.readdirSync(path.join(OUT, pref), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.includes('-ken') && !e.name.includes('-to') && !e.name.includes('-fu') && !e.name.includes('-do')).map((e) => e.name)[0];
    const gov = fs.readdirSync(path.join(OUT, pref), { withFileTypes: true }).filter((e) => e.isDirectory() && /-(ken|to|fu|do)$/.test(e.name)).map((e) => e.name)[0];
    const c = `/${pref}/${city}`;
    const route = [`/${pref}`, c, `${c}/machi`, c, `${c}/gyosei`, c, `${c}/gikai`, c, `${c}/kurashi`, `/${pref}`];
    if (gov) route.push(`/${pref}/${gov}`, `/${pref}/${gov}/gyosei`);
    for (const h of route) { if (await go(h)) moves++; }
    // 経年（行政のすがた画面にあるリンクの先頭）
    await pg.goto(B + `${c}/gyosei`); await pg.waitForLoadState('networkidle');
    const trend = await pg.locator(`a[href^="${c}/trends/"]`).first().getAttribute('href').catch(() => null);
    if (trend && (await go(trend))) moves++;
    // トップへ戻ってから次の県へ（トップへ戻るリンクは各ページにある）
    await go('/').catch(() => {});
  }
  for (const h of ['/search', '/about', '/data', '/corrections']) { if (await go(h)) moves++; }
  await pg.goBack(); await pg.waitForLoadState('networkidle');
  await pg.goForward(); await pg.waitForLoadState('networkidle');
  // 検索
  await pg.goto(B + '/'); await pg.waitForLoadState('networkidle');
  const box = pg.locator('form input:not([type=submit])').first();
  await box.fill('岐阜'); await box.press('Enter'); await pg.waitForURL('**/search#q=*'); await pg.waitForTimeout(1200);
  if ((await pg.locator('a:has-text("岐阜市")').count()) === 0) bad('検索結果に岐阜市が出ない');
  await browser.close(); srv.close();

  const http4 = reqs.filter((r) => r[0] >= 400);
  const nx = reqs.filter((r) => r[1].includes('__next.'));
  if (http4.length) bad(`4xx/5xx の応答 ${http4.length} 件（例 ${http4[0][0]} ${http4[0][1]}）`);
  if (nx.length) bad(`__next.* への要求 ${nx.length} 件（先読みが止まっていない。例 ${nx[0][1]}）`);
  if (errs.length) bad(`JSエラー ${errs.length} 件（例 ${errs[0].slice(0, 80)}）`);
  if (failed.length) bad(`自サイトへの失敗した要求 ${failed.length} 件（例 ${failed[0]}）`);
  console.log(`② クリック移動 ${moves} 回／4xx・5xx ${http4.length}／__next.* の要求 ${nx.length}／JSエラー ${errs.length}`);
  if (problems.length) { console.log(`検査NG：${problems.length} 件`); process.exit(1); }
  console.log('検査OK');
})().catch((e) => { console.error(e); process.exit(1); });
