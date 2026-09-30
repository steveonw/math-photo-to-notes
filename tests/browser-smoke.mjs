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
let anthropicResponse=mathResponse;
let anthropicCalls=0;
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
    anthropicCalls++;
    return route.fulfill({
      status:200,
      headers:{...cors,'content-type':'application/json'},
      body:JSON.stringify({
        content:[{type:'text',text:anthropicResponse}],
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
    anthropicResponse=mathResponse;
    anthropicCalls=0;
    const {context,page}=await newPage();
    await addFixture(page,'math-fixture.png');
    const item=await processOne(page);
    assert(item.badge!=='Failed','Math transcription was marked Failed: '+JSON.stringify(item));
    assert(item.badge==='Good','Expected Good math transcription, got '+item.badge+' / '+item.reason);
    assert(item.final.includes('$x^2$')&&item.final.includes('$2x$'),'Math was not preserved in final text');
    assert(item.raw.includes('$x^2$')&&item.raw.includes('$2x$'),'Raw provider result was not preserved');
    await context.close();
  }

  // Release B: Good-page spot checks persist human evidence and provenance.
  {
    anthropicResponse=mathResponse;
    anthropicCalls=0;
    const {context,page}=await newPage();
    await addFixture(page,'spotcheck-ok.png');
    const item=await processOne(page);
    assert(item.badge==='Good','Spot-check fixture must begin in Good');

    await page.click('#summary-spotcheck-good');
    await page.waitForFunction(()=>!document.getElementById('spotcheck-panel').classList.contains('hidden'),null,{timeout:5000});
    const panelText=await page.locator('#spotcheck-panel').innerText();
    assert(/Good-page spot-check/i.test(panelText),'Spot-check review panel did not open');
    await page.click('#spotcheck-ok');
    await page.waitForFunction(()=>state.spotCheckLedger.length===1,null,{timeout:5000});

    const evidence=await page.evaluate(()=>{
      const rec=state.spotCheckLedger[0];
      const payload=projectEnvelope(false);
      state.spotCheckLedger=[];
      state.spotCheckSession=null;
      hydrateSavedItems(payload);
      return {
        ledgerLength:state.spotCheckLedger.length,
        rec:state.spotCheckLedger[0],
        original:rec,
        reliabilityText:document.getElementById('reliability-summary')?.innerText||''
      };
    });
    assert(evidence.ledgerLength===1,'Spot-check ledger did not survive project hydration');
    assert(evidence.rec.outcome==='ok','OK spot-check outcome was not preserved');
    assert(evidence.rec.model==='claude-smoke-test','Spot-check model provenance missing');
    assert(evidence.rec.promptFingerprint&&evidence.rec.promptFingerprint.length===64,'Prompt fingerprint missing from spot-check evidence');
    assert(evidence.rec.processingFingerprint&&evidence.rec.processingFingerprint.length===64,'Processing fingerprint missing from spot-check evidence');
    assert(!('accuracy' in evidence.rec),'Spot-check record should not claim an accuracy percentage');
    await page.evaluate(()=>render());
    const reliability=await page.locator('#reliability-summary').innerText();
    assert(/1 human-reviewed Good page/i.test(reliability),'Reliability summary did not show accumulated human count');
    assert(/not a formal accuracy percentage/i.test(reliability),'Reliability summary overclaimed accuracy');
    await context.close();
  }

  // Release B: an error found during a Good-page spot-check becomes Review without changing text.
  {
    anthropicResponse=mathResponse;
    anthropicCalls=0;
    const {context,page}=await newPage();
    await addFixture(page,'spotcheck-error.png');
    const before=await processOne(page);
    assert(before.badge==='Good','Error spot-check fixture must begin in Good');

    await page.click('#summary-spotcheck-good');
    await page.selectOption('#spotcheck-error-category','exponent-subscript');
    await page.fill('#spotcheck-note','Exponent should be checked against the source image.');
    await page.click('#spotcheck-error');
    await page.waitForFunction(()=>state.spotCheckLedger.length===1&&state.items[0].classification==='review',null,{timeout:5000});

    const after=await page.evaluate(()=>({
      classification:state.items[0].classification,
      finalText:state.items[0].finalText,
      ledger:state.spotCheckLedger[0]
    }));
    assert(after.classification==='review','Human-found Good-page error did not move the page to Review');
    assert(after.finalText===before.final,'Spot-check error reporting changed transcription text');
    assert(after.ledger.outcome==='error','Error spot-check was not recorded');
    assert(after.ledger.errorCategory==='exponent-subscript','Error category was not preserved');
    assert(/Exponent should be checked/.test(after.ledger.note),'Spot-check note was not preserved');
    await context.close();
  }

  // Release A: Quick Transcribe must stop after one semantic pass when Auto-fix is off.
  {
    anthropicResponse='Only a few words';
    anthropicCalls=0;
    const {context,page}=await newPage();
    await page.evaluate(()=>{document.getElementById('auto-routing').checked=false});
    await addFixture(page,'quick-transcribe-review.png');
    const item=await processOne(page);
    await page.waitForFunction(()=>!document.getElementById('batch-summary').classList.contains('hidden'),null,{timeout:15000});
    const summary=await page.locator('#batch-summary').innerText();
    assert(item.badge==='Review','Quick Transcribe fixture should land in Review, got '+item.badge);
    assert(anthropicCalls===1,'Quick Transcribe made '+anthropicCalls+' Anthropic calls; expected exactly one semantic pass');
    assert(/Quick Transcribe/i.test(summary),'Batch summary did not identify Quick Transcribe');
    assert(/Review/i.test(summary),'Batch summary did not include the Review pile');
    assert(/no automatic warning signals/i.test(summary),'Batch summary did not explain what Good means');
    const autoFixLabel=await page.locator('label.mode-toggle').first().innerText();
    assert(/Auto-fix flagged pages/i.test(autoFixLabel),'Release A Auto-fix label is missing');
    await context.close();
    anthropicResponse=mathResponse;
  }

  // Successful provider output must survive a local post-processing crash.
  {
    anthropicResponse=mathResponse;
    anthropicCalls=0;
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
