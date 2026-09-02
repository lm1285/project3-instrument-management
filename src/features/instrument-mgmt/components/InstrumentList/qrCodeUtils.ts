import type { Instrument } from '../../types';

export function buildInstrumentQrContent(instrument: Instrument) {
  return `仪器名称: ${instrument.name || ''}\n型号: ${instrument.model || ''}\n出厂编号: ${instrument.serialNumber || ''}\n管理编号: ${instrument.managementNumber || ''}`;
}

export function downloadCanvasQr(canvasId: string, fileName: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;

  const url = canvas.toDataURL('image/png');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function printCanvasQr(canvasId: string, title: string) {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
  if (!canvas) return;

  const url = canvas.toDataURL('image/png');
  const win = window.open('', '', 'width=800,height=800');
  if (!win) return;

  win.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              overflow: hidden;
            }
            img {
              width: 80vmin;
              height: 80vmin;
              object-fit: contain;
            }
            @media print {
              body {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
              }
              img {
                width: 80%;
                height: auto;
                max-height: 80vh;
              }
            }
          </style>
        </head>
        <body>
          <img src="${url}" />
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              }
            }
          </script>
        </body>
      </html>
    `);
  win.document.close();
}
