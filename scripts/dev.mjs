import { spawn } from 'node:child_process';
const children=[['apps/api','dev'],['apps/web','dev']].map(([dir,script])=>spawn(process.platform==='win32'?'pnpm.cmd':'pnpm',['--dir',dir,script],{stdio:'inherit',shell:true}));
const stop=()=>children.forEach(c=>c.kill());process.on('SIGINT',stop);process.on('SIGTERM',stop);
