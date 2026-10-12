// 静的書き出し out/ を http://localhost:4174 で配信（brotli圧縮）。リポジトリのルートで実行する。事前に npm run build。
// 使い方: (setsid nohup node scripts/qa/serve.js >/dev/null 2>&1 &)  ※pkillで止めるとシェルごと落ちることがあるため PID を指定して kill する
const zlib=require('zlib'),http=require('http'),fs=require('fs'),path=require('path');
const OUT=path.resolve('out');
function resolve(u){let p=decodeURIComponent(u.split('?')[0]);if(p.length>1&&p.endsWith('/'))p=p.slice(0,-1);for(const x of [p,p+'.html',path.join(p,'index.html')]){const f=path.join(OUT,x);if(fs.existsSync(f)&&fs.statSync(f).isFile())return f;}return null;}
const T={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain','.json':'application/json'};
http.createServer((q,r)=>{
  let f=resolve(q.url),status=200;
  if(!f){f=path.join(OUT,'404.html');status=404;}
  const ct=T[path.extname(f)]||'application/octet-stream';
  const comp=/\.(html|js|css|svg|json|txt)$/.test(f)&&/br/.test(q.headers['accept-encoding']||'');
  const h={'content-type':ct,'cache-control':f.includes('_next/static')?'public,max-age=31536000,immutable':'public,max-age=0,must-revalidate'};
  if(comp){h['content-encoding']='br';r.writeHead(status,h);fs.createReadStream(f).pipe(zlib.createBrotliCompress()).pipe(r);}
  else{r.writeHead(status,h);fs.createReadStream(f).pipe(r);}
}).listen(4174);
