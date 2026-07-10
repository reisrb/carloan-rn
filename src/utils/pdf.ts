import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web: open the report in a new tab with a toolbar. "Imprimir / Salvar PDF"
 *   calls window.print(), which the browser turns into a clean vector PDF via
 *   "Save as PDF" (or the mobile share sheet). Inline handlers so it works
 *   without relying on injected scripts.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Permita pop-ups para exportar o PDF.');

    const toolbar = `
      <style>
        .__bar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;justify-content:center;
          padding:10px;background:#111;z-index:99999;}
        .__bar button{font:600 14px system-ui,sans-serif;border:0;border-radius:8px;padding:10px 18px;cursor:pointer;}
        .__bar .p{background:#60A5FA;color:#000;} .__bar .c{background:#333;color:#fff;}
        body{padding-top:58px;}
        @media print{.__bar{display:none!important;} body{padding-top:0;}}
      </style>
      <div class="__bar">
        <button class="p" type="button" onclick="window.focus();window.print();">Imprimir / Salvar PDF</button>
        <button class="c" type="button" onclick="window.close();">Fechar</button>
      </div>`;

    const doc = html.includes('</body>') ? html.replace('</body>', `${toolbar}</body>`) : `${html}${toolbar}`;
    w.document.open();
    w.document.write(doc);
    w.document.title = title;
    w.document.close();
    return;
  }

  const filePath = await Print.printToFileAsync({ html, base64: false });
  await Share.share({ url: filePath.uri, title });
}
