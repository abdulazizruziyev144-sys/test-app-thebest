import { formatMoney, formatScheduledTime, ORDER_STATUS_LABELS, normalizeLiveStatus } from './calculations';
import type { Order, PaymentMethod } from '../types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash on delivery / pickup',
  terminal: 'Uzcard / Humo Terminal',
  click: 'Click',
  payme: 'Payme',
};

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildTicketHtml(order: Order, variant: 'kitchen' | 'customer'): string {
  const paymentLabel = order.paymentMethod
    ? PAYMENT_METHOD_LABELS[order.paymentMethod]
    : PAYMENT_METHOD_LABELS.cash;
  const statusLabel = ORDER_STATUS_LABELS[normalizeLiveStatus(order.status)] || order.status;
  const createdStr = new Date(order.createdAt).toLocaleString();

  const itemsHtml = order.items
    .map((it) => {
      const mods: string[] = [];
      if (it.options?.cheese) mods.push('+Cheese');
      if (it.options?.meat) mods.push('+Meat');
      if (it.options?.spice) mods.push(it.options.spice);
      if (it.options?.sauce) mods.push(`${it.options.sauce} sauce`);
      return `
        <tr>
          <td style="padding:4px 0;vertical-align:top;font-weight:700;">${it.qty}x</td>
          <td style="padding:4px 6px;vertical-align:top;">
            <div style="font-weight:700;">${escapeHtml(it.name)}</div>
            ${mods.length > 0 ? `<div style="font-size:11px;color:#444;">${escapeHtml(mods.join(' · '))}</div>` : ''}
          </td>
          <td style="padding:4px 0;vertical-align:top;text-align:right;white-space:nowrap;">${escapeHtml(formatMoney(it.unit * it.qty))}</td>
        </tr>
      `;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>THE BEST — ${variant === 'kitchen' ? 'Kitchen Ticket' : 'Receipt'} #${escapeHtml(order.id.slice(0, 10))}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    body {
      font-family: 'Courier New', Courier, monospace;
      color: #0B0F08;
      max-width: 300px;
      margin: 0 auto;
      padding: 10px;
      font-size: 12px;
      line-height: 1.4;
    }
    .center { text-align: center; }
    .divider { border-top: 1px dashed #111; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .big { font-size: 15px; font-weight: 800; }
    .badge { display: inline-block; border: 1px solid #111; padding: 2px 6px; font-weight: 700; text-transform: uppercase; font-size: 11px; }
  </style>
</head>
<body>
  <div class="center">
    <div class="big">THE BEST FAST FOOD</div>
    <div>Bukhara · Uzbekistan · 1087</div>
    <div style="margin-top:4px;"><span class="badge">${variant === 'kitchen' ? 'KITCHEN TICKET' : 'CUSTOMER RECEIPT'}</span></div>
  </div>

  <div class="divider"></div>
  <div><strong>Order:</strong> #${escapeHtml(order.id)}</div>
  <div><strong>Time:</strong> ${escapeHtml(createdStr)}</div>
  <div><strong>Mode:</strong> ${escapeHtml(order.mode.toUpperCase())}${order.customer?.table && order.customer.table !== 'Any' ? ` (${escapeHtml(order.customer.table)})` : ''}</div>
  <div><strong>Status:</strong> ${escapeHtml(statusLabel)}</div>
  <div><strong>Payment:</strong> ${escapeHtml(paymentLabel)}</div>
  ${order.scheduledDeliveryTime ? `<div><strong>Scheduled:</strong> ${escapeHtml(formatScheduledTime(order.scheduledDeliveryTime))}</div>` : ''}

  <div class="divider"></div>
  <div><strong>Customer:</strong> ${escapeHtml(order.customer?.name || 'Guest')}</div>
  <div><strong>Phone:</strong> ${escapeHtml(order.customer?.phone || '')}</div>
  ${order.customer?.address ? `<div><strong>Address:</strong> ${escapeHtml(order.customer.address)}</div>` : ''}
  ${order.deliveryCoords?.distanceKm ? `<div><strong>Distance:</strong> ${order.deliveryCoords.distanceKm} km (~${order.deliveryCoords.etaMinutes || 25} min)</div>` : ''}

  <div class="divider"></div>
  <table>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="divider"></div>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right;">${escapeHtml(formatMoney(order.totals.subtotal))}</td></tr>
    ${order.totals.discount > 0 ? `<tr><td>Discount</td><td style="text-align:right;">-${escapeHtml(formatMoney(order.totals.discount))}</td></tr>` : ''}
    <tr><td>Delivery</td><td style="text-align:right;">${order.totals.delivery === 0 ? 'Free' : escapeHtml(formatMoney(order.totals.delivery))}</td></tr>
    <tr class="big"><td style="padding-top:6px;">TOTAL</td><td style="padding-top:6px;text-align:right;">${escapeHtml(formatMoney(order.totals.total))}</td></tr>
  </table>

  ${
    order.deliveryInstructions || order.dietaryNotes || order.customer?.note
      ? `<div class="divider"></div>
         <div><strong>Notes:</strong> ${escapeHtml(
           [order.deliveryInstructions, order.dietaryNotes, !order.deliveryInstructions && !order.dietaryNotes ? order.customer?.note : '']
             .filter(Boolean)
             .join(' | ')
         )}</div>`
      : ''
  }
  ${order.kitchenNote ? `<div class="divider"></div><div><strong>Kitchen Update:</strong> ${escapeHtml(order.kitchenNote)}</div>` : ''}

  <div class="divider"></div>
  <div class="center" style="font-size:11px;">
    Thank you for ordering from THE BEST!<br/>
    +998 (65) 222-89-89 · Bukhara
  </div>
</body>
</html>`;
}

export function printOrderTicket(order: Order, variant: 'kitchen' | 'customer' = 'kitchen'): void {
  const html = buildTicketHtml(order, variant);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1500);
    }
  }, 150);
}

export function downloadOrderReceipt(order: Order): void {
  const html = buildTicketHtml(order, 'customer');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `the-best-receipt-${order.id.slice(0, 10)}.html`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
