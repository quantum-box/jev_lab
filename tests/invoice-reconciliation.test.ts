import assert from 'node:assert/strict';
import { test } from 'node:test';
import { invoiceSamples, reconcileInvoice, type InvoiceFixture } from '../lib/invoice-reconciliation';

test('pending approval is reported before generic missing-material handling', () => {
  assert.equal(reconcileInvoice(invoiceSamples[1]).outcome, 'approval-pending');
});

test('every invoice and purchase-order item participates in reconciliation', () => {
  const base = invoiceSamples[0];
  const fixture: InvoiceFixture = {
    ...base,
    id: 'INV-MULTI',
    invoice: { ...base.invoice, items: [...base.invoice.items, { sku: 'SKU-02', label: '追加保守', quantity: 1, unitPrice: 500, evidence: '品目欄 line 2' }] },
    purchaseOrder: { ...base.purchaseOrder, items: [...base.purchaseOrder.items, { sku: 'SKU-03', label: '別サービス', quantity: 1, unitPrice: 500, evidence: '発注欄 line 2' }] },
  };
  const items = reconcileInvoice(fixture).checks.find(check => check.key === 'items');
  assert.equal(items?.status, 'mismatch');
  assert.match(items?.evidence[0].text ?? '', /SKU-02/);
});
