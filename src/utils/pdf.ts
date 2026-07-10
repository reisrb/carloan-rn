import { Platform, Share } from 'react-native';
import * as Print from 'expo-print';

const fileName = (title: string) =>
  `${title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'export'}.pdf`;

/**
 * Export an HTML document as a PDF.
 * - Native: render to a file and open the share sheet.
 * - Web: generate a real PDF file (jsPDF, html2canvas at 2x so text is crisp),
 *   then share it via the Web Share API when available (works in iOS/Android
 *   PWAs where window.print() is unreliable), otherwise download it.
 */
export async function exportHtmlAsPdf(html: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'pt', 'a4');

    await new Promise<void>((resolve, reject) => {
      doc.html(html, {
        callback: () => resolve(),
        x: 0,
        y: 0,
        width: 547, // A4 (595pt) minus 24pt margins
        windowWidth: 794,
        margin: 24,
        autoPaging: 'text',
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
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
