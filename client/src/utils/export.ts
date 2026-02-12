import type { CartWithTimer, DiveReportDetail } from '../types';

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
    const fill: Record<string, { type: 'pattern'; pattern: 'solid'; fgColor: { argb: string } }> = {
      waiting: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD3D3D3' } },
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

// --- Dive Report Exports ---

const eventTypeLabel = (t: string) =>
  t === 'emergency' ? 'חירום' : t === 'overdue' ? 'חריגה' : 'אזהרה';

export function exportDiveToCSV(report: DiveReportDetail): void {
  const diveName = report.dive.name || 'צלילה';
  const lines: string[] = [];

  // Dive info
  lines.push('פרטי צלילה');
  lines.push(`שם,"${diveName}"`);
  lines.push(`מנהל,"${report.dive.manager_name}"`);
  lines.push(`סטטוס,${report.dive.status === 'active' ? 'פעילה' : 'הושלמה'}`);
  lines.push(`התחלה,${report.dive.started_at}`);
  lines.push(`סיום,${report.dive.ended_at || 'טרם הסתיימה'}`);
  if (report.summary.duration_minutes != null) {
    lines.push(`משך (דקות),${report.summary.duration_minutes}`);
  }
  lines.push('');

  // Carts
  lines.push('עגלות');
  lines.push('מספר עגלה,סוג,צוללנים,סטטוס,התחלה,סיום,הזדהויות,אירועים');
  for (const c of report.carts) {
    lines.push([
      c.cart_number,
      c.cart_type,
      `"${c.diver_names.join(', ')}"`,
      c.status === 'active' ? 'פעיל' : 'הושלם',
      c.started_at,
      c.ended_at || '',
      c.checkin_count,
      c.event_count,
    ].join(','));
  }
  lines.push('');

  // Events
  lines.push('אירועים');
  lines.push('סוג,סטטוס,עגלה,נפתח,נסגר');
  for (const e of report.events) {
    lines.push([
      eventTypeLabel(e.event_type),
      e.status === 'open' ? 'פתוח' : 'נסגר',
      e.cart_number,
      e.opened_at,
      e.resolved_at || '',
    ].join(','));
  }

  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `dive-report-${report.dive.id}.csv`);
}

