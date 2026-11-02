// Arma un PDF por guía (dueño, carga, consulta) desde los .md de la carpeta de arriba.
// Uso: npm run pdf   (ver README.md). Los PDF quedan en ../pdf y no se versionan.
const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');
const moduloPlaywright = process.env.GUIAS_NODE_MODULES ? path.join(process.env.GUIAS_NODE_MODULES, 'playwright') : 'playwright';
const { chromium } = require(moduloPlaywright);

const GUIAS = path.join(__dirname, '..');
const SALIDA = path.join(GUIAS, 'pdf');
const ARCHIVOS = { dueno: 'guia-dueno.pdf', carga: 'guia-carga.pdf', consulta: 'guia-consulta.pdf' };

// En el PDF los enlaces entre guías no sirven: se dejan como texto.
const sinEnlacesInternos = (md) => md.replace(/\[([^\]]+)\]\((dueno|carga|consulta)\.md\)/g, '$1');

const estilo = `
  @page { size: A4; margin: 16mm 16mm 18mm; }
  body { font-family: 'Archivo', 'Helvetica Neue', Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #14242b; }
  h1 { font-size: 19pt; margin: 0 0 4pt; color: #134a5c; }
  h1 + p { color: #46606a; margin-top: 0; }
  h2 { font-size: 13pt; margin: 14pt 0 4pt; color: #134a5c; break-after: avoid; }
  p, li { margin: 3pt 0; }
  img { max-width: 100%; border: 1px solid #d5dee1; border-radius: 6px; margin: 4pt 0; break-inside: avoid; }
  img[align=right] { float: right; margin: 0 0 6pt 12pt; }
  /* Capturas de celular: angostas, al costado del texto. */
  img[width="230"] { width: 46mm; height: auto; }
  img[width="260"] { width: 58mm; height: auto; }
  img[width="300"] { width: 72mm; height: auto; }
  img[width="460"] { width: 105mm; height: auto; }
  table { border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
  th, td { border-bottom: 1px solid #d5dee1; padding: 3pt 8pt; text-align: left; }
  th { color: #46606a; }
  code { font-family: inherit; background: #eef3f4; padding: 0 3pt; border-radius: 3px; }
  br[clear] { clear: both; display: block; content: ''; }
`;

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const hoy = new Date().toLocaleDateString('es-AR');
  for (const [guia, archivo] of Object.entries(ARCHIVOS)) {
    const md = sinEnlacesInternos(fs.readFileSync(path.join(GUIAS, `${guia}.md`), 'utf8'));
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${estilo}</style></head><body>${marked.parse(md)}</body></html>`;
    // Se abre desde un archivo al lado de los .md: así las imágenes (img/...) cargan con su ruta relativa.
    const temporal = path.join(GUIAS, `.${guia}.tmp.html`);
    fs.writeFileSync(temporal, html);
    try {
      await page.goto(`file://${temporal}`, { waitUntil: 'load' });
      const rotas = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
      if (rotas.length) throw new Error(`Imágenes que no cargaron en ${guia}: ${rotas.join(', ')}`);
    } finally {
      fs.rmSync(temporal, { force: true });
    }
    await page.pdf({
      path: path.join(SALIDA, archivo),
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-size:8pt;color:#6b8088;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Cuadernos · actualizada el ${hoy}</span><span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
    });
    console.log('Listo:', archivo);
  }
  await browser.close();
})();
