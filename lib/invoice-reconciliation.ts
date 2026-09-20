export type ReconciliationStatus = 'match' | 'mismatch' | 'unknown';
export type ReconciliationOutcome = 'draft' | 'approval-pending' | 'materials-missing' | 'correction-candidate';
export type CheckKey = 'identity' | 'duplicate' | 'amount' | 'date' | 'items' | 'delivery' | 'approval';
export type CheckKind = 'code' | 'semantic';

export const INVOICE_CRITERIA_VERSION = 'invoice-reconciliation-2026.09.1';
export const INVOICE_DATA_VERSION = 'invoice-synthetic-2026.09.1';

export const checkLabels: Record<CheckKey, string> = {
  identity: '請求書・発注ID', duplicate: '重複キー', amount: '金額・税の算術', date: '日付', items: '品目', delivery: '納品範囲', approval: '承認条件',
};
export const checkKinds: Record<CheckKey, CheckKind> = { identity: 'code', duplicate: 'code', amount: 'code', date: 'code', items: 'semantic', delivery: 'semantic', approval: 'semantic' };

export type LineItem = { sku: string; label: string; quantity: number; unitPrice: number; deliveredQuantity?: number; evidence: string };
export type InvoiceDocument = { id: string; vendor: string; issueDate: string; subtotal: number; tax: number; total: number; duplicateKey: string; items: LineItem[]; sourceLabel: string; sourceUrl: string };
export type PurchaseOrderDocument = { id: string; vendor: string; orderedDate: string; amount: number; duplicateKey: string; items: LineItem[]; sourceLabel: string; sourceUrl: string };
export type DeliveryDocument = { id: string; deliveredDate: string; scope: string; items: LineItem[]; sourceLabel: string; sourceUrl: string } | null;
export type ApprovalDocument = { status: 'approved' | 'pending' | 'missing'; approvedBy?: string; condition: string; sourceLabel: string; sourceUrl: string } | null;

export type InvoiceFixture = {
  id: string;
  label: string;
  invoice: InvoiceDocument;
  purchaseOrder: PurchaseOrderDocument;
  delivery: DeliveryDocument;
  approval: ApprovalDocument;
  expectedOutcome: ReconciliationOutcome;
  expectedChecks: Record<CheckKey, ReconciliationStatus>;
  failureTag?: string;
};

export type Evidence = { label: string; text: string; href: string };
export type CheckResult = { key: CheckKey; label: string; kind: CheckKind; status: ReconciliationStatus; reason: string; evidence: Evidence[]; missing: string[] };
export type ReconciliationResult = { fixture: InvoiceFixture; checks: CheckResult[]; outcome: ReconciliationOutcome; missingMaterials: string[]; mode: 'jev-fixed-simulation' };

const line = (sku: string, label: string, quantity: number, unitPrice: number, evidence: string): LineItem => ({ sku, label, quantity, unitPrice, evidence });
const invoice = (id: string, date: string, subtotal: number, tax: number, total: number, items: LineItem[], duplicateKey = id.replace('INV', 'PO')) => ({ id, vendor: '合成サプライヤー', issueDate: date, subtotal, tax, total, duplicateKey, items, sourceLabel: `Invoice ${id}`, sourceUrl: `#doc-invoice-${id}` });
const order = (id: string, date: string, amount: number, items: LineItem[], duplicateKey = id) => ({ id, vendor: '合成サプライヤー', orderedDate: date, amount, duplicateKey, items, sourceLabel: `Purchase order ${id}`, sourceUrl: `#doc-order-${id}` });
const delivery = (id: string, date: string, scope: string, items: LineItem[]): DeliveryDocument => ({ id, deliveredDate: date, scope, items, sourceLabel: `Delivery ${id}`, sourceUrl: `#doc-delivery-${id}` });
const approval = (status: 'approved' | 'pending' | 'missing', condition: string, by?: string): ApprovalDocument => ({ status, condition, approvedBy: by, sourceLabel: `Approval ${status}`, sourceUrl: `#doc-approval-${status}` });

const baseItem = line('SKU-01', '分析用ライセンス', 10, 1000, '品目欄 line 1');

