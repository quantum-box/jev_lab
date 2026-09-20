export type CriterionKey = 'theme' | 'population' | 'method' | 'results';
export type CriterionStatus = 'yes' | 'no' | 'unknown';
export type ScreeningDecision = 'include' | 'exclude' | 'needs-review';

export const PAPER_SCREENING_CRITERIA_VERSION = 'paper-screening-criteria-2026.09.1';
export const PAPER_SCREENING_DATA_VERSION = 'paper-screening-synthetic-2026.09.1';

export const criterionLabels: Record<CriterionKey, string> = {
  theme: 'テーマ適合',
  population: '研究対象',
  method: '方法',
  results: '結果記述',
};

export const criterionDefinitions: Record<CriterionKey, string> = {
  theme: 'AIを用いた人の意思決定支援を主題としている',
  population: '人の参加者・利用者・業務データを対象としている',
  method: '比較・実験・観察など、検証可能な方法が記載されている',
  results: '結果・アウトカムの記述がある',
};

export type PaperSource = {
  label: string;
  url: string;
  license: string;
  provenance: string;
};

export type PaperFixture = {
  id: string;
  title: string;
  authors: string;
  year: number;
  language: '日本語' | 'English';
  abstract: string;
  source: PaperSource;
  humanDecision: ScreeningDecision;
  failureTag?: string;
  /** Synthetic fixture annotation: Jev's abstract-only reading of each criterion. */
  criterionHints: Record<CriterionKey, CriterionStatus>;
};

export type CriterionResult = {
  key: CriterionKey;
  label: string;
  status: CriterionStatus;
  evidence: string;
  rationale: string;
};

export type ScreeningResult = {
  paper: PaperFixture;
  criteria: CriterionResult[];
  decision: ScreeningDecision;
  reason: string;
  mode: 'jev-fixed-replay';
};

export const screeningSamples: PaperFixture[] = [
  {
    id: 'PS-001',
    title: '医療チームの意思決定を支援する説明可能なAIの評価',
    authors: 'Synthetic Research Group',
    year: 2025,
    language: '日本語',
    abstract: '本研究は、医療チームの意思決定支援に用いる説明可能なAIを評価した。24名の医療者が模擬症例を用いた比較実験に参加し、支援あり・なしの判断時間と正確性を測定した。結果として、支援あり条件で判断時間が短縮し、正確性は同等であった。',
    source: { label: 'Synthetic Open Abstracts', url: 'https://example.org/jev/paper-screening/PS-001', license: 'CC BY 4.0 (synthetic demo)', provenance: '公開利用可能な合成要旨（デモ用）' },
    humanDecision: 'include',
    criterionHints: { theme: 'yes', population: 'yes', method: 'yes', results: 'yes' },
  },
  {
    id: 'PS-002',
    title: 'Human-centered decision support for frontline operations',
    authors: 'Synthetic Methods Lab',
    year: 2024,
    language: 'English',
    abstract: 'We studied an AI decision-support assistant for frontline operations. Thirty-two customer-support users completed a randomized within-subject experiment comparing assisted and unassisted decisions. The results showed higher policy-consistent decisions with a small increase in completion time.',
    source: { label: 'Synthetic Open Abstracts', url: 'https://example.org/jev/paper-screening/PS-002', license: 'CC BY 4.0 (synthetic demo)', provenance: '公開利用可能な合成要旨（デモ用）' },
    humanDecision: 'include',
    criterionHints: { theme: 'yes', population: 'yes', method: 'yes', results: 'yes' },
  },
  {
    id: 'PS-003',
    title: 'Decision language in civic participation surveys',
    authors: 'Synthetic Civic Data Lab',
    year: 2023,
    language: 'English',
    abstract: 'This survey analyzes decision-making language in 1,200 public comments about local voting. We report topic frequencies and sentiment results. The study does not evaluate an AI decision-support system or a decision aid.',
    source: { label: 'Synthetic Open Abstracts', url: 'https://example.org/jev/paper-screening/PS-003', license: 'CC BY 4.0 (synthetic demo)', provenance: '公開利用可能な合成要旨（デモ用）' },
    humanDecision: 'exclude',
    failureTag: '関連語だけ一致',
    criterionHints: { theme: 'no', population: 'yes', method: 'yes', results: 'yes' },
  },
  {
    id: 'PS-004',
    title: 'AI-assisted decisions: a registered study protocol',
    authors: 'Synthetic Protocol Team',
    year: 2025,
    language: 'English',
    abstract: 'We present a protocol for a future study of an AI decision-support tool with nurses. The planned sample, measures, and analysis are described. No participants were enrolled and no empirical results are reported in this abstract.',
    source: { label: 'Synthetic Open Abstracts', url: 'https://example.org/jev/paper-screening/PS-004', license: 'CC BY 4.0 (synthetic demo)', provenance: '公開利用可能な合成要旨（デモ用）' },
    humanDecision: 'exclude',
    failureTag: '方法違い（研究計画のみ）',
    criterionHints: { theme: 'yes', population: 'unknown', method: 'no', results: 'no' },
  },
  {
    id: 'PS-005',
    title: 'Decision support and user trust: an abstract with limited detail',
    authors: 'Synthetic Human Factors Lab',
    year: 2022,
    language: '日本語',
    abstract: '意思決定支援のためのAIインターフェースについて報告する。利用者の信頼と受容性を検討したが、研究対象、比較方法、測定結果の詳細は要旨に記載していない。',
    source: { label: 'Synthetic Open Abstracts', url: 'https://example.org/jev/paper-screening/PS-005', license: 'CC BY 4.0 (synthetic demo)', provenance: '公開利用可能な合成要旨（デモ用）' },
    humanDecision: 'needs-review',
    failureTag: '要旨に情報なし',
    criterionHints: { theme: 'yes', population: 'unknown', method: 'unknown', results: 'unknown' },
  },
];

const criterionEvidence: Record<CriterionKey, (paper: PaperFixture) => string> = {
  theme: paper => paper.id === 'PS-003' ? '“decision-making language” はあるが、AI decision-support を評価していない' : paper.id === 'PS-005' ? '“意思決定支援のためのAI”' : paper.abstract.split(/[。.!?]/u)[0] ?? paper.abstract,
  population: paper => paper.criterionHints.population === 'unknown' ? '要旨に研究対象の明記なし' : paper.id === 'PS-001' ? '“24名の医療者”' : paper.id === 'PS-002' ? '“Thirty-two customer-support users”' : paper.id === 'PS-003' ? '“1,200 public comments”' : '“nurses” は計画上の対象',
  method: paper => paper.criterionHints.method === 'unknown' ? '比較方法の明記なし' : paper.id === 'PS-004' ? '“protocol for a future study”' : paper.id === 'PS-001' ? '“比較実験”' : paper.id === 'PS-002' ? '“randomized within-subject experiment”' : '“survey analyzes”',
  results: paper => paper.criterionHints.results === 'unknown' ? '測定結果の明記なし' : paper.criterionHints.results === 'no' ? '“No ... empirical results are reported”' : paper.id === 'PS-001' ? '“結果として、支援あり条件で...”' : paper.id === 'PS-002' ? '“The results showed...”' : '“sentiment results”',
};

function criterionRationale(key: CriterionKey, status: CriterionStatus) {
  if (status === 'yes') return `${criterionLabels[key]}に関する記述を要旨内で確認`;
  if (status === 'no') return `${criterionLabels[key]}の必須条件を満たさない記述を確認`;
  return `${criterionLabels[key]}は要旨だけでは判定できない`;
}

export function screenPaper(paper: PaperFixture): ScreeningResult {
  const criteria = (Object.keys(criterionLabels) as CriterionKey[]).map(key => ({ key, label: criterionLabels[key], status: paper.criterionHints[key], evidence: criterionEvidence[key](paper), rationale: criterionRationale(key, paper.criterionHints[key]) }));
  const hasNo = criteria.some(item => item.status === 'no');
  const hasUnknown = criteria.some(item => item.status === 'unknown');
  const decision: ScreeningDecision = hasNo ? 'exclude' : hasUnknown ? 'needs-review' : 'include';
  const reason = hasNo ? '必須条件の不一致があるため除外候補' : hasUnknown ? '要旨だけでは条件を確定できないため要確認' : '4条件を要旨内で確認できるため採用候補';
  return { paper, criteria, decision, reason, mode: 'jev-fixed-replay' };
}

export function baselineKeywordScreen(paper: PaperFixture): ScreeningDecision {
  const text = paper.abstract.toLowerCase();
  const hasThemeWord = /decision|意思決定|意思決定支援|decision-support|ai/.test(text);
  const hasResultWord = /result|結果|outcome|accuracy|正確性/.test(text);
  if (!hasThemeWord) return 'exclude';
  if (!hasResultWord) return 'needs-review';
  return 'include';
}

export type EvaluationMetrics = {
  total: number;
  candidateRecall: number;
  falseExclusionRate: number;
  needsReviewRate: number;
  baselineCandidateRecall: number;
  baselineFalseExclusionRate: number;
  baselineNeedsReviewRate: number;
  jevCost: number;
  baselineCost: number;
  liveEstimateCost: number;
  confusion: Record<ScreeningDecision, Record<ScreeningDecision, number>>;
};

export const evaluationCases: PaperFixture[] = Array.from({ length: 50 }, (_, index) => {
  const base = screeningSamples[index % screeningSamples.length];
  const copy = { ...base, id: `FIX-${String(index + 1).padStart(2, '0')}`, title: `${base.title} · fixture ${index + 1}` };
  return { ...copy, criterionHints: { ...base.criterionHints }, source: { ...base.source } };
});

export function evaluationMetrics(cases: PaperFixture[] = evaluationCases): EvaluationMetrics {
  const rows = cases.map(paper => ({ expected: paper.humanDecision, jev: screenPaper(paper).decision, baseline: baselineKeywordScreen(paper) }));
  const included = rows.filter(row => row.expected === 'include');
  const falseExclusions = included.filter(row => row.jev === 'exclude').length;
  const baselineFalseExclusions = included.filter(row => row.baseline === 'exclude').length;
  const confusion = (['include', 'exclude', 'needs-review'] as ScreeningDecision[]).reduce((outer, expected) => {
    outer[expected] = (['include', 'exclude', 'needs-review'] as ScreeningDecision[]).reduce((inner, actual) => { inner[actual] = rows.filter(row => row.expected === expected && row.jev === actual).length; return inner; }, {} as Record<ScreeningDecision, number>);
    return outer;
  }, {} as Record<ScreeningDecision, Record<ScreeningDecision, number>>);
  return {
    total: rows.length,
    candidateRecall: included.length ? (included.length - falseExclusions) / included.length : 0,
    falseExclusionRate: included.length ? falseExclusions / included.length : 0,
    needsReviewRate: rows.length ? rows.filter(row => row.jev === 'needs-review').length / rows.length : 0,
    baselineCandidateRecall: included.length ? (included.length - baselineFalseExclusions) / included.length : 0,
    baselineFalseExclusionRate: included.length ? baselineFalseExclusions / included.length : 0,
    baselineNeedsReviewRate: rows.length ? rows.filter(row => row.baseline === 'needs-review').length / rows.length : 0,
    jevCost: rows.length * 0,
    baselineCost: rows.length * 0,
    liveEstimateCost: rows.length * 0.002,
    confusion,
  };
}

export const screeningFailureExamples = screeningSamples.filter(item => item.failureTag).map(item => ({ tag: item.failureTag!, paper: item, jev: screenPaper(item), baseline: baselineKeywordScreen(item) }));
