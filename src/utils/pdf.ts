import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web (desktop AND mobile/PWA): open the report in a new tab with a small
 *   toolbar (Print / Save PDF · Close) that is hidden when printing. Desktop
 *   also auto-opens the print dialog. Hidden-iframe printing was unreliable on
 *   mobile PWAs, so this works on both.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Permita pop-ups para exportar o PDF.');

    const toolbar = `
      <style>
        .__pdfbar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;justify-content:center;
          padding:10px;background:#111;z-index:99999;}
        .__pdfbar button{font:600 14px system-ui,sans-serif;border:0;border-radius:8px;padding:9px 16px;cursor:pointer;}
        .__pdfbar .p{background:#60A5FA;color:#000;} .__pdfbar .c{background:#333;color:#fff;}
        body{padding-top:56px;}
        @media print{.__pdfbar{display:none!important;} body{padding-top:0;}}
      </style>
      <div class="__pdfbar">
        <button class="p" onclick="window.print()">Imprimir / Salvar PDF</button>
        <button class="c" onclick="window.close()">Fechar</button>
      </div>`;

    w.document.open();
    w.document.write(html.replace('</body>', `${toolbar}</body>`));
    w.document.title = title;
    w.document.close();

    // Auto-open the print dialog on desktop; on mobile the toolbar button covers it.
    setTimeout(() => { try { w.print(); } catch { /* user can use the toolbar */ } }, 500);
    return;
  }

  const filePath = await Print.printToFileAsync({ html, base64: false });
  await Share.share({ url: filePath.uri, title });
}
