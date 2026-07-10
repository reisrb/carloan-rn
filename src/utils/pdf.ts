import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web: expo-print's printAsync ignores the html and prints the current page,
 *   so open the html in a new window and print that (user saves as PDF).
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Popup bloqueado. Permita popups para exportar o PDF.');
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    const print = () => { try { w.print(); } catch { /* user closed the window */ } };
    // document.write may not fire onload reliably; try both.
    w.onload = print;
    setTimeout(print, 500);
    return;
  }
  const file = await Print.printToFileAsync({ html, base64: false });
  await Share.share({ url: file.uri, title });
}
