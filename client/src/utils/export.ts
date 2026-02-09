import type { CartWithTimer } from '../types';

export function exportToCSV(carts: CartWithTimer[], filename: string = 'agula-export'): void {
  const headers = ['מספר עגלה', 'סוג', 'צוללנים', 'סטטוס', 'התחלה', 'הזדהות אחרונה', 'זמן נותר'];
  const rows = carts.map((cart) => [
    cart.cart_number,
    cart.cart_type,
    cart.diver_names.join(', '),
    cart.status,
    cart.started_at,
    cart.last_checkin || '',
    cart.seconds_remaining > 0
      ? `${Math.floor(cart.seconds_remaining / 60)}:${String(cart.seconds_remaining % 60).padStart(2, '0')}`
      : 'פג תוקף',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  // Add BOM for Hebrew support
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

export async function exportToExcel(carts: CartWithTimer[], filename: string = 'agula-export'): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('עגלות');

  sheet.columns = [
    { header: 'מספר עגלה', key: 'cart_number', width: 12 },
    { header: 'סוג', key: 'cart_type', width: 10 },
    { header: 'צוללנים', key: 'divers', width: 30 },
    { header: 'סטטוס', key: 'status', width: 12 },
    { header: 'התחלה', key: 'started_at', width: 20 },
    { header: 'הזדהות אחרונה', key: 'last_checkin', width: 20 },
    { header: 'סטטוס טיימר', key: 'timer_status', width: 12 },
  ];

  // Style header row
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ rightToLeft: true }];

  for (const cart of carts) {
    const row = sheet.addRow({
      cart_number: cart.cart_number,
      cart_type: cart.cart_type,
      divers: cart.diver_names.join(', '),
      status: cart.status === 'active' ? 'פעיל' : 'הושלם',
      started_at: cart.started_at,
      last_checkin: cart.last_checkin || '-',
      timer_status: cart.timer_status,
    });

    // Color-code by timer status
    const fill = {
      green: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF90EE90' } },
      orange: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFA500' } },
      expired: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFF6347' } },
      red: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFF0000' } },
      paused: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF87CEEB' } },
    };

    if (fill[cart.timer_status]) {
      row.eachCell((cell) => {
        cell.fill = fill[cart.timer_status];
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}.xlsx`);
}

export async function exportToPDF(carts: CartWithTimer[], filename: string = 'agula-export'): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.text('Agula Manager - Cart Report', 14, 15);
  doc.text(new Date().toLocaleString('he-IL'), 14, 22);

  autoTable(doc, {
    startY: 30,
    head: [['Cart #', 'Type', 'Divers', 'Status', 'Timer', 'Started']],
    body: carts.map((cart) => [
      cart.cart_number,
      cart.cart_type,
      cart.diver_names.join(', '),
      cart.status,
      cart.timer_status,
      cart.started_at,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [30, 58, 138] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
    bodyStyles: {},
    didParseCell: (data: any) => {
      if (data.column.index === 4) {
        const status = data.cell.raw;
        if (status === 'expired') {
          data.cell.styles.fillColor = [255, 99, 71];
          data.cell.styles.textColor = [255, 255, 255];
        } else if (status === 'orange') {
          data.cell.styles.fillColor = [255, 165, 0];
        }
      }
    },
  });

  doc.save(`${filename}.pdf`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
