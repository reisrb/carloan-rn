import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';
import { jsPDF } from 'jspdf';

const fileName = (title: string) =>
  `${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'export'}.pdf`;

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web: render a real PDF with jsPDF, then share it (Web Share API) when
 *   supported, otherwise download it. No lingering print window.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const doc = new jsPDF('p', 'pt', 'a4');
    await new Promise<void>((resolve, reject) => {
      doc.html(html, {
        callback: () => resolve(),
        x: 0,
        y: 0,
        width: 547, // A4 (595pt) minus 24pt margins each side
        windowWidth: 800,
        margin: 24,
        autoPaging: 'text',
      }).catch?.(reject);
    });

    const name = fileName(title);
    const blob = doc.output('blob');
    const file = new File([blob], name, { type: 'application/pdf' });

    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title });
      return;
    }

    const url = URL.createObjectURL(blob);
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
