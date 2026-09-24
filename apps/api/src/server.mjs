import http from 'node:http';
const port=Number(process.env.PORT||4000);
http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Type','application/json; charset=utf-8');if(req.url==='/health'){res.writeHead(200);return res.end(JSON.stringify({ok:true,service:'clsk-api'}));}res.writeHead(404);res.end(JSON.stringify({error:'Not found'}));}).listen(port,()=>console.log(`CLSK API running at http://localhost:${port}`));
