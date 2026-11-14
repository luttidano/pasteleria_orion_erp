import type {
  PosPaymentMethod,
  PosSaleRecord,
  PosShiftRecord,
} from '../../types';
import {
  formatAmount,
  formatChileDate,
  formatChileDateTime,
  formatChileTime,
  formatMoney,
} from '../../utils/formatters';

export interface CartItem {
  cartKey: string;
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  unit: string;
  category: string;
  icon: string;
  isPackaging?: boolean;
}

export interface SaleTicket {
  id: string;
  ticketNumber: string;
  date: string;
  time: string;
  cashierName?: string;
  cashierRole?: string;
  itemsSummary: string;
  total: number;
  paymentMethod: string;
  status: 'completada' | 'anulada';
  accountingStatus?: 'posted' | 'pending';
}

export function buildCartKey(id: string, isPackaging = false): string {
  return `${isPackaging ? 'packaging' : 'product'}:${id}`;
}

export function resolveSecondaryPackagingPrice(
  name: string,
  salePrice?: number | null,
): number {
  if (typeof salePrice === 'number' && Number.isFinite(salePrice) && salePrice >= 0) {
    return Math.round(salePrice);
  }
  return name.toLowerCase().includes('bolsa') ? 100 : 0;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function paymentMethodLabel(method: PosPaymentMethod): string {
  switch (method) {
    case 'efectivo':
      return 'Efectivo';
    case 'debito':
      return 'Tarjeta Débito';
    case 'credito':
      return 'Tarjeta Crédito';
    case 'transferencia':
      return 'Transferencia';
  }
}

export function mapSaleToTicket(sale: PosSaleRecord): SaleTicket {
  return {
    id: sale.id,
    ticketNumber: sale.ticketNumber.startsWith('#')
      ? sale.ticketNumber
      : `#${sale.ticketNumber}`,
    date: formatChileDate(sale.soldAt),
    time: formatChileTime(sale.soldAt),
    cashierName: sale.cashierName || 'Caja Mostrador',
    cashierRole: sale.cashierRole,
    itemsSummary: sale.items
      .map((item) => `${item.quantity}x ${item.productName}`)
      .join(', '),
    total: Number(sale.total),
    paymentMethod: paymentMethodLabel(sale.paymentMethod),
    status: sale.status,
    accountingStatus: sale.accountingStatus,
  };
}

export function printShiftReceipt(shift: PosShiftRecord): boolean {
  const printWindow = window.open('', '_blank', 'width=440,height=760');
  if (!printWindow) {
    return false;
  }

  const diff = Number(shift.cashDifference ?? 0);
  const diffLabel =
    Math.abs(diff) < 0.01
      ? 'Cuadratura exacta ($0)'
      : diff > 0
        ? `Sobrante (+${formatMoney(diff)})`
        : `Faltante (${formatMoney(-Math.abs(diff))})`;

  const openedStr = formatChileDateTime(shift.openedAt);
  const closedStr = shift.closedAt ? formatChileDateTime(shift.closedAt) : 'En curso';
  const responsibleName = escapeHtml(
    shift.closedBy?.name || shift.openedBy?.name || 'Cajero Mostrador',
  );
  const safeNotes = shift.notes ? escapeHtml(shift.notes) : '';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Arqueo Turno #${shift.shiftNumber} - Pastelería Orion</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; padding: 20px; color: #1c1917; background: #fff; font-size: 12px; }
    .ticket { max-width: 340px; margin: 0 auto; border: 1px dashed #d6d3d1; padding: 16px; }
    .center { text-align: center; }
    h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 0.5px; }
    .sub { color: #57534e; font-size: 11px; margin-bottom: 12px; }
    .sep { border-top: 1px dashed #a8a29e; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; gap: 8px; }
    .bold { font-weight: 700; }
    .big { font-size: 14px; font-weight: 800; }
    .muted { color: #57534e; }
    .box { background: #fafaf9; border: 1px solid #e7e5e4; padding: 8px; margin-top: 8px; }
    @media print { body { padding: 0; } .ticket { border: none; } }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      <h1>PASTELERÍA ORION</h1>
      <div class="sub">Comprobante de Arqueo y Cierre de Caja</div>
    </div>
    <div class="sep"></div>
    <div class="row"><span>Turno N°:</span><span class="bold">#${shift.shiftNumber}</span></div>
    <div class="row"><span>Responsable:</span><span class="bold">${responsibleName}</span></div>
    <div class="row"><span>Apertura:</span><span>${escapeHtml(openedStr)}</span></div>
    <div class="row"><span>Cierre:</span><span>${escapeHtml(closedStr)}</span></div>
    <div class="row"><span>Transacciones:</span><span>${shift.transactionsCount}</span></div>
    <div class="sep"></div>
    <div class="bold">RESUMEN POR MEDIO DE PAGO</div>
    <div class="row"><span>Ventas Efectivo:</span><span>${formatMoney(shift.cashSalesTotal)}</span></div>
    <div class="row"><span>Tarjeta Débito:</span><span>${formatMoney(shift.debitTotal)}</span></div>
    <div class="row"><span>Tarjeta Crédito:</span><span>${formatMoney(shift.creditTotal)}</span></div>
    <div class="row"><span>Transferencias:</span><span>${formatMoney(shift.transferTotal)}</span></div>
    <div class="row bold"><span>Total Tarjetas POS:</span><span>${formatMoney(shift.cardPosTotal)}</span></div>
    <div class="row big"><span>TOTAL VENTAS TURNO:</span><span>${formatMoney(shift.totalSales)}</span></div>
    <div class="sep"></div>
    <div class="bold">CUADRATURA DE GAVETA (EFECTIVO)</div>
    <div class="row"><span>Fondo Inicial:</span><span>${formatMoney(shift.openingCash)}</span></div>
    <div class="row"><span>(+) Ventas Efectivo:</span><span>${formatMoney(shift.cashSalesTotal)}</span></div>
    <div class="row bold"><span>(=) Efectivo Esperado:</span><span>${formatMoney(shift.expectedCash)}</span></div>
    <div class="row bold"><span>Efectivo Contado:</span><span>${formatMoney(shift.countedCash ?? shift.expectedCash)}</span></div>
    <div class="row big"><span>Diferencia:</span><span>${escapeHtml(diffLabel)}</span></div>
    ${
      shift.closingEntryNumber
        ? `<div class="box"><div class="bold">Contabilidad:</div><div>Asiento de ajuste #${shift.closingEntryNumber} contabilizado automáticamente.</div></div>`
        : shift.accountingStatus === 'pending'
          ? `<div class="box"><div class="bold">Contabilidad:</div><div>Ajuste pendiente de contabilización (período bloqueado).</div></div>`
          : `<div class="box"><div class="bold">Contabilidad:</div><div>Caja cuadrada sin asiento de diferencia requerido.</div></div>`
    }
    ${safeNotes ? `<div class="box"><div class="bold">Observaciones:</div><div>${safeNotes}</div></div>` : ''}
    <div class="sep"></div>
    <div class="center muted" style="margin-top: 24px;">______________________________<br/>Firma Cajero / Administrador</div>
  </div>
  <script>
    window.addEventListener('load', () => { window.print(); });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
}

export { formatAmount };

