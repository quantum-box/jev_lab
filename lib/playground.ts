export type PlaygroundQuestionType = 'choice' | 'noul' | 'score';
export type PlaygroundQuestion = {
  id: string;
  type: PlaygroundQuestionType;
  instructions: string;
  criteria?: Record<string, string | null> | string[];
};
export type PlaygroundInput = {
  state: Record<string, unknown>;
  question: PlaygroundQuestion;
};
export type PlaygroundAnswer = {
  id: string;
  type: PlaygroundQuestionType;
  choice?: string;
  noul?: number | null;
  score?: number;
  probabilities?: Record<string, number>;
  confidence?: number;
  legend?: Record<string, unknown>;
};
export type PlaygroundResult = {
  runId: string;
  provider: 'replay' | 'rule' | 'jev';
  model: string;
  durationMs: number;
  answer: PlaygroundAnswer;
  usage: { input_tokens: number; output_tokens: number } | { status: 'unavailable' };
  cost: { cost_nanodollars: number } | { status: 'unavailable' };
  priceBasisVersion: string;
};

export class PlaygroundValidationError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function validatePlaygroundInput(value: unknown): PlaygroundInput {
  if (!object(value) || !object(value.state) || !object(value.question)) {
    throw new PlaygroundValidationError('invalid_input', 'state と question はオブジェクトで指定してください。');
  }
  const q = value.question;
  if (typeof q.id !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(q.id)) {
    throw new PlaygroundValidationError('invalid_question', 'question.id が不正です。');
  }
  if (typeof q.instructions !== 'string' || !q.instructions.trim() || q.instructions.length > 2000) throw new PlaygroundValidationError('invalid_instructions', 'instructions は必須の短い説明です。');
  if (q.type !== 'choice' && q.type !== 'noul' && q.type !== 'score') {
    throw new PlaygroundValidationError('invalid_question', 'type は choice / noul / score のいずれかです。');
  }
  if (q.type === 'choice') {
    if (!object(q.criteria) || Object.keys(q.criteria).length < 2 || Object.keys(q.criteria).length > 8) {
      throw new PlaygroundValidationError('invalid_criteria', 'choice の criteria は2〜8個のマップです。');
    }
    for (const [key, label] of Object.entries(q.criteria)) {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(key) || (label !== null && typeof label !== 'string')) {
        throw new PlaygroundValidationError('invalid_criteria', 'choice の criteria は安全なキーと文字列ラベルで指定してください。');
      }
    }
  } else if (q.type === 'score') {
    if (!Array.isArray(q.criteria) || q.criteria.length < 2 || q.criteria.length > 8 ||
      q.criteria.some((x: unknown) => typeof x !== 'string' || !x.trim() || x.length > 100)) {
      throw new PlaygroundValidationError('invalid_criteria', 'score の criteria は順序付き2〜8個の配列です。');
    }
  } else if (q.criteria !== undefined) {
    throw new PlaygroundValidationError('invalid_criteria', 'noul に criteria は指定できません。');
  }
  const serialized = JSON.stringify(value);
  if (serialized.length > 900_000) throw new PlaygroundValidationError('body_too_large', '入力が大きすぎます。');
  return { state: value.state, question: { id: q.id, type: q.type, instructions: q.instructions.trim(), ...(q.criteria !== undefined ? { criteria: q.criteria as PlaygroundQuestion['criteria'] } : {}) } };
}

export function normalizePlaygroundAnswer(raw: unknown, question: PlaygroundQuestion): PlaygroundAnswer {
  if (!object(raw) || raw.type !== question.type) throw new PlaygroundValidationError('malformed_response', 'Jevの回答形式が不正です。');
  if (question.type === 'choice' && typeof raw.choice === 'string') return checkedExtras({ id: question.id, type: 'choice', choice: raw.choice, ...extras(raw) }, question);
  if (question.type === 'noul' && (raw.noul === null || typeof raw.noul === 'number' && Number.isFinite(raw.noul) && raw.noul >= 0 && raw.noul <= 1)) return { id: question.id, type: 'noul', noul: raw.noul };
  if (question.type === 'score' && typeof raw.score === 'number' && Number.isFinite(raw.score)) return checkedExtras({ id: question.id, type: 'score', score: raw.score, ...extras(raw) }, question);
  throw new PlaygroundValidationError('malformed_response', 'Jevの回答値が不正です。');
}

function extras(raw: Record<string, unknown>) {
  const out: Partial<PlaygroundAnswer> = {};
  if (raw.probabilities !== undefined) {
    if (!object(raw.probabilities) || Object.values(raw.probabilities).some(x => typeof x !== 'number' || !Number.isFinite(x) || x < 0 || x > 1)) throw new PlaygroundValidationError('malformed_response', 'probabilitiesが不正です。');
    out.probabilities = raw.probabilities as Record<string, number>;
  }
  if (raw.confidence !== undefined) {
    if (typeof raw.confidence !== 'number' || !Number.isFinite(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) throw new PlaygroundValidationError('malformed_response', 'confidenceが不正です。');
    out.confidence = raw.confidence;
  }
  if (raw.legend !== undefined && object(raw.legend)) out.legend = raw.legend;
  return out;
}
function checkedExtras(answer: PlaygroundAnswer, question: PlaygroundQuestion) {
  if (answer.type === 'choice' && typeof answer.choice === 'string' && question.criteria && !Array.isArray(question.criteria) && !Object.prototype.hasOwnProperty.call(question.criteria, answer.choice)) throw new PlaygroundValidationError('malformed_response', 'choiceがcriteriaにありません。');
  return answer;
}

export function wireRequest(input: PlaygroundInput) {
  return { model: 'typesafe/jev-latest', state: input.state, questions: { [input.question.id]: { instructions: input.question.instructions, type: input.question.type, ...(input.question.criteria !== undefined ? { criteria: input.question.criteria } : {}) } } };
}
