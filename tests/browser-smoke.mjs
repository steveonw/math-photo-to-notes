import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const host='127.0.0.1';
const port=4173;

const types={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.md':'text/markdown; charset=utf-8'
};

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://'+host+':'+port);
    let rel=decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if(!rel)rel='photo_to_text.html';
    const file=path.resolve(root,rel);
    if(!file.startsWith(root+path.sep)&&file!==root)throw new Error('blocked path');
    const data=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(data);
  }catch(e){
    res.writeHead(404,{'Content-Type':'text/plain'});res.end('not found');
  }
});

await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(port,host,resolve);
});

const browser=await chromium.launch({headless:true});
const appUrl='http://'+host+':'+port+'/photo_to_text.html';
const mathResponse='The derivative of $x^2$ is $2x$, and this sentence contains enough ordinary words for a good classification.';
const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQwAAAABJRU5ErkJggg==';

function assert(ok,message){if(!ok)throw new Error(message)}

async function newPage(){
  const context=await browser.newContext();
  const page=await context.newPage();

  await page.route('https://cdn.jsdelivr.net/**/tex-mml-chtml.js',route=>route.fulfill({
    status:200,
    contentType:'application/javascript',
    body:'window.MathJax=window.MathJax||{};window.MathJax.typesetPromise=async()=>{};window.MathJax.typesetClear=()=>{};'
  }));

  await page.route('https://api.anthropic.com/v1/messages',route=>{
    const cors={
      'access-control-allow-origin':'*',
      'access-control-allow-headers':'*',
      'access-control-allow-methods':'POST, OPTIONS'
    };
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
    return route.fulfill({
      status:200,
      headers:{...cors,'content-type':'application/json'},
      body:JSON.stringify({
        content:[{type:'text',text:mathResponse}],
        stop_reason:'end_turn',
        usage:{input_tokens:11,output_tokens:23}
      })
    });
  });

  await page.goto(appUrl,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{
    document.getElementById('provider').value='anthropic';
    document.getElementById('provider').dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('model').value='claude-smoke-test';
    document.getElementById('apikey').value='test-key';
    document.getElementById('auto-routing').checked=false;
  });
  return {context,page};
}

async function addFixture(page,name='fixture.png'){
  await page.evaluate(({pngBase64,name})=>{
    const raw=atob(pngBase64);
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const file=new File([bytes],name,{type:'image/png'});
    return addFiles([file]);
  },{pngBase64,name});
}

async function processOne(page){
  await page.click('#run');
  await page.waitForFunction(()=>{
    const badge=document.querySelector('.badge');
    if(!badge)return false;
    const t=(badge.textContent||'').trim();
    return t!=='Queued'&&t!=='Running';
  },null,{timeout:15000});
  return page.evaluate(()=>({
    badge:(document.querySelector('.badge')?.textContent||'').trim(),
    final:document.querySelector('textarea[id^="source-"]')?.value||'',
    raw:(()=>{const id=document.querySelector('textarea[id^="source-"]')?.id?.replace('source-','');const item=id?state.items.find(x=>x.id===id):null;return item?.rawText||''})(),
    reason:document.querySelector('.reason')?.textContent||'',
    error:document.querySelector('.error')?.textContent||''
  }));
}

try{
  // Built-in deterministic/browser self-tests must actually execute to completion.
  {
    const {context,page}=await newPage();
    const result=await page.evaluate(()=>runA2SelfTests());
    assert(result&&result.total>0,'runA2SelfTests returned no tests');
    assert(result.passed===result.total,'Self-tests failed: '+JSON.stringify(result.tests.filter(t=>!t.ok)));

    const repaired=await page.evaluate(()=>({
      radical:repairLatexForMathJax('$√x$').text,
      exponent:repairLatexForMathJax('$x^2$').text,
      frac:repairLatexForMathJax('$frac{1}{2}$').text,
      sqrt:repairLatexForMathJax('$sqrt{x}$').text,
      theta:repairLatexForMathJax('$theta_1$').text,
      sin:repairLatexForMathJax('$sin(x)$').text
    }));
    assert(repaired.radical==='$√x$','Radical scope changed unexpectedly');
    assert(repaired.exponent==='$x^2$','Ordinary exponent math changed unexpectedly');
    assert(repaired.frac==='$\\frac{1}{2}$','frac backslash repair is wrong: '+JSON.stringify(repaired.frac));
    assert(repaired.sqrt==='$\\sqrt{x}$','sqrt backslash repair is wrong: '+JSON.stringify(repaired.sqrt));
    assert(repaired.theta==='$\\theta_1$','theta backslash repair is wrong: '+JSON.stringify(repaired.theta));
    assert(repaired.sin==='$\\sin(x)$','sin backslash repair is wrong: '+JSON.stringify(repaired.sin));
    await context.close();
  }

  // Normal end-to-end mocked provider path with LaTeX.
  {
    const {context,page}=await newPage();
    await addFixture(page,'math-fixture.png');
    const item=await processOne(page);
    assert(item.badge!=='Failed','Math transcription was marked Failed: '+JSON.stringify(item));
    assert(item.badge==='Good','Expected Good math transcription, got '+item.badge+' / '+item.reason);
    assert(item.final.includes('$x^2$')&&item.final.includes('$2x$'),'Math was not preserved in final text');
    assert(item.raw.includes('$x^2$')&&item.raw.includes('$2x$'),'Raw provider result was not preserved');
    await context.close();
  }

  // Successful provider output must survive a local post-processing crash.
  {
    const {context,page}=await newPage();
    await page.evaluate(()=>{repairLatexForMathJax=()=>{throw new Error('forced post-processing crash')}}); // intentional test fault
    await addFixture(page,'post-process-crash.png');
    const item=await processOne(page);
    assert(item.badge==='Review','Post-processing crash should be Review, got '+item.badge);
    assert(item.final.includes('$x^2$')&&item.raw.includes('$x^2$'),'Raw paid result was lost after local processing error');
    assert(/Post-processing error/i.test(item.error),'Local processing failure was not identified clearly: '+item.error);
    await context.close();
  }

  // Gemini auth must use a header, not a query-string key.
  {
    const {context,page}=await newPage();
    const captured=await page.evaluate(async({pngBase64})=>{
      let seen=null;
      const originalFetch=window.fetch;
      window.fetch=async(url,opts={})=>{
        seen={url:String(url),headers:{...(opts.headers||{})}};
        return new Response(JSON.stringify({
          candidates:[{content:{parts:[{text:'A sufficiently long mocked Gemini response without math problems.'}]},finishReason:'STOP'}],
          usageMetadata:{promptTokenCount:5,candidatesTokenCount:7,totalTokenCount:12}
        }),{status:200,headers:{'Content-Type':'application/json'}});
      };
      try{
        const raw=atob(pngBase64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
        const file=new File([bytes],'gemini.png',{type:'image/png'});
        await transcribe({file,imageData:''},{provider:'gemini',model:'gemini-test',apiKey:'secret-test-key',baseUrl:'',prompt:'transcribe',pass:'primary'},new AbortController().signal);
        return seen;
      }finally{window.fetch=originalFetch}
    },{pngBase64});
    assert(captured&&!captured.url.includes('secret-test-key')&&!captured.url.includes('?key='),'Gemini API key leaked into URL');
    const header=Object.entries(captured.headers).find(([k])=>k.toLowerCase()==='x-goog-api-key');
    assert(header&&header[1]==='secret-test-key','Gemini x-goog-api-key header missing');
    await context.close();
  }

  console.log(JSON.stringify({ok:true,message:'Browser smoke tests passed'}));
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
