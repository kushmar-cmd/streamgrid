const http=require('http'),https=require('https'),url=require('url');
http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const t=decodeURIComponent(req.url.slice(1));
  if(!t.startsWith('http')){res.writeHead(400);res.end('bad url');return}
  const p=t.startsWith('https')?https:http;
  p.get(t,r=>{
    res.writeHead(r.statusCode,{'Content-Type':r.headers['content-type']||'application/octet-stream','Access-Control-Allow-Origin':'*'});
    r.pipe(res);
  }).on('error',()=>{res.writeHead(502);res.end()});
}).listen(process.env.PORT||3000);