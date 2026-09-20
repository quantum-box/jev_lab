import Link from 'next/link';
import {LIVING_EVALUATION_CASES, evaluateLivingCase} from '../../../../lib/living-ui';

export default function LivingUiEvaluationPage() {
  const results = LIVING_EVALUATION_CASES.map((testCase) => ({testCase, result: evaluateLivingCase(testCase)}));
  const intentPasses = results.filter(({result}) => result.intentAccepted).length;
  const componentPasses = results.filter(({result}) => result.componentAccepted).length;

  return <main className="eval living-eval-page">
    <Link className="back" href="/pocs/living-ui">← Living UI に戻る</Link>
    <div className="eyebrow">PLT-4892 · Deterministic evaluation</div>
    <h1>Living UI evaluation</h1>
    <p className="muted">実際のユーザー意図に近い 50 件の固定ケースを、同じ resolver と登録済み表示レジストリで再生します。</p>
    <section className="panel living-eval-summary" aria-label="Evaluation summary">
      <div><small>Cases</small><strong>{results.length}</strong></div>
      <div><small>Intent match</small><strong>{intentPasses}/{results.length}</strong></div>
      <div><small>Display match</small><strong>{componentPasses}/{results.length}</strong></div>
    </section>
    <section className="panel">
      <h2>Case results</h2>
      <div className="living-eval-table-wrap"><table className="living-eval-table"><caption>Living UI evaluation cases and deterministic outcomes</caption><thead><tr><th>ID</th><th>Prompt</th><th>Intent</th><th>Display</th><th>Status</th></tr></thead><tbody>{results.map(({testCase, result}) => <tr key={testCase.id}><th scope="row"><code>{testCase.id}</code></th><td>{testCase.prompt}</td><td>{result.resolution.composition.intent}</td><td>{result.resolution.composition.components.join(' + ')}</td><td>{result.intentAccepted && result.componentAccepted ? 'pass' : 'review'}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
