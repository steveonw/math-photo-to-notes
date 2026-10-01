import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const regressionFixtures=JSON.parse(await fs.readFile(path.join(here,'fixtures','browser-regressions.json'),'utf8'));
const host='127.0.0.1';
const port=4173;
const EXPECTED_MATHJAX_GIT_BLOB_SHA1='b3388d20a8d2773b001eebd3211ef1a337335d67';

const types={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.md':'text/markdown; charset=utf-8',
  '.woff':'font/woff'
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
const appFile=process.env.APP_FILE||'photo_to_text.html';
const offlineMode=/OFFLINE/i.test(appFile);
const appUrl='http://'+host+':'+port+'/'+appFile;
const mathResponse='The derivative of $x^2$ is $2x$, and this sentence contains enough ordinary words for a good classification.';
let anthropicResponse=mathResponse;
let anthropicResponses=[];
let anthropicCalls=0;
let anthropicDelayMs=0;
const pngBase64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQwAAAABJRU5ErkJggg==';

function assert(ok,message){if(!ok)throw new Error(message)}

const mathJaxBytes=await fs.readFile(path.join(root,'vendor','mathjax','tex-svg-full.js'));
const mathJaxGitBlobSha=crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob '+mathJaxBytes.length,'ascii'),Buffer.from([0]),mathJaxBytes])).digest('hex');
assert(mathJaxGitBlobSha===EXPECTED_MATHJAX_GIT_BLOB_SHA1,'Vendored MathJax blob drifted: '+mathJaxGitBlobSha);


async function newPage(){
  const context=await browser.newContext();
  const remoteMathJaxScripts=[];
  const localMathJaxRequests=[];
  context.on('request',request=>{
    const url=request.url();
    if(url.includes('/vendor/mathjax/'))localMathJaxRequests.push(url);
    if(url.includes('cdn.jsdelivr.net')&&/\.js(?:$|\?)/.test(url))remoteMathJaxScripts.push(url);
  });
  const page=await context.newPage();

  await context.route('https://cdn.jsdelivr.net/**/tex-mml-chtml.js',route=>route.fulfill({
    status:200,
    contentType:'application/javascript',
    body:'window.MathJax=window.MathJax||{};window.MathJax.typesetPromise=async()=>{};window.MathJax.typesetClear=()=>{};'
  }));

  await page.route('https://api.anthropic.com/v1/messages',async route=>{
    const cors={
      'access-control-allow-origin':'*',
      'access-control-allow-headers':'*',
      'access-control-allow-methods':'POST, OPTIONS'
    };
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:cors,body:''});
    anthropicCalls++;
    const responseText=anthropicResponses.length?anthropicResponses.shift():anthropicResponse;
    if(anthropicDelayMs)await new Promise(resolve=>setTimeout(resolve,anthropicDelayMs));
    return route.fulfill({
      status:200,
      headers:{...cors,'content-type':'application/json'},
      body:JSON.stringify({
        content:[{type:'text',text:responseText}],
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
  return {context,page,remoteMathJaxScripts,localMathJaxRequests};
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

    const corpus=await page.evaluate(fixtures=>({
      repair:fixtures.repair.map(x=>({name:x.name,actual:repairLatexForMathJax(x.input).text,expected:x.expected})),
      classification:fixtures.classification.map(x=>({name:x.name,actual:classifyText(x.input).classification,expected:x.expected})),
      validation:fixtures.validation.map(x=>({name:x.name,count:latexStructuralWarnings(x.input).length,min:x.minWarnings})),
      assurance:fixtures.assurance.map(x=>({name:x.name,actual:compareHighAssuranceTexts(x.primary,x.verifier).disagree,expected:x.disagree})),
      pageNumber:fixtures.pageNumber.map(x=>({name:x.name,actual:suggestPageNumber(x.item)?.value||'',expected:x.expected})),
      migration:(()=>{
        const v1={schema:PROJECT_SCHEMA,version:1,items:[{id:'legacy',regions:[]}],queue:{jobs:[{id:'legacy',state:'running',pass:'primary'}]}};
        const v2=prepareProjectEnvelope(v1);
        return {version:v2.version,kind:v2.queue.jobs[0].kind,migrations:v2.migrationHistory.length};
      })()
    }),regressionFixtures);
    for(const x of corpus.repair)assert(x.actual===x.expected,'Fixture repair failed '+x.name+': '+JSON.stringify(x));
    for(const x of corpus.classification)assert(x.actual===x.expected,'Fixture classification failed '+x.name+': '+JSON.stringify(x));
    for(const x of corpus.validation)assert(x.min===0?x.count===0:x.count>=x.min,'Fixture validation failed '+x.name+': '+JSON.stringify(x));
    for(const x of corpus.assurance)assert(x.actual===x.expected,'Fixture assurance comparison failed '+x.name+': '+JSON.stringify(x));
    for(const x of corpus.pageNumber)assert(x.actual===x.expected,'Fixture page-number inference failed '+x.name+': '+JSON.stringify(x));
    assert(corpus.migration.version===2&&corpus.migration.kind==='page'&&corpus.migration.migrations===1,'Project v1 migration fixture failed: '+JSON.stringify(corpus.migration));
    await context.close();
  }

  // Normal end-to-end mocked provider path with LaTeX.
  {
    anthropicResponse=mathResponse;
    anthropicCalls=0;
    const {context,page,remoteMathJaxScripts,localMathJaxRequests}=await newPage();
    await addFixture(page,'math-fixture.png');
    const item=await processOne(page);
    assert(item.badge!=='Failed','Math transcription was marked Failed: '+JSON.stringify(item));
    assert(item.badge==='Good','Expected Good math transcription, got '+item.badge+' / '+item.reason);
    assert(item.final.includes('$x^2$')&&item.final.includes('$2x$'),'Math was not preserved in final text');
    assert(item.raw.includes('$x^2$')&&item.raw.includes('$2x$'),'Raw provider result was not preserved');
    await page.locator('.previewpane mjx-container').first().waitFor({state:'attached',timeout:10000});
    await page.waitForTimeout(250);
    assert(remoteMathJaxScripts.length===0,'Remote executable MathJax JavaScript was requested: '+JSON.stringify(remoteMathJaxScripts));
    const mathJaxSourceAudit=await page.evaluate(()=>({
      hasRemote:document.documentElement.outerHTML.includes('cdn.jsdelivr.net/npm/mathjax'),
      printSource:String(exportPdfPile),
      embedded:!!document.getElementById('embedded-mathjax-source'),
      renderedSvg:!!document.querySelector('.previewpane mjx-container svg')
    }));
    assert(mathJaxSourceAudit.hasRemote===false,'Application source still contains remote MathJax executable URLs');
    const rendererAudit=await page.evaluate(async cases=>{
      const out=[];
      for(let n=0;n<cases.length;n++){
        const x=cases[n];
        const id='renderer-corpus-'+n;
        const el=document.createElement('div');
        el.id='preview-'+id;
        document.body.appendChild(el);
        state.items.push({id,status:'done',classification:'good',text:x.tex,finalText:x.tex,mathRenderWarnings:[]});
        await renderMathPreview(id,x.tex);
        const it=state.items.find(y=>y.id===id);
        out.push({
          name:x.name,
          expect:x.expect,
          unsafe:!!x.unsafe,
          classification:it.classification,
          warning:(it.mathRenderWarnings||[]).join(' '),
          finalText:it.finalText,
          renderedSvg:!!el.querySelector('mjx-container svg'),
          hasMerror:!!el.querySelector('mjx-merror,[data-mml-node="merror"]'),
          jsLink:!!el.querySelector('a[href^="javascript:"],[href^="javascript:"]'),
          fixed:!!el.querySelector('[style*="position:fixed"],[style*="position: fixed"]')
        });
        state.items=state.items.filter(y=>y.id!==id);
        if(window.MathJax?.typesetClear)window.MathJax.typesetClear([el]);
        el.remove();
      }

      // Historical/raw/repaired previews are informative only; they cannot mutate final-page state.
      const safeId='renderer-nonauthoritative';
      const safe=document.createElement('div');
      safe.id='preview-'+safeId;
      document.body.appendChild(safe);
      state.items.push({id:safeId,status:'done',classification:'good',text:'$x^2$',finalText:'$x^2$',mathRenderWarnings:[]});
      await renderMathPreview(safeId,'$x^$');
      const safeItem=state.items.find(x=>x.id===safeId);
      const nonAuthoritative={classification:safeItem.classification,warnings:safeItem.mathRenderWarnings||[],finalText:safeItem.finalText};
      state.items=state.items.filter(x=>x.id!==safeId);
      if(window.MathJax?.typesetClear)window.MathJax.typesetClear([safe]);
      safe.remove();

      return {
        cases:out,
        nonAuthoritative,
        packages:Array.isArray(window.MathJax?.config?.tex?.packages)?[...window.MathJax.config.tex.packages]:window.MathJax?.config?.tex?.packages||null
      };
    },regressionFixtures.renderer);

    assert(rendererAudit.cases.length===regressionFixtures.renderer.length,'Renderer fixture corpus did not run completely');
    for(const x of rendererAudit.cases){
      assert(x.finalText===regressionFixtures.renderer.find(y=>y.name===x.name)?.tex,'Renderer fixture changed source text '+x.name+': '+JSON.stringify(x));
      assert(!x.jsLink&&!x.fixed,'Renderer fixture injected active HTML/CSS '+x.name+': '+JSON.stringify(x));
      if(x.expect==='render'){
        assert(x.classification==='good','Valid renderer fixture was not kept Good '+x.name+': '+JSON.stringify(x));
        assert(!x.warning,'Valid renderer fixture produced warning '+x.name+': '+JSON.stringify(x));
        assert(x.renderedSvg===true&&x.hasMerror===false,'Valid renderer fixture did not produce clean SVG '+x.name+': '+JSON.stringify(x));
      }else{
        assert(x.classification==='mathunsure','Bad/untrusted renderer fixture was not flagged Math Unsure '+x.name+': '+JSON.stringify(x));
        assert(/TeX error|unrenderable TeX/i.test(x.warning),'Bad/untrusted renderer fixture did not preserve a render warning '+x.name+': '+JSON.stringify(x));
      }
    }
    assert(rendererAudit.nonAuthoritative.classification==='good','Non-authoritative preview mutated page classification: '+JSON.stringify(rendererAudit.nonAuthoritative));
    assert(rendererAudit.nonAuthoritative.warnings.length===0,'Non-authoritative preview persisted final render warnings: '+JSON.stringify(rendererAudit.nonAuthoritative));
    assert(rendererAudit.nonAuthoritative.finalText==='$x^2$','Non-authoritative preview changed final text');
    if(Array.isArray(rendererAudit.packages)){
      for(const blocked of ['html','noundefined','require'])assert(!rendererAudit.packages.includes(blocked),'Live MathJax package policy drifted; blocked package loaded: '+blocked);
    }

    // Exercise the actual PDF/print window, not only exportPdfPile source text.
    // Neutralize the native print dialog at popup creation time so headless Chromium can inspect the rendered document.
    await page.evaluate(()=>{
      const realOpen=window.open.bind(window);
      window.open=(...args)=>{
        const w=realOpen(...args);
        if(w)w.print=()=>{w.__mathPhotoPrintCalled=true};
        return w;
      };
    });
    const popupPromise=page.waitForEvent('popup');
    await page.evaluate(()=>exportPdfPile([
      {name:'renderer-parity.pdf-fixture',text:'$\\frac{1}{2}+\\cancel{x}$',classification:'good',metadata:{},documentId:''}
    ],'Renderer parity'));
    const printPage=await popupPromise;
    await printPage.locator('mjx-container svg').first().waitFor({state:'attached',timeout:10000});
    await printPage.waitForFunction(()=>window.__mathPhotoPrintCalled===true,null,{timeout:10000});
    const printAudit=await printPage.evaluate(()=>({
      renderedSvg:!!document.querySelector('mjx-container svg'),
      hasMerror:!!document.querySelector('mjx-merror,[data-mml-node="merror"]'),
      packages:Array.isArray(window.MathJax?.config?.tex?.packages)?[...window.MathJax.config.tex.packages]:window.MathJax?.config?.tex?.packages||null,
      scriptSrcs:[...document.scripts].map(x=>x.src).filter(Boolean),
      embeddedSource:document.documentElement.innerHTML.includes('MathJax 3.2.2 tex-svg-full EMBEDDED'),
      printCalled:window.__mathPhotoPrintCalled===true
    }));
    assert(printAudit.renderedSvg===true&&printAudit.hasMerror===false,'PDF/print path did not render clean SVG: '+JSON.stringify(printAudit));
    assert(printAudit.printCalled===true,'PDF/print path did not reach the print-ready state');
    if(Array.isArray(printAudit.packages)){
      for(const blocked of ['html','noundefined','require'])assert(!printAudit.packages.includes(blocked),'PDF MathJax package policy drifted; blocked package loaded: '+blocked);
    }
    if(offlineMode){
      assert(printAudit.embeddedSource===true,'Offline PDF/print window did not reuse embedded tex-svg-full source');
      assert(!printAudit.scriptSrcs.some(x=>x.includes('/vendor/mathjax/')),'Offline PDF/print unexpectedly loaded companion MathJax: '+JSON.stringify(printAudit.scriptSrcs));
    }else{
      assert(printAudit.scriptSrcs.some(x=>x.includes('/vendor/mathjax/tex-svg-full.js')),'Normal PDF/print did not load pinned local tex-svg-full: '+JSON.stringify(printAudit.scriptSrcs));
    }
    await printPage.close();

    assert(!/cdn\.jsdelivr\.net\/npm\/mathjax/i.test(mathJaxSourceAudit.printSource),'PDF export still references remote MathJax');
    if(offlineMode){
      assert(mathJaxSourceAudit.embedded===true,'Offline build is missing embedded tex-svg MathJax source');
      assert(mathJaxSourceAudit.renderedSvg===true,'Offline build did not render MathJax through SVG output');
      assert(localMathJaxRequests.length===0,'Offline build unexpectedly requested companion MathJax files from live or PDF paths: '+JSON.stringify(localMathJaxRequests));
      assert(mathJaxSourceAudit.printSource.includes('embedded-mathjax-source'),'Offline PDF export does not reuse the embedded MathJax source');
    }else{
      assert(mathJaxSourceAudit.renderedSvg===true,'Normal build did not render MathJax through SVG output');
      assert(localMathJaxRequests.some(x=>x.includes('/vendor/mathjax/tex-svg-full.js')),'Pinned MathJax tex-svg-full bundle was not loaded from the local vendor tree');
      assert(localMathJaxRequests.every(x=>x.includes('/vendor/mathjax/tex-svg-full.js')),'Normal live/PDF paths requested an unexpected MathJax companion asset: '+JSON.stringify(localMathJaxRequests));
      assert(mathJaxSourceAudit.printSource.includes("vendor/mathjax/tex-svg-full.js"),'PDF export no longer points at the pinned local tex-svg-full bundle');
    }
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

    const clearPersistence=await page.evaluate(async()=>{
      window.confirm=()=>true;
      await document.getElementById('clear').onclick();
      const stored=await idbGet(DB_RELIABILITY,RELIABILITY_LEDGER_KEY);
      return {items:state.items.length,inMemory:state.spotCheckLedger.length,stored:Array.isArray(stored)?stored.length:0};
    });
    assert(clearPersistence.items===0,'Clear all did not clear the working project');
    assert(clearPersistence.inMemory===1&&clearPersistence.stored===1,'Clear all erased global spot-check reliability evidence: '+JSON.stringify(clearPersistence));
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>state.spotCheckLedger.length===1&&state.items.length===0,null,{timeout:5000});
    const afterReload=await page.evaluate(()=>({items:state.items.length,ledger:state.spotCheckLedger.length}));
    assert(afterReload.items===0&&afterReload.ledger===1,'Global reliability evidence did not survive Clear all plus reload: '+JSON.stringify(afterReload));
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

  // Release D: High Assurance independently verifies math-heavy Good pages without replacing Primary text.
  {
    const primary='The calculation below is important: $\\int_0^1 x^2\\,dx = \\sum_{n=1}^{10} n$. These surrounding words make the page long enough for normal Good classification.';
    const verifier=primary;
    anthropicResponse=primary;
    anthropicResponses=[primary,verifier];
    anthropicCalls=0;
    const {context,page}=await newPage();
    await page.evaluate(()=>{
      document.getElementById('provider2').value='anthropic';
      document.getElementById('provider2').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('model2').value='claude-secondary-smoke';
      document.getElementById('apikey2').value='secondary-test-key';
      document.getElementById('high-assurance').checked=true;
      document.getElementById('high-assurance-policy').value='heavy';
      document.getElementById('high-assurance').dispatchEvent(new Event('change',{bubbles:true}));
    });
    await addFixture(page,'high-assurance-agree.png');
    const preview=await page.evaluate(()=>{renderQueueStatus();return document.getElementById('high-assurance-cost-preview').textContent});
    assert(/Up to 1 extra Secondary call/i.test(preview),'High Assurance did not expose added-call cost preview: '+preview);
    await page.click('#run');
    await page.waitForFunction(()=>!state.queuePlan&&state.items[0]?.highAssuranceStatus==='verified',null,{timeout:20000});
    const result=await page.evaluate(()=>({
      finalText:state.items[0].finalText,
      classification:state.items[0].classification,
      status:state.items[0].highAssuranceStatus,
      attempts:state.items[0].highAssuranceAttempts,
      checks:state.items[0].highAssuranceChecks,
      usage:state.items[0].usageLog,
      summary:state.lastBatchSummary
    }));
    assert(anthropicCalls===2,'High Assurance agreement should make one Primary and one Secondary call, got '+anthropicCalls);
    assert(result.finalText===primary,'High Assurance agreement replaced or changed Primary final text');
    assert(result.classification==='good'&&result.status==='verified','High Assurance agreement did not remain verified Good: '+JSON.stringify(result));
    assert(result.attempts===1&&result.checks.length===1&&result.checks[0].outcome==='verified','High Assurance verification evidence was not recorded');
    assert(result.checks[0].provider==='anthropic'&&result.checks[0].model==='claude-secondary-smoke','Verifier provider/model provenance missing');
    assert(result.usage.some(x=>x.scope==='high-assurance'&&x.pass==='secondary'),'Verifier usage was not exposed in the usage log');
    assert(result.summary.highAssurance===true&&result.summary.highAssurancePolicy==='heavy','Batch summary lost High Assurance policy');

    await page.click('#summary-spotcheck-good');
    await page.click('#spotcheck-ok');
    await page.waitForFunction(()=>state.spotCheckLedger.length===1,null,{timeout:5000});
    const evidence=await page.evaluate(()=>({rec:state.spotCheckLedger[0],groups:reliabilityGroups()}));
    assert(evidence.rec.highAssuranceVerified===true&&evidence.rec.highAssurancePolicy==='heavy','Spot-check evidence did not record actual High Assurance verification');
    assert(evidence.groups[0]?.highAssuranceVerified===true,'Reliability grouping cannot compare verified vs standard pages');
    await context.close();
    anthropicResponses=[];
  }

  // Release D: math disagreement routes to Review, preserves Primary, and never feeds disagreement into Auto-fix.
  {
    const primary='The calculation below is important: $\\int_0^1 (x^2-1)\\,dx = \\sum_{n=1}^{10} n$. These surrounding words make the page long enough for normal Good classification.';
    const verifier='The calculation below is important: $\\int_0^1 (x^2+1)\\,dx = \\sum_{n=1}^{10} n$. These surrounding words make the page long enough for normal Good classification.';
    anthropicResponse=primary;
    anthropicResponses=[primary,verifier];
    anthropicCalls=0;
    const {context,page}=await newPage();
    await page.evaluate(()=>{
      document.getElementById('provider2').value='anthropic';
      document.getElementById('provider2').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('model2').value='claude-secondary-smoke';
      document.getElementById('apikey2').value='secondary-test-key';
      document.getElementById('high-assurance').checked=true;
      document.getElementById('high-assurance-policy').value='heavy';
      document.getElementById('auto-routing').checked=true;
      document.getElementById('auto-max-attempts').value='3';
    });
    await addFixture(page,'high-assurance-disagree.png');
    await page.click('#run');
    await page.waitForFunction(()=>!state.queuePlan&&state.items[0]?.highAssuranceStatus==='review',null,{timeout:20000});
    const result=await page.evaluate(()=>({
      finalText:state.items[0].finalText,
      classification:state.items[0].classification,
      assuranceStatus:state.items[0].highAssuranceStatus,
      check:state.items[0].highAssuranceChecks.at(-1),
      routing:state.items[0].routingHistory,
      secondaryAttempts:state.items[0].secondaryAttempts,
      assuranceAttempts:state.items[0].highAssuranceAttempts
    }));
    assert(anthropicCalls===2,'High Assurance disagreement should stop after Primary + verifier, even with Auto-fix enabled; calls='+anthropicCalls);
    assert(result.finalText===primary,'High Assurance disagreement silently replaced the Primary transcription');
    assert(result.classification==='review'&&result.assuranceStatus==='review','High Assurance disagreement did not route page to Review');
    assert(result.check?.comparison?.disagree===true&&result.check?.comparison?.mathEqual===false,'Sign-level math disagreement was not detected');
    assert(result.check.repairedText===verifier,'Independent verifier text was not preserved for human comparison');
    assert(result.secondaryAttempts===0&&result.assuranceAttempts===1,'Verifier was incorrectly counted as a normal Secondary retry');
    assert(!result.routing.some(x=>x.action==='queued'&&x.signature?.startsWith('review>')),'High Assurance disagreement was automatically routed to another AI instead of stopping for human review');
    const assuranceSummary=page.locator('.card details.historybox summary').filter({hasText:'High Assurance evidence'});
    assert(await assuranceSummary.count()===1,'High Assurance evidence summary is not visible on the page card');
    await assuranceSummary.click();
    const card=await page.locator('.card').innerText();
    assert(/x\^2\+1/.test(card.replace(/\s/g,'')),'Expanded High Assurance evidence does not show the verifier reading');
    await context.close();
    anthropicResponses=[];
    anthropicResponse=mathResponse;
  }

  // Release E: targeted-region Primary/Secondary work is a durable queue, not an in-flight-only side path.
  {
    anthropicResponse=mathResponse;
    anthropicResponses=[];
    anthropicCalls=0;
    anthropicDelayMs=0;
    const {context,page}=await newPage();
    await addFixture(page,'durable-region.png');
    const base=await processOne(page);
    assert(base.badge==='Good','Durable-region fixture must begin with a completed page');

    await page.evaluate(()=>{
      document.getElementById('provider2').value='anthropic';
      document.getElementById('provider2').dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('model2').value='claude-region-secondary';
      document.getElementById('apikey2').value='secondary-region-key';
      const item=state.items[0];
      item.regions=[{
        id:'region-durable',note:'Durable equation check',x:0,y:0,w:1,h:1,
        cropDataUrl:item.imageData,cropHash:'fixture-crop',anchor:null,
        results:[],events:[],runningPasses:[],preferredResultId:'',needsRefresh:false,disagreement:false
      }];
      render();
    });

    anthropicCalls=0;
    anthropicResponses=[
      'Targeted equation $x^2+1$',
      'Targeted equation $x^2+1$'
    ];
    anthropicDelayMs=350;
    await page.evaluate(()=>runRegionComparison(state.items[0].id,'region-durable'));
    await page.waitForFunction(()=>state.queuePlan?.kind==='region'&&state.queuePlan.jobs.some(j=>j.state==='running'),null,{timeout:5000});
    const persisted=await page.evaluate(()=>{
      const q=projectEnvelope(false).queue;
      return {kind:q.kind,jobs:q.jobs.map(j=>({kind:j.kind,regionId:j.regionId,pass:j.pass,state:j.state}))};
    });
    assert(persisted.kind==='region'&&persisted.jobs.length===2,'Targeted comparison did not create a durable region queue: '+JSON.stringify(persisted));
    assert(persisted.jobs.every(j=>j.kind==='region'&&j.regionId==='region-durable'&&j.state==='pending'),'Running targeted jobs did not serialize as resumable pending jobs: '+JSON.stringify(persisted));

    await page.waitForFunction(()=>!state.queuePlan&&state.items[0].regions[0].results.length===2,null,{timeout:15000});
    const done=await page.evaluate(()=>({
      results:state.items[0].regions[0].results.map(x=>({pass:x.pass,provider:x.provider,model:x.model})),
      queuedEvents:state.items[0].regions[0].events.filter(x=>x.action==='queued').length,
      runningPasses:state.items[0].regions[0].runningPasses
    }));
    assert(anthropicCalls===2,'Durable targeted comparison should make exactly two calls, got '+anthropicCalls);
    assert(done.results.some(x=>x.pass==='primary')&&done.results.some(x=>x.pass==='secondary'),'Durable targeted queue lost a pass: '+JSON.stringify(done));
    assert(done.queuedEvents===2,'Durable targeted jobs did not record queue provenance');
    assert(done.runningPasses.length===0,'Targeted running state was not cleared after queue completion');
    anthropicDelayMs=0;
    anthropicResponses=[];
    await context.close();
  }

  // Release C: external-AI packages use stable IDs and imported proposals cannot change text before human acceptance.
  {
    anthropicResponse='Only a few words';
    anthropicCalls=0;
    const {context,page}=await newPage();
    await addFixture(page,'external-review.png');
    const before=await processOne(page);
    assert(before.badge==='Review','External-review fixture should begin in Review');

    const packageCheck=await page.evaluate(async()=>{
      const item=state.items[0];
      const pkg={id:'pkg-ci-1',createdAt:new Date().toISOString(),pageIds:[item.id,'expected-missing'],chunkIndex:1,chunkCount:1,scope:'batch'};
      state.externalReviewExports=[pkg];
      const entries=await buildExternalReviewPackageEntries(pkg,[item]);
      const read=name=>{
        const e=entries.find(x=>x.name===name);
        return e?new TextDecoder().decode(e.bytes):'';
      };
      return {
        pageId:item.id,
        names:entries.map(x=>x.name),
        prompt:read('review-prompt.txt'),
        templateText:read('return-template.txt'),
        jsonFallback:JSON.parse(read('return-template-json-fallback.json'))
      };
    });
    assert(packageCheck.names.includes('review-prompt.txt')&&packageCheck.names.includes('manifest.json'),'External review package is missing prompt/manifest');
    assert(packageCheck.names.includes('return-template.txt'),'External review package is missing LaTeX-safe plain return template');
    assert(packageCheck.templateText.includes('=== PACKAGE pkg-ci-1 ==='),'Plain return template lost package ID');
    assert(packageCheck.templateText.includes('=== PAGE '+packageCheck.pageId+' ==='),'Plain return template lost stable page ID');
    assert(packageCheck.jsonFallback.package_id==='pkg-ci-1','JSON fallback template lost package ID');
    assert(!('classification' in packageCheck.jsonFallback.pages[0]),'External review template must not ask the outside AI for classification');
    assert(/NOT JSON/i.test(packageCheck.prompt)&&/LaTeX backslashes/i.test(packageCheck.prompt),'External review prompt does not prioritize the LaTeX-safe return format');

    const latexSafety=await page.evaluate(id=>{
      const expected=String.raw`$\frac{1}{2}\beta + \theta \neq \sqrt{x}$`;
      const plain='=== PACKAGE pkg-ci-1 ===\n=== PAGE '+id+' ===\n'+expected+'\n=== NOTE ===\nPreserve literal LaTeX.\n=== END ===';
      const parsed=parseExternalCorrectionText(plain);
      let unsafeMessage='';
      try{
        parseExternalCorrectionText(String.raw`{"package_id":"pkg-ci-1","pages":[{"page_id":"${id}","corrected_text":"$\frac{1}{2}\beta + \theta \neq \sqrt{x}$"}]}`);
      }catch(e){unsafeMessage=String(e?.message||e)}
      return {expected,actual:parsed.pages[0].corrected_text,format:parsed._format,unsafeMessage};
    },packageCheck.pageId);
    assert(latexSafety.actual===latexSafety.expected,'Delimited external import corrupted LaTeX: '+JSON.stringify(latexSafety));
    assert(latexSafety.format==='delimited','LaTeX-safe external response was not parsed as delimited format');
    assert(/Unsafe LaTeX backslash escaping/i.test(latexSafety.unsafeMessage),'Unsafe JSON LaTeX was not rejected specifically: '+latexSafety.unsafeMessage);

    const corrected='The derivative of $x^3$ is $3x^2$, and this corrected transcription contains enough words for a normal good classification.';
    const importResult=await page.evaluate(({id,corrected})=>{
      const response='Here are the corrections you requested.\n\n```json\n'+JSON.stringify({
        package_id:'pkg-ci-1',
        pages:[
          {page_id:id,corrected_text:corrected,note:'Corrected the exponent.',classification:'approved'},
          {page_id:'unknown-page',corrected_text:'unknown page',note:''}
        ]
      })+'\n```\nDone.';
      const original=state.items[0].finalText;
      const originalClass=state.items[0].classification;
      const session=beginExternalImportFromText(response,'chat-response.txt');
      return {
        original,
        originalClass,
        finalAfterImport:state.items[0].finalText,
        classAfterImport:state.items[0].classification,
        report:session.report,
        proposal:session.proposals[0]
      };
    },{id:packageCheck.pageId,corrected});
    assert(importResult.finalAfterImport===importResult.original,'Import changed final text before human acceptance');
    assert(importResult.classAfterImport===importResult.originalClass,'Import changed application classification before human acceptance');
    assert(importResult.report.matched===1&&importResult.report.unknown.length===1&&importResult.report.missingExpected.includes('expected-missing'),'External import report did not identify matched/unknown/missing pages');
    assert(!('classification' in importResult.proposal),'External classification field leaked into internal proposal state');

    await page.waitForFunction(()=>!document.getElementById('external-review-panel').classList.contains('hidden'),null,{timeout:5000});
    assert(await page.locator('#external-proposed-text').isEditable()===false,'External proposal should start read-only for mandatory review');
    const panel=await page.locator('#external-review-panel').innerText();
    assert(/Diff/i.test(panel)&&/human review required/i.test(panel),'External proposal panel did not show mandatory human diff review');

    await page.click('#external-edit');
    await page.fill('#external-proposed-text',corrected+' Reviewed edit.');
    await page.click('#external-accept');
    await page.waitForFunction(()=>state.items[0].externalCorrections?.some(x=>x.decision==='accepted'),null,{timeout:5000});
    const accepted=await page.evaluate(()=>({
      finalText:state.items[0].finalText,
      classification:state.items[0].classification,
      history:state.items[0].history.length,
      correction:state.items[0].externalCorrections.at(-1),
      sessionStatus:state.externalImportSession.proposals[0].status
    }));
    assert(/Reviewed edit\.$/.test(accepted.finalText),'Accepted edited external proposal was not applied');
    assert(accepted.classification!=='approved','External correction was able to approve a page');
    assert(accepted.history>0,'Accepted external correction did not preserve the previous revision');
    assert(accepted.correction.decision==='accepted'&&accepted.sessionStatus==='accepted','Accepted external correction provenance was not recorded');
    await context.close();
    anthropicResponse=mathResponse;
  }

  // Release C: accepting an external correction on an Approved page requires human reapproval.
  {
    anthropicResponse=mathResponse;
    anthropicCalls=0;
    const {context,page}=await newPage();
    await addFixture(page,'external-approved.png');
    const before=await processOne(page);
    assert(before.badge==='Good','Approved external fixture must begin in Good');
    const setup=await page.evaluate(()=>{
      const item=state.items[0];
      manualClass(item.id,'approved');
      const pkg={id:'pkg-approved',createdAt:new Date().toISOString(),pageIds:[item.id],chunkIndex:1,chunkCount:1,scope:'batch'};
      state.externalReviewExports=[pkg];
      beginExternalImportFromText(JSON.stringify({package_id:'pkg-approved',pages:[{page_id:item.id,corrected_text:(item.finalText||item.text)+' corrected externally',note:'small correction'}]}),'approved-response.json');
      return {id:item.id};
    });
    await page.click('#external-accept');
    await page.waitForFunction(()=>state.items[0].classification==='needsreapproval',null,{timeout:5000});
    const result=await page.evaluate(()=>({classification:state.items[0].classification,needsReapproval:state.items[0].needsReapproval,approvalAt:state.items[0].approvalAt}));
    assert(result.classification==='needsreapproval'&&result.needsReapproval===true,'Accepted external correction did not protect Approved lineage');
    assert(result.approvalAt,'Original approval timestamp was lost');
    await context.close();
  }

  // Release C: rejecting an external proposal preserves current text and records the rejection.
  {
    anthropicResponse='Only a few words';
    anthropicCalls=0;
    const {context,page}=await newPage();
    await addFixture(page,'external-reject.png');
    const before=await processOne(page);
    const id=await page.evaluate(()=>state.items[0].id);
    await page.evaluate(id=>{
      state.externalReviewExports=[{id:'pkg-reject',createdAt:new Date().toISOString(),pageIds:[id],chunkIndex:1,chunkCount:1,scope:'batch'}];
      beginExternalImportFromText(JSON.stringify({package_id:'pkg-reject',pages:[{page_id:id,corrected_text:'A completely different proposed transcription that should be rejected.',note:'proposal'}]}),'reject-response.json');
    },id);
    await page.click('#external-reject');
    await page.waitForFunction(()=>state.items[0].externalCorrections?.some(x=>x.decision==='rejected'),null,{timeout:5000});
    const after=await page.evaluate(()=>({finalText:state.items[0].finalText,decision:state.items[0].externalCorrections.at(-1).decision}));
    assert(after.finalText===before.final,'Rejecting an external proposal changed final text');
    assert(after.decision==='rejected','Rejected external proposal provenance was not recorded');
    await context.close();
    anthropicResponse=mathResponse;
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