export async function exportDiveToExcel(report: DiveReportDetail): Promise<void> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const diveName = report.dive.name || 'צלילה';

  // Summary sheet
  const summarySheet = workbook.addWorksheet('סיכום');
  summarySheet.views = [{ rightToLeft: true }];
  summarySheet.columns = [
    { header: 'שדה', key: 'field', width: 20 },
    { header: 'ערך', key: 'value', width: 30 },
  ];
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.addRow({ field: 'שם צלילה', value: diveName });
  summarySheet.addRow({ field: 'מנהל', value: report.dive.manager_name });
  summarySheet.addRow({ field: 'סטטוס', value: report.dive.status === 'active' ? 'פעילה' : 'הושלמה' });
  summarySheet.addRow({ field: 'התחלה', value: report.dive.started_at });
  summarySheet.addRow({ field: 'סיום', value: report.dive.ended_at || 'טרם הסתיימה' });
  summarySheet.addRow({ field: 'משך (דקות)', value: report.summary.duration_minutes ?? '-' });
  summarySheet.addRow({ field: 'עגלות', value: report.summary.cart_count });
  summarySheet.addRow({ field: 'הזדהויות', value: report.summary.checkin_count });
  summarySheet.addRow({ field: 'אירועים', value: report.summary.event_count });

  // Carts sheet
  const cartsSheet = workbook.addWorksheet('עגלות');
  cartsSheet.views = [{ rightToLeft: true }];
  cartsSheet.columns = [
    { header: 'מספר עגלה', key: 'cart_number', width: 12 },
    { header: 'סוג', key: 'cart_type', width: 8 },
    { header: 'צוללנים', key: 'divers', width: 30 },
    { header: 'סטטוס', key: 'status', width: 12 },
    { header: 'התחלה', key: 'started_at', width: 20 },
    { header: 'סיום', key: 'ended_at', width: 20 },
    { header: 'הזדהויות', key: 'checkin_count', width: 12 },
    { header: 'אירועים', key: 'event_count', width: 12 },
  ];
  cartsSheet.getRow(1).font = { bold: true };
  for (const c of report.carts) {
    cartsSheet.addRow({
      cart_number: c.cart_number,
      cart_type: c.cart_type,
      divers: c.diver_names.join(', '),
      status: c.status === 'active' ? 'פעיל' : 'הושלם',
      started_at: c.started_at,
      ended_at: c.ended_at || '-',
      checkin_count: c.checkin_count,
      event_count: c.event_count,
    });
  }

  // Events sheet
  const eventsSheet = workbook.addWorksheet('אירועים');
  eventsSheet.views = [{ rightToLeft: true }];
  eventsSheet.columns = [
    { header: 'סוג', key: 'event_type', width: 12 },
    { header: 'סטטוס', key: 'status', width: 12 },
    { header: 'עגלה', key: 'cart_number', width: 12 },
    { header: 'נפתח', key: 'opened_at', width: 20 },
    { header: 'נסגר', key: 'resolved_at', width: 20 },
  ];
  eventsSheet.getRow(1).font = { bold: true };
  for (const e of report.events) {
    eventsSheet.addRow({
      event_type: eventTypeLabel(e.event_type),
      status: e.status === 'open' ? 'פתוח' : 'נסגר',
      cart_number: e.cart_number,
      opened_at: e.opened_at,
      resolved_at: e.resolved_at || '-',
    });
  }

  // Timeline sheet
  const timelineSheet = workbook.addWorksheet('ציר זמן');
  timelineSheet.views = [{ rightToLeft: true }];
  timelineSheet.columns = [
    { header: 'זמן', key: 'timestamp', width: 20 },
    { header: 'סוג', key: 'type', width: 15 },
    { header: 'תיאור', key: 'description', width: 50 },
  ];
  timelineSheet.getRow(1).font = { bold: true };
  for (const t of report.timeline) {
    timelineSheet.addRow({
      timestamp: t.timestamp,
      type: t.type,
      description: t.description,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `dive-report-${report.dive.id}.xlsx`);
}

export async function exportDiveToPDF(report: DiveReportDetail): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;

  const doc = new jsPDF({ orientation: 'landscape' });
  const diveName = report.dive.name || 'Dive Report';

  doc.text(`${diveName} - Dive Report`, 14, 15);
  doc.text(`Manager: ${report.dive.manager_name}`, 14, 22);
  doc.text(`Status: ${report.dive.status === 'active' ? 'Active' : 'Completed'}`, 14, 29);
  doc.text(`Duration: ${report.summary.duration_minutes != null ? report.summary.duration_minutes + ' min' : 'Active'}`, 14, 36);
  doc.text(`Carts: ${report.summary.cart_count} | Check-ins: ${report.summary.checkin_count} | Events: ${report.summary.event_count}`, 14, 43);

  // Carts table
  autoTable(doc, {
    startY: 50,
    head: [['Cart #', 'Type', 'Divers', 'Status', 'Started', 'Ended', 'Check-ins', 'Events']],
    body: report.carts.map((c) => [
      c.cart_number,
      c.cart_type,
      c.diver_names.join(', '),
      c.status,
      c.started_at,
      c.ended_at || '-',
      c.checkin_count,
      c.event_count,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 138] },
    alternateRowStyles: { fillColor: [240, 240, 240] },
  });

  // Events table
  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  if (report.events.length > 0) {
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Type', 'Status', 'Cart #', 'Opened', 'Resolved']],
      body: report.events.map((e) => [
        eventTypeLabel(e.event_type),
        e.status === 'open' ? 'Open' : 'Resolved',
        e.cart_number,
        e.opened_at,
        e.resolved_at || '-',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [153, 27, 27] },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      didParseCell: (data: any) => {
        if (data.column.index === 0 && data.section === 'body') {
          const type = data.cell.raw;
          if (type === 'חירום') {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (type === 'חריגה') {
            data.cell.styles.textColor = [234, 88, 12];
          }
        }
      },
    });
  }

  doc.save(`dive-report-${report.dive.id}.pdf`);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
