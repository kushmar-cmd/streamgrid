const http=require('http'),https=require('https'),url=require('url');
const PORT=process.env.PORT||3000;

function fetchTarget(target,res,redirectCount=0){
  if(redirectCount>5){res.writeHead(502);res.end('too many redirects');return}
  let parsed;
  try{parsed=url.parse(target)}catch(e){res.writeHead(400);res.end('bad url');return}
  const proto=parsed.protocol==='https:'?https:http;
  const opts={
    hostname:parsed.hostname,port:parsed.port||( parsed.protocol==='https:'?443:80),
    path:parsed.path||'/',method:'GET',
    headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36','Accept':'*/*'}
  };
  const req=proto.request(opts,r=>{
    // Follow redirects
    if([301,302,303,307,308].includes(r.statusCode)&&r.headers.location){
      const loc=r.headers.location;
      const next=loc.startsWith('http')?loc:url.resolve(target,loc);
      fetchTarget(next,res,redirectCount+1);
      return;
    }
    const ct=r.headers['content-type']||'';
    const isM3U8=target.includes('.m3u8')||target.includes('.m3u')||ct.includes('mpegurl')||ct.toLowerCase().includes('x-mpegurl');
    if(isM3U8){
      let body='';
      r.setEncoding('utf8');
      r.on('data',c=>body+=c);
      r.on('end',()=>{
        // Base URL for resolving relative paths
        const p=url.parse(target);
        const base=p.protocol+'//'+p.host+p.pathname.substring(0,p.pathname.lastIndexOf('/')+1);
        const rewritten=body.split('\n').map(line=>{
          const t=line.trim();
          if(!t)return line;
          // Rewrite URI="..." inside EXT tags
          if(t.startsWith('#')&&t.includes('URI="')){
            return t.replace(/URI="([^"]+)"/g,(_,uri)=>{
              const abs=uri.startsWith('http')?uri:url.resolve(base,uri);
              return 'URI="'+encodeURIComponent(abs)+'"';
            });
          }
          // Rewrite segment/playlist URL lines
          if(!t.startsWith('#')){
            const abs=t.startsWith('http')?t:url.resolve(base,t);
            return encodeURIComponent(abs);
          }
          return line;
        }).join('\n');
        res.writeHead(200,{'Content-Type':'application/vnd.apple.mpegurl','Access-Control-Allow-Origin':'*','Cache-Control':'no-cache,no-store'});
        res.end(rewritten);
      });
    }else{
      res.writeHead(r.statusCode,{'Content-Type':ct||'application/octet-stream','Access-Control-Allow-Origin':'*','Cache-Control':'no-cache'});
      r.pipe(res);
    }
  });
  req.on('error',err=>{
    console.error('proxy err:',err.message);
    if(!res.headersSent){res.writeHead(502);res.end('proxy error: '+err.message)}
  });
  req.setTimeout(20000,()=>{req.destroy();if(!res.headersSent){res.writeHead(504);res.end('timeout')}});
  req.end();
}

http.createServer((req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Headers','*');
  res.setHeader('Access-Control-Allow-Methods','GET,HEAD,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const raw=req.url.slice(1);
  if(!raw){res.writeHead(200,{'Content-Type':'text/plain'});res.end('StreamGrid Proxy OK');return}
  let target;
  try{target=decodeURIComponent(raw)}catch{target=raw}
  if(!target.startsWith('http')){res.writeHead(400);res.end('bad url');return}
  fetchTarget(target,res);
}).listen(PORT,()=>console.log('Proxy on port '+PORT));