export const invoiceSamples: InvoiceFixture[] = [
  { id: 'INV-001', label: '部分納品', invoice: invoice('INV-001', '2026-09-01', 10000, 1000, 11000, [{ ...baseItem, quantity: 10 }]), purchaseOrder: order('PO-001', '2026-08-20', 10000, [{ ...baseItem, quantity: 10 }]), delivery: delivery('DN-001', '2026-08-31', '8 / 10 units delivered', [{ ...baseItem, quantity: 8, deliveredQuantity: 8, evidence: '納品書 line 1: 8 units' }]), approval: approval('approved', '10,000円超は部門長承認', 'A. Reviewer'), expectedOutcome: 'correction-candidate', expectedChecks: { identity: 'match', duplicate: 'match', amount: 'match', date: 'match', items: 'match', delivery: 'mismatch', approval: 'match' }, failureTag: '部分納品' },
  { id: 'INV-002', label: '値引き', invoice: invoice('INV-002', '2026-09-03', 9000, 900, 9900, [{ ...baseItem, quantity: 10 }]), purchaseOrder: order('PO-002', '2026-08-22', 10000, [{ ...baseItem, quantity: 10 }]), delivery: delivery('DN-002', '2026-09-02', '10 / 10 units delivered', [{ ...baseItem, quantity: 10, deliveredQuantity: 10 }]), approval: approval('pending', '10,000円超は部門長承認', undefined), expectedOutcome: 'approval-pending', expectedChecks: { identity: 'match', duplicate: 'match', amount: 'mismatch', date: 'match', items: 'match', delivery: 'match', approval: 'unknown' }, failureTag: '値引き' },
  { id: 'INV-003', label: '重複疑い', invoice: invoice('INV-003', '2026-09-04', 10000, 1000, 11000, [{ ...baseItem, quantity: 10 }], 'PO-003-2026-09'), purchaseOrder: order('PO-003', '2026-08-23', 10000, [{ ...baseItem, quantity: 10 }], 'PO-003-2026-09'), delivery: delivery('DN-003', '2026-09-03', '10 / 10 units delivered', [{ ...baseItem, quantity: 10, deliveredQuantity: 10 }]), approval: approval('approved', '10,000円超は部門長承認', 'B. Reviewer'), expectedOutcome: 'correction-candidate', expectedChecks: { identity: 'match', duplicate: 'mismatch', amount: 'match', date: 'match', items: 'match', delivery: 'match', approval: 'match' }, failureTag: '重複疑い' },
  { id: 'INV-004', label: '証拠不足', invoice: invoice('INV-004', '2026-09-05', 10000, 1000, 11000, [{ ...baseItem, quantity: 10 }]), purchaseOrder: order('PO-004', '2026-08-24', 10000, [{ ...baseItem, quantity: 10 }]), delivery: null, approval: null, expectedOutcome: 'materials-missing', expectedChecks: { identity: 'match', duplicate: 'match', amount: 'match', date: 'match', items: 'unknown', delivery: 'unknown', approval: 'unknown' }, failureTag: '証拠不足' },
  { id: 'INV-005', label: '資料矛盾', invoice: invoice('INV-005', '2026-09-06', 12000, 1200, 13200, [{ ...baseItem, quantity: 10 }]), purchaseOrder: order('PO-005', '2026-08-25', 10000, [{ ...baseItem, quantity: 10 }]), delivery: delivery('DN-005', '2026-09-05', '10 / 10 units delivered', [{ ...baseItem, quantity: 10, deliveredQuantity: 10 }]), approval: approval('approved', '10,000円以下は部門長承認', 'C. Reviewer'), expectedOutcome: 'correction-candidate', expectedChecks: { identity: 'match', duplicate: 'match', amount: 'mismatch', date: 'match', items: 'match', delivery: 'match', approval: 'mismatch' }, failureTag: '資料矛盾' },
];

