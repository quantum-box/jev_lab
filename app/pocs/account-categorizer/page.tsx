'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { accounts, ACCOUNT_RULES_VERSION, categorizeTransaction, compareCategorization, replayCorrections, syntheticTransactions, type CompanyProfile, type Correction } from '../../../lib/account-categorizer';

export default function AccountCategorizerPage() {
  const [company, setCompany] = useState<CompanyProfile>('standard');
  const [rows, setRows] = useState(syntheticTransactions);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [replayed, setReplayed] = useState(false);
  const results = useMemo(() => rows.map(row => categorizeTransaction(row, company, 'replay')), [rows, company]);
  const corrected = useMemo(() => replayed ? replayCorrections(results, corrections) : results, [results, corrections, replayed]);
  function correct(id: string, accountId: string) {
    const row = results.find(item => item.transactionId === id);
    if (!row || !accounts.some(account => account.id === accountId)) return;
    setCorrections(current => [...current.filter(item => item.transactionId !== id), { transactionId: id, from: row.accountId, to: accountId, reason: '担当者の確認', at: new Date().toISOString() }]);
    setReplayed(false);
  }
  return <div className="account-page">
    <div className="detail-head"><Link className="back" href="/">← Back to gallery</Link><div className="eyebrow">業務 · Classify · replay-only</div><h1>摘要から、勘定科目の候補を並べる。</h1><p>合成した取引を会社ルールに照らし、候補・確認要否・一致しない入力を同じ表で追跡します。会計・税務上の判断や記帳を行うものではありません。</p></div>
    <div className="account-toolbar panel"><label>Company rule<select aria-label="Company rule" value={company} onChange={event => { setCompany(event.target.value as CompanyProfile); setReplayed(false); }}><option value="standard">Standard company</option><option value="studio">Studio company</option></select></label><span className="badge">source rules · {ACCOUNT_RULES_VERSION}</span><Link className="secondary" href="/pocs/accounting-category/eval">Run 50-case evaluation</Link><span className="muted">Synthetic data only · no external API · no secrets</span></div>
    <div className="account-layout"><section className="panel"><div className="section-title"><h2>Transaction categorization</h2><span className="count">{corrected.length} examples</span></div><div className="account-table" role="table"><div className="account-row account-head" role="row"><span>ID / description</span><span>Candidate account</span><span>Status</span><span>Rule</span></div>{corrected.map(row => <div className="account-row" role="row" key={row.transactionId}><div><strong>{row.transactionId}</strong><small>{rows.find(item => item.id === row.transactionId)?.description}</small></div><div><strong>{row.accountId ? `${row.accountId} ${row.accountName}` : '—'}</strong><small>{row.candidates.map(candidate => `${candidate.id} ${candidate.name}`).join(' · ') || '候補なし'}</small>{row.status !== 'unmatched' && <select aria-label={`${row.transactionId} correction`} value={row.accountId} onChange={event => correct(row.transactionId, event.target.value)}><option value={row.accountId}>訂正候補を選択</option>{accounts.map(account => <option key={account.id} value={account.id}>{account.id} {account.name}</option>)}</select>}</div><span className={`status status-${row.status}`}>{row.status === 'matched' ? 'matched' : row.status === 'needs-review' ? 'needs review' : 'unmatched'}</span><small>{row.sourceRule}<br />{row.reason}</small></div>)}</div><div className="actions"><button className="primary" onClick={() => setRows([...syntheticTransactions])}>Reset examples</button><button className="secondary" onClick={() => setReplayed(true)} disabled={!corrections.length}>Replay corrections ({corrections.length})</button></div></section>
      <aside className="account-side"><section className="panel"><h2>Baseline vs Jev / replay</h2>{rows.slice(0, 3).map(row => { const comparison = compareCategorization(row, company); return <div className="comparison" key={row.id}><strong>{row.id}</strong><div><span>baseline</span><b>{comparison.baseline.accountId ?? comparison.baseline.status}</b></div><div><span>replay</span><b>{comparison.replay.accountId ?? comparison.replay.status}</b></div><div><span>Jev (deterministic)</span><b>{comparison.jev.accountId ?? comparison.jev.status}</b></div><small>{comparison.consistent ? 'same result · traceable' : 'review difference'}</small></div>})}</section><section className="panel"><h2>Correction trace</h2>{corrections.length === 0 ? <p className="muted">候補を選ぶと、訂正内容をここに記録します。</p> : <div className="trace-list">{corrections.map(item => <div key={item.transactionId}><strong>{item.transactionId}</strong><span>{item.from ?? '—'} → {item.to}</span><small>{item.reason}</small></div>)}</div>}<div className="notice">訂正はこの画面内の合成データにだけ適用されます。外部システムへの書き込みはありません。</div></section></aside>
    </div>
  </div>;
}
