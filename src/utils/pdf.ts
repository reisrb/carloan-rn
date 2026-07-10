import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web (desktop AND mobile/PWA): open the report in a new tab with a toolbar
 *   (Print / Save PDF · Close). A script inside the tab wires the buttons and
 *   auto-opens the print dialog on load — printing from inside the tab is far
 *   more reliable than the opener calling print() cross-window.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Permita pop-ups para exportar o PDF.');

    const inject = `
      <style>
        .__pdfbar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;justify-content:center;
          padding:10px;background:#111;z-index:99999;}
        .__pdfbar button{font:600 14px system-ui,sans-serif;border:0;border-radius:8px;padding:10px 18px;cursor:pointer;}
        .__pdfbar .p{background:#60A5FA;color:#000;} .__pdfbar .c{background:#333;color:#fff;}
        body{padding-top:58px;}
        @media print{.__pdfbar{display:none!important;} body{padding-top:0;}}
      </style>
      <div class="__pdfbar">
        <button class="p" type="button" id="__print">Imprimir / Salvar PDF</button>
        <button class="c" type="button" id="__close">Fechar</button>
      </div>
      <script>
        (function(){
          var p=document.getElementById('__print'), c=document.getElementById('__close');
          if(p) p.addEventListener('click', function(){ window.focus(); window.print(); });
          if(c) c.addEventListener('click', function(){ window.close(); });
          window.addEventListener('load', function(){ setTimeout(function(){ try{ window.print(); }catch(e){} }, 400); });
        })();
      </script>`;

    const doc = html.includes('</body>') ? html.replace('</body>', `${inject}</body>`) : `${html}${inject}`;
    w.document.open();
    w.document.write(doc);
    w.document.title = title;
    w.document.close();
    return;
  }

  const filePath = await Print.printToFileAsync({ html, base64: false });
  await Share.share({ url: filePath.uri, title });
}