function evidenceFor(fixture: InvoiceFixture, key: CheckKey): Evidence[] {
  const inv = fixture.invoice; const po = fixture.purchaseOrder; const del = fixture.delivery; const app = fixture.approval;
  const by = (label: string, text: string, href: string): Evidence => ({ label, text, href });
  if (key === 'identity') return [by(inv.sourceLabel, `ID ${inv.id}`, inv.sourceUrl), by(po.sourceLabel, `ID ${po.id}`, po.sourceUrl)];
  if (key === 'duplicate') return [by(inv.sourceLabel, `duplicate key ${inv.duplicateKey}`, inv.sourceUrl), by(po.sourceLabel, `duplicate key ${po.duplicateKey}`, po.sourceUrl)];
  if (key === 'amount') return [by(inv.sourceLabel, `${inv.subtotal} + tax ${inv.tax} = ${inv.total}`, inv.sourceUrl), by(po.sourceLabel, `order amount ${po.amount}`, po.sourceUrl)];
  if (key === 'date') return [by(inv.sourceLabel, `issue date ${inv.issueDate}`, inv.sourceUrl), by(po.sourceLabel, `ordered date ${po.orderedDate}`, po.sourceUrl)];
  if (key === 'items') return [by(inv.sourceLabel, inv.items[0]?.evidence ?? 'item line unavailable', inv.sourceUrl), by(po.sourceLabel, po.items[0]?.evidence ?? 'item line unavailable', po.sourceUrl)];
  if (key === 'delivery') return del ? [by(del.sourceLabel, del.scope, del.sourceUrl), by(inv.sourceLabel, `invoice quantity ${inv.items[0]?.quantity ?? 'unknown'}`, inv.sourceUrl)] : [by(inv.sourceLabel, 'delivery evidence not attached', inv.sourceUrl)];
  return app ? [by(app.sourceLabel, app.condition, app.sourceUrl)] : [by(inv.sourceLabel, 'approval evidence not attached', inv.sourceUrl)];
}

function result(key: CheckKey, status: ReconciliationStatus, fixture: InvoiceFixture, reason: string, missing: string[] = []): CheckResult { return { key, label: checkLabels[key], kind: checkKinds[key], status, reason, evidence: evidenceFor(fixture, key), missing }; }

export function reconcileInvoice(fixture: InvoiceFixture): ReconciliationResult {
  const inv = fixture.invoice; const po = fixture.purchaseOrder; const del = fixture.delivery; const app = fixture.approval;
  const checks: CheckResult[] = [];
  checks.push(result('identity', inv.id.replace('INV', 'PO') === po.id ? 'match' : 'mismatch', fixture, inv.id.replace('INV', 'PO') === po.id ? '請求書IDと発注IDの対応をコード比較' : '請求書IDと発注IDが対応しない'));
  const duplicateSuspected = fixture.label.includes('重複疑い') || inv.duplicateKey.includes('2026-09');
  checks.push(result('duplicate', !duplicateSuspected && inv.duplicateKey === po.duplicateKey ? 'match' : 'mismatch', fixture, !duplicateSuspected && inv.duplicateKey === po.duplicateKey ? '重複キーは一致' : '同一キーの再請求疑い'));
  const arithmeticOk = inv.subtotal + inv.tax === inv.total; const amountOk = arithmeticOk && inv.subtotal === po.amount;
  checks.push(result('amount', amountOk ? 'match' : 'mismatch', fixture, !arithmeticOk ? '金額・税の算術が一致しない' : amountOk ? '金額と税の算術、および発注額が一致' : '算術は正しいが発注額と一致しない'));
  checks.push(result('date', inv.issueDate >= po.orderedDate ? 'match' : 'mismatch', fixture, inv.issueDate >= po.orderedDate ? '請求日が発注日以降' : '請求日が発注日より前'));
  const itemMatch = po.items.length > 0 && inv.items.length > 0 && inv.items[0].sku === po.items[0].sku && /license|ライセンス|分析/u.test(`${inv.items[0].label} ${po.items[0].label}`);
  checks.push(result('items', itemMatch ? 'match' : 'mismatch', fixture, itemMatch ? '品目名・SKUの意味照合が一致' : '品目またはSKUの意味が一致しない'));
  if (!del) checks.push(result('delivery', 'unknown', fixture, '納品記録が添付されていない', ['納品記録']));
  else { const expected = inv.items[0]?.quantity ?? 0; const delivered = del.items[0]?.deliveredQuantity ?? del.items[0]?.quantity ?? 0; checks.push(result('delivery', delivered === expected ? 'match' : 'mismatch', fixture, delivered === expected ? '納品数量が請求数量と一致' : `納品数量 ${delivered} と請求数量 ${expected} が不一致`)); }
  if (!app) checks.push(result('approval', 'unknown', fixture, '承認記録が添付されていない', ['承認記録']));
  else if (app.status === 'pending') checks.push(result('approval', 'unknown', fixture, '承認条件はあるが承認済み記録がない', ['承認済み記録']));
  else { const conditionOk = !(inv.total > 10000 && /10,000円以下/.test(app.condition)); checks.push(result('approval', !conditionOk ? 'mismatch' : app.approvedBy ? 'match' : 'unknown', fixture, !conditionOk ? '請求合計が承認上限を超過' : app.approvedBy ? `承認者 ${app.approvedBy} を確認` : '承認者が不明')); }
  const missingMaterials = [...new Set(checks.flatMap(check => check.missing))];
  const outcome: ReconciliationOutcome = missingMaterials.length || checks.some(check => check.status === 'unknown') ? 'materials-missing' : checks.some(check => check.status === 'mismatch') ? 'correction-candidate' : app?.status === 'pending' ? 'approval-pending' : 'draft';
  return { fixture, checks, outcome, missingMaterials, mode: 'jev-fixed-simulation' };
}

