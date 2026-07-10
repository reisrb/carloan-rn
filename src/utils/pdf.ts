import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

const fileName = (title: string) =>
  `${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'export'}.pdf`;

// Render the HTML into a real PDF blob (jsPDF + html2canvas at 2x for crisp text).
async function htmlToPdfBlob(html: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'pt', 'a4');
  await new Promise<void>((resolve, reject) => {
    doc.html(html, {
      callback: () => resolve(),
      x: 0, y: 0,
      width: 547, // A4 (595pt) minus 24pt margins
      windowWidth: 794,
      margin: 24,
      autoPaging: 'text',
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
    }).catch?.(reject);
  });
  return doc.output('blob');
}

const TOOLBAR = `
  <style>
    .__bar{position:fixed;top:0;left:0;right:0;display:flex;gap:8px;justify-content:center;
      padding:10px;background:#111;z-index:99999;}
    .__bar a,.__bar button{font:600 14px system-ui,sans-serif;border:0;border-radius:8px;
      padding:10px 18px;cursor:pointer;text-decoration:none;}
    .__bar .p{background:#60A5FA;color:#000;} .__bar .p[aria-disabled="true"]{opacity:.5;pointer-events:none;}
    .__bar .c{background:#333;color:#fff;}
    body{padding-top:58px;}
    @media print{.__bar{display:none!important;} body{padding-top:0;}}
  </style>
  <div class="__bar">
    <a class="p" id="__dl" aria-disabled="true">Gerando PDF…</a>
    <button class="c" type="button" onclick="window.close()">Fechar</button>
  </div>`;

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web: open the report in a new tab (with a Close button). The "Salvar PDF"
 *   button converts the shown HTML into a real PDF (generated in the opener,
 *   which has jsPDF) and downloads it — works even in PWAs where window.print
 *   is a no-op. Falls back to a direct download if pop-ups are blocked.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const name = fileName(title);
    const w = window.open('', '_blank');

    if (w) {
      const doc = html.includes('</body>') ? html.replace('</body>', `${TOOLBAR}</body>`) : `${html}${TOOLBAR}`;
      w.document.open();
      w.document.write(doc);
      w.document.title = title;
      w.document.close();
    }

    const blob = await htmlToPdfBlob(html);
    const url = URL.createObjectURL(blob);

    if (w && !w.closed) {
      const dl = w.document.getElementById('__dl') as HTMLAnchorElement | null;
      if (dl) {
        dl.href = url;
        dl.download = name;
        dl.setAttribute('aria-disabled', 'false');
        dl.textContent = 'Salvar PDF';
        return;
      }
    }

    // Pop-up blocked (or tab closed) → download directly.
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }

  const filePath = await Print.printToFileAsync({ html, base64: false });
  await Share.share({ url: filePath.uri, title });
}
