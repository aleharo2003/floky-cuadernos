// Exporta los bloques Mermaid marcados con <!-- diagram: ID --> a fuentes/*.mmd, svg/*.svg, png/*.png,
// manifest.json y galeria.html.
// Variables opcionales:
//   DIAGRAMAS_PLAYWRIGHT_MODULE  módulo a usar en lugar de "playwright" (por ejemplo "playwright-core")
//   DIAGRAMAS_NODE_MODULES       carpeta node_modules alternativa
//   DIAGRAMAS_CHROMIUM_PATH      ejecutable de Chromium ya instalado
//   DIAGRAMAS_BROWSER_CHANNEL    canal del navegador (por ejemplo "chrome")
//   DIAGRAMAS_MERMAID_JS         ruta a mermaid.min.js
const fs = require('node:fs');
const path = require('node:path');
const moduleName = process.env.DIAGRAMAS_PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = require(process.env.DIAGRAMAS_NODE_MODULES ? path.join(process.env.DIAGRAMAS_NODE_MODULES, moduleName) : moduleName);

const TITULO = 'Diagramas del sistema';
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const library = process.env.DIAGRAMAS_MERMAID_JS || path.join(path.dirname(require.resolve('mermaid')), 'mermaid.min.js');
const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const diagrams = [];
for (const name of fs.readdirSync(root).filter(n => /^\d\d-.*\.md$/.test(n)).sort()) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  const marker = /<!-- diagram:\s*([A-Z]+-\d+)\s*-->\s*```mermaid\r?\n([\s\S]*?)```/g;
  const matches = [...source.matchAll(marker)];
  const fenceCount = (source.match(/```mermaid/g) || []).length;
  if (matches.length !== fenceCount) throw new Error(`Unmarked diagram in ${name}`);
  matches.forEach((m, i) => {
    const previous = source.slice(0, m.index);
    const heading = [...previous.matchAll(/^## (.+)$/gm)].pop()?.[1] || m[1];
    const nextHeading = source.indexOf('\n## ', m.index);
    const section = source.slice(previous.lastIndexOf('\n## '), nextHeading === -1 ? source.length : nextHeading);
    diagrams.push({id:m[1], title:heading, document:name, anchor:m[1].toLowerCase(), code:m[2].trim(), stories:[...new Set(section.match(/HU-\d{3}/g) || [])]});
  });
}
if (new Set(diagrams.map(d => d.id)).size !== diagrams.length) throw new Error('Duplicate diagram IDs');
for (const dir of ['fuentes','svg','png']) fs.mkdirSync(path.join(root, dir), {recursive:true});

(async () => {
  const browser = await chromium.launch({
    channel: process.env.DIAGRAMAS_BROWSER_CHANNEL || undefined,
    executablePath: process.env.DIAGRAMAS_CHROMIUM_PATH || undefined,
    headless: true,
  });
  const page = await browser.newPage({viewport:{width:1800,height:1200}, deviceScaleFactor:1.5});
  await page.setContent('<!doctype html><html lang="es"><meta charset="utf-8"><style>body{margin:0;padding:24px;background:white;font-family:Arial,sans-serif}#holder{display:inline-block;background:white;padding:12px}svg{display:block}</style><body><div id="holder"></div></body></html>');
  await page.addScriptTag({path:library});
  await page.evaluate(() => mermaid.initialize({
    startOnLoad:false, securityLevel:'strict', theme:'base', deterministicIds:true,
    fontFamily:'Arial, sans-serif', fontSize:16,
    themeCSS:'.edgeLabel rect.background { fill:#ffffff!important; opacity:1!important; } .edgeLabel text { fill:#172b44!important; }',
    themeVariables:{primaryColor:'#eaf2fa',primaryTextColor:'#172b44',primaryBorderColor:'#637f9d',lineColor:'#607389',secondaryColor:'#edf4ef',tertiaryColor:'#f5f7fa',background:'#ffffff',fontFamily:'Arial, sans-serif',fontSize:'16px'},
    flowchart:{useMaxWidth:false,htmlLabels:false,curve:'linear',nodeSpacing:30,rankSpacing:45,padding:14},
    sequence:{useMaxWidth:false,actorFontSize:15,messageFontSize:15,noteFontSize:14,wrap:true,actorMargin:45},
    class:{useMaxWidth:false}, er:{useMaxWidth:false}, state:{useMaxWidth:false}
  }));
  const failures = [];
  for (const d of diagrams) {
    fs.writeFileSync(path.join(root,'fuentes',`${d.id}.mmd`), `${d.code}\n`);
    try {
      const result = await page.evaluate(async ({id, code, title}) => {
        const holder = document.getElementById('holder');
        holder.innerHTML = '';
        await mermaid.parse(code);
        const {svg} = await mermaid.render(`diagram_${id.replaceAll('-','_')}`, code);
        holder.innerHTML = svg;
        const element = holder.querySelector('svg');
        const v = element.viewBox.baseVal;
        const width = Math.ceil(v.width || element.getBoundingClientRect().width);
        const height = Math.ceil(v.height || element.getBoundingClientRect().height);
        element.setAttribute('width',String(width));
        element.setAttribute('height',String(height));
        element.style.maxWidth = 'none';
        element.setAttribute('role','img');
        element.setAttribute('aria-label', title);
        const t = document.createElementNS('http://www.w3.org/2000/svg','title');
        t.textContent = title;
        element.prepend(t);
        return {svg:new XMLSerializer().serializeToString(element),width,height};
      }, d);
      fs.writeFileSync(path.join(root,'svg',`${d.id}.svg`), result.svg);
      await page.setViewportSize({width:Math.min(6000,result.width+80),height:Math.min(2400,result.height+80)});
      await page.locator('#holder').screenshot({path:path.join(root,'png',`${d.id}.png`),timeout:30000});
      d.width=result.width; d.height=result.height;
      console.log(`${d.id} OK ${d.width}x${d.height}`);
    } catch (error) {
      failures.push({id:d.id,error:String(error.message || error)});
      console.log(`${d.id} ERROR ${String(error.message || error).slice(0,500)}`);
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({generatedAt:new Date().toISOString(),renderer:'Mermaid 11.12.0',diagrams:diagrams.map(({code,...m})=>m),failures},null,2));
  if (failures.length) process.exitCode=1;
  else {
    const toc=diagrams.map(d=>`<a href="#${d.id}">${escapeHtml(d.id)} · ${escapeHtml(d.title.replace(/^[A-Z]+-\d+[.:]\s*/,''))}</a>`).join('\n');
    const cards=diagrams.map(d=>`<section id="${d.id}"><header><p>${escapeHtml(d.document)} · diseño objetivo o propuesta, sin implementación comprobada${d.stories.length?` · ${escapeHtml(d.stories.join(', '))}`:''}</p><h2>${escapeHtml(d.title)}</h2><nav><a href="${d.document}#${d.anchor}">Explicación y escenarios</a><a href="png/${d.id}.png">PNG</a><a href="svg/${d.id}.svg">SVG</a><a href="fuentes/${d.id}.mmd">Fuente Mermaid</a></nav></header><div class="drawing"><img src="svg/${d.id}.svg" alt="${escapeHtml(d.title)}" loading="lazy"></div><details><summary>Ver Mermaid editable</summary><pre><code>${escapeHtml(d.code)}</code></pre></details><a class="back" href="#inicio">Volver al índice</a></section>`).join('\n');
    fs.writeFileSync(path.join(root,'galeria.html'),`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(TITULO)}</title><style>html{scroll-behavior:smooth}body{margin:0;background:#f3f5f8;color:#1d2d40;font:16px/1.55 Arial,sans-serif}main{max-width:1280px;margin:auto;padding:32px 24px}h1,h2{line-height:1.2}h1{font-size:32px}h2{font-size:24px}a{color:#15599b}p{max-width:85ch}#indice{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:8px 24px;margin:24px 0 48px}#indice a{padding:8px;background:#fff;text-decoration:none;border-radius:6px}section{background:#fff;border-radius:10px;margin:0 0 32px;overflow:hidden;scroll-margin-top:16px}header{padding:20px 24px;background:#eaf0f7}header p{font-size:13px;margin:0}header nav{display:flex;gap:16px;flex-wrap:wrap}.drawing{padding:24px;overflow:auto}.drawing img{display:block;max-width:100%;height:auto;margin:auto}details{padding:12px 24px}pre{overflow:auto;font-size:13px}summary{cursor:pointer}.back{display:inline-block;margin:8px 24px 24px}a:focus-visible,summary:focus-visible{outline:3px solid #d18a11;outline-offset:3px}@media(max-width:600px){main{padding:20px 12px}h1{font-size:27px}.drawing{padding:12px}header{padding:16px}}</style></head><body><main id="inicio"><h1>${escapeHtml(TITULO)}</h1><p>${diagrams.length} diagramas con explicaciones, fuentes editables e imágenes para adjuntar a stories. Arquitectura objetivo y modelos propuestos; todavía no representan código implementado. Los pendientes y escenarios están en los documentos enlazados.</p><p><a href="README.md">Índice y mapa de stories</a> · <a href="guia-para-aprender-y-ensenar.md">Guía didáctica</a> · <a href="../backlog/01-epicas-y-stories.md">Backlog</a> · <a href="../adr/">Decisiones (ADR)</a></p><nav id="indice" aria-label="Diagramas">${toc}</nav>${cards}</main></body></html>`);
    console.log(`Rendered ${diagrams.length} diagrams; generated offline gallery.`);
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
