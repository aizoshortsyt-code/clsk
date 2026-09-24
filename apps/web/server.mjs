import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const port=Number(process.env.WEB_PORT||5173);const root=fileURLToPath(new URL('.',import.meta.url));
http.createServer(async(_req,res)=>{try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(await readFile(join(root,'index.html')));}catch{res.writeHead(500);res.end('Frontend error');}}).listen(port,()=>console.log(`CLSK Mini App running at http://localhost:${port}`));