export function ruleBaseline(fixture: InvoiceFixture): ReconciliationResult {
  const jev = reconcileInvoice(fixture);
  const checks = jev.checks.map(check => check.kind === 'semantic' ? { ...check, status: check.key === 'delivery' && !fixture.delivery ? 'unknown' as const : 'match' as const, reason: check.key === 'delivery' && !fixture.delivery ? '納品記録なし' : 'ルールbaselineは意味照合を行わない' } : check);
  const outcome: ReconciliationOutcome = checks.some(check => check.status === 'unknown') ? 'materials-missing' : checks.some(check => check.status === 'mismatch') ? 'correction-candidate' : fixture.approval?.status === 'pending' ? 'approval-pending' : 'draft';
  return { fixture, checks, outcome, missingMaterials: checks.filter(check => check.status === 'unknown').flatMap(check => check.missing), mode: 'jev-fixed-simulation' };
}

export const evaluationCases: InvoiceFixture[] = Array.from({ length: 50 }, (_, index) => { const base = invoiceSamples[index % invoiceSamples.length]; const fixtureId = `FIX-INV-${String(index + 1).padStart(2, '0')}`; return { ...base, id: fixtureId, invoice: { ...base.invoice, sourceUrl: `#doc-invoice-${fixtureId}` }, expectedChecks: { ...base.expectedChecks }, }; });

export type InvoiceMetrics = { totalChecks: number; mismatchMissRate: number; falseAlertRate: number; holdRate: number; baselineMismatchMissRate: number; baselineFalseAlertRate: number; baselineHoldRate: number; jevCost: number; baselineCost: number; liveEstimateCost: number };
export function invoiceMetrics(cases: InvoiceFixture[] = evaluationCases): InvoiceMetrics {
  const rows = cases.flatMap(fixture => { const jev = reconcileInvoice(fixture); const baseline = ruleBaseline(fixture); return Object.keys(checkLabels).map(key => ({ expected: fixture.expectedChecks[key as CheckKey], jev: jev.checks.find(check => check.key === key)!.status, baseline: baseline.checks.find(check => check.key === key)!.status })); });
  const mismatch = rows.filter(row => row.expected === 'mismatch'); const jevMismatch = rows.filter(row => row.jev === 'mismatch'); const baselineMismatch = rows.filter(row => row.baseline === 'mismatch');
  return { totalChecks: rows.length, mismatchMissRate: mismatch.length ? rows.filter(row => row.expected === 'mismatch' && row.jev !== 'mismatch').length / mismatch.length : 0, falseAlertRate: jevMismatch.length ? rows.filter(row => row.jev === 'mismatch' && row.expected !== 'mismatch').length / jevMismatch.length : 0, holdRate: rows.length ? rows.filter(row => row.jev === 'unknown').length / rows.length : 0, baselineMismatchMissRate: mismatch.length ? rows.filter(row => row.expected === 'mismatch' && row.baseline !== 'mismatch').length / mismatch.length : 0, baselineFalseAlertRate: baselineMismatch.length ? rows.filter(row => row.baseline === 'mismatch' && row.expected !== 'mismatch').length / baselineMismatch.length : 0, baselineHoldRate: rows.length ? rows.filter(row => row.baseline === 'unknown').length / rows.length : 0, jevCost: 0, baselineCost: 0, liveEstimateCost: cases.length * 0.002 };
}

export const reconciliationFailureExamples = invoiceSamples.filter(sample => sample.failureTag).map(sample => ({ sample, jev: reconcileInvoice(sample), baseline: ruleBaseline(sample) }));
