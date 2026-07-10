import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web: print the HTML through a hidden iframe using the browser engine
 *   (vector, high quality). The print dialog's "Save as PDF" downloads it.
 *   The iframe cleans itself up, so no window is left open.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument ?? win?.document;
    if (!win || !doc) { iframe.remove(); throw new Error('Não foi possível gerar o PDF.'); }

    doc.open();
    doc.write(html);
    doc.title = title;
    doc.close();

    const cleanup = () => { try { iframe.remove(); } catch { /* already gone */ } };
    win.onafterprint = cleanup;
    setTimeout(() => {
      win.focus();
      win.print();
    }, 300);
    // Fallback cleanup if onafterprint never fires (some browsers).
    setTimeout(cleanup, 60000);
    return;
  }

  const filePath = await Print.printToFileAsync({ html, base64: false });
  await Share.share({ url: filePath.uri, title });
}
