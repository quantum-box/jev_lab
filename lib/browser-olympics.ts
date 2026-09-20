/**
 * Browser Olympics is a deliberately synthetic browser-internal benchmark.
 *
 * Nothing in this module can reach a real URL.  The DOM and accessibility
 * snapshots are generated from code-owned fixtures, while the action
 * allowlist and task validators live outside of those snapshots.  In
 * particular, text in a mock page can never grant a new capability.
 */

export const SYNTHETIC_ORIGIN = 'mock://browser-olympics';
export const MAX_STEPS = 30;
export const MAX_NO_PROGRESS = 4;
export const MAX_INVALID_STREAK = 3;

export type BrowserSite = 'ec' | 'library' | 'form';
export type BrowserLayoutVariant = 'standard' | 'dense' | 'sidebar' | 'dialog';
export type BrowserActionKind = 'observe' | 'click' | 'type' | 'select' | 'scroll';
export type BrowserTaskId =
  | 'ec-search'
  | 'ec-filter'
  | 'ec-sort'
  | 'ec-inspect'
  | 'library-search'
  | 'library-filter'
  | 'library-sort'
  | 'form-profile'
  | 'form-topic'
  | 'form-required';

export type BrowserAction = {
  kind: BrowserActionKind;
  target: string;
  value?: string;
};

export type BrowserState = {
  taskId: BrowserTaskId;
  site: BrowserSite;
  variant: BrowserLayoutVariant;
  route: string;
  query: string;
  category: string;
  sort: string;
  availability: string;
  topic: string;
  selectedId: string | null;
  fields: Record<string, string>;
  scroll: number;
  notice: string;
};

export type DomNodeSnapshot = {
  id: string;
  role: string;
  name: string;
  text: string;
  visible: boolean;
  enabled: boolean;
  attributes: Record<string, string>;
};

export type AccessibilityNodeSnapshot = {
  role: string;
  name: string;
  description?: string;
  focused: boolean;
  disabled: boolean;
};

export type BrowserSnapshot = {
  url: string;
  title: string;
  site: BrowserSite;
  variant: BrowserLayoutVariant;
  step: number;
  dom: DomNodeSnapshot[];
  accessibility: AccessibilityNodeSnapshot[];
};

export type BrowserTask = {
  id: BrowserTaskId;
  site: BrowserSite;
  variant: BrowserLayoutVariant;
  seed: number;
  title: string;
  goal: string;
  start: Partial<BrowserState>;
};

export type BrowserTraceEvent =
  | { type: 'observe'; step: number; snapshot: BrowserSnapshot }
  | { type: 'candidates'; step: number; actions: BrowserAction[] }
  | { type: 'decision'; step: number; action: BrowserAction; source: 'replay' | 'rule' | 'manual' }
  | { type: 'invalid'; step: number; action: BrowserAction; reason: string; recovery: BrowserAction }
  | { type: 'apply'; step: number; action: BrowserAction; changes: string[]; snapshot: BrowserSnapshot }
  | { type: 'complete'; step: number }
  | { type: 'cap'; step: number; reason: string };

export type BrowserRunStatus = 'idle' | 'running' | 'completed' | 'capped';

export type BrowserMetrics = {
  success: boolean;
  stepCount: number;
  invalidActionCount: number;
  recoveryCount: number;
  noProgressCount: number;
  capped: boolean;
  status: BrowserRunStatus;
  cost: { status: 'unavailable' };
};

export type BrowserTraceEnvelope = {
  schema: 'browser-olympics-trace';
  version: 1;
  taskId: BrowserTaskId;
  events: BrowserTraceEvent[];
};

export type BrowserStepResult = {
  accepted: boolean;
  action: BrowserAction;
  recovery?: BrowserAction;
  reason?: string;
  changes: string[];
  snapshot: BrowserSnapshot;
  candidates: BrowserAction[];
  metrics: BrowserMetrics;
};

type Product = { id: string; name: string; category: string; price: string };
type Book = { id: string; title: string; author: string; available: boolean };

const products: Product[] = [
  { id: 'ec-green-tea', name: 'Green Tea Starter Set', category: 'food', price: '¥1,280' },
  { id: 'ec-mug', name: 'Morning Mug', category: 'home', price: '¥980' },
  { id: 'ec-notebook', name: 'Field Notebook', category: 'stationery', price: '¥620' },
];
const books: Book[] = [
  { id: 'book-little-prince', title: 'The Little Prince', author: 'Antoine de Saint-Exupéry', available: true },
  { id: 'book-metamorphosis', title: 'The Metamorphosis', author: 'Franz Kafka', available: false },
  { id: 'book-solaris', title: 'Solaris', author: 'Stanisław Lem', available: true },
];

const taskSeeds: BrowserTask[] = [
  { id: 'ec-search', site: 'ec', variant: 'standard', seed: 490301, title: 'EC: search and inspect', goal: 'Find the Green Tea Starter Set', start: {} },
  { id: 'ec-filter', site: 'ec', variant: 'dense', seed: 490302, title: 'EC: category filter', goal: 'Filter the catalog to stationery', start: {} },
  { id: 'ec-sort', site: 'ec', variant: 'sidebar', seed: 490303, title: 'EC: price order', goal: 'Sort the catalog by lowest price', start: {} },
  { id: 'ec-inspect', site: 'ec', variant: 'dialog', seed: 490304, title: 'EC: inspect details', goal: 'Open the Morning Mug details', start: {} },
  { id: 'library-search', site: 'library', variant: 'standard', seed: 490305, title: 'Library: search and inspect', goal: 'Find The Little Prince', start: {} },
  { id: 'library-filter', site: 'library', variant: 'dense', seed: 490306, title: 'Library: availability', goal: 'Show available books only', start: {} },
  { id: 'library-sort', site: 'library', variant: 'sidebar', seed: 490307, title: 'Library: recent order', goal: 'Sort books by recently added', start: {} },
  { id: 'form-profile', site: 'form', variant: 'standard', seed: 490308, title: 'Form: profile fields', goal: 'Fill the safe profile fields', start: {} },
  { id: 'form-topic', site: 'form', variant: 'dense', seed: 490309, title: 'Form: choose topic', goal: 'Choose the support topic', start: {} },
  { id: 'form-required', site: 'form', variant: 'dialog', seed: 490310, title: 'Form: required fields', goal: 'Fill all required fields without submitting', start: {} },
];

export const browserTasks: readonly BrowserTask[] = taskSeeds;

const initialState = (task: BrowserTask): BrowserState => ({
  route: task.site === 'ec' ? '/catalog' : task.site === 'library' ? '/catalog' : '/contact',
  query: '', category: 'all', sort: 'recommended', availability: 'all', topic: '', selectedId: null,
  fields: { name: '', email: '', message: '' }, scroll: 0, notice: 'Synthetic page loaded.',
  ...task.start,
  taskId: task.id, site: task.site, variant: task.variant,
});

export function getBrowserTask(id: BrowserTaskId | string): BrowserTask | undefined {
  return browserTasks.find((task) => task.id === id);
}

export function createBrowserState(task: BrowserTask | BrowserTaskId): BrowserState {
  const resolved = typeof task === 'string' ? getBrowserTask(task) : task;
  if (!resolved) throw new Error(`Unknown browser task: ${String(task)}`);
  return initialState(resolved);
}

function action(kind: BrowserActionKind, target: string, value?: string): BrowserAction {
  return value === undefined ? { kind, target } : { kind, target, value };
}

const observeAction = () => action('observe', 'page');

function valuesFor(state: BrowserState): BrowserAction[] {
  if (state.site === 'ec') {
    return [
      action('type', 'search', 'Green Tea Starter Set'), action('type', 'search', 'Morning Mug'),
      action('type', 'search', 'Field Notebook'), action('select', 'category', 'food'),
      action('select', 'category', 'home'), action('select', 'category', 'stationery'),
      action('select', 'sort', 'price-low'), action('select', 'sort', 'recommended'),
      ...products.map((product) => action('click', `product:${product.id}`)),
    ];
  }
  if (state.site === 'library') {
    return [
      action('type', 'search', 'The Little Prince'), action('type', 'search', 'Solaris'),
      action('type', 'search', 'The Metamorphosis'), action('select', 'availability', 'available'),
      action('select', 'availability', 'all'), action('select', 'sort', 'recent'),
      action('select', 'sort', 'title'), ...books.map((book) => action('click', `book:${book.id}`)),
    ];
  }
  return [
    action('type', 'name', 'Aki Tanaka'), action('type', 'email', 'aki@example.test'),
    action('type', 'message', 'Please send the safe demo guide.'), action('select', 'topic', 'support'),
    action('select', 'topic', 'feedback'),
  ];
}

function productResults(state: BrowserState): Product[] {
  const query = state.query.trim().toLowerCase();
  const filtered = products.filter((product) =>
    (!query || product.name.toLowerCase().includes(query)) &&
    (state.category === 'all' || product.category === state.category),
  );
  if (state.sort === 'price-low') return [...filtered].sort((a, b) => Number(a.price.replace(/[^0-9]/g, '')) - Number(b.price.replace(/[^0-9]/g, '')));
  return filtered;
}

function bookResults(state: BrowserState): Book[] {
  const query = state.query.trim().toLowerCase();
  const filtered = books.filter((book) =>
    (!query || `${book.title} ${book.author}`.toLowerCase().includes(query)) &&
    (state.availability === 'all' || (state.availability === 'available' && book.available)),
  );
  if (state.sort === 'recent') {
    const recentOrder = ['book-solaris', 'book-metamorphosis', 'book-little-prince'];
    return [...filtered].sort((a, b) => recentOrder.indexOf(a.id) - recentOrder.indexOf(b.id));
  }
  if (state.sort === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  return filtered;
}

/**
 * Hard capability allowlist.  It is intentionally independent of page text,
 * DOM attributes, or an action supplied by a model.
 */
export function isAllowlistedAction(state: BrowserState, candidate: BrowserAction): boolean {
  if (!candidate || typeof candidate !== 'object') return false;
  if (!['observe', 'click', 'type', 'select', 'scroll'].includes(candidate.kind)) return false;
  if (candidate.target.toLowerCase().match(/javascript|external|purchase|checkout|submit|delete|payment/)) return false;
  if (candidate.kind === 'observe') return candidate.target === 'page' && candidate.value === undefined;
  if (candidate.kind === 'scroll') return candidate.target === 'page' && ['0', '50', '100'].includes(candidate.value ?? '');
  const allowed = valuesFor(state).some((value) => value.kind === candidate.kind && value.target === candidate.target && value.value === candidate.value);
  return allowed;
}

function actionEqual(a: BrowserAction, b: BrowserAction): boolean {
  return a.kind === b.kind && a.target === b.target && a.value === b.value;
}

export function candidateActions(state: BrowserState): BrowserAction[] {
  const candidates: BrowserAction[] = [observeAction()];
  const allowed = valuesFor(state);
  const task = getBrowserTask(state.taskId)!;
  if (task.id === 'ec-search' && !state.query) candidates.push(allowed[0]);
  else if (task.id === 'ec-search' && !state.selectedId) { const target = allowed.find((a) => a.target === 'product:ec-green-tea'); if (productResults(state).some((product) => product.id === 'ec-green-tea') && target) candidates.push(target); }
  else if (task.id === 'ec-filter' && state.category !== 'stationery') candidates.push(allowed.find((a) => a.target === 'category' && a.value === 'stationery')!);
  else if (task.id === 'ec-sort' && state.sort !== 'price-low') candidates.push(allowed.find((a) => a.target === 'sort' && a.value === 'price-low')!);
  else if (task.id === 'ec-inspect' && !state.selectedId) candidates.push(allowed.find((a) => a.target === 'product:ec-mug')!);
  else if (task.id === 'library-search' && !state.query) candidates.push(allowed.find((a) => a.target === 'search' && a.value === 'The Little Prince')!);
  else if (task.id === 'library-search' && !state.selectedId) { const target = allowed.find((a) => a.target === 'book:book-little-prince'); if (bookResults(state).some((book) => book.id === 'book-little-prince') && target) candidates.push(target); }
  else if (task.id === 'library-filter' && state.availability !== 'available') candidates.push(allowed.find((a) => a.target === 'availability' && a.value === 'available')!);
  else if (task.id === 'library-sort' && state.sort !== 'recent') candidates.push(allowed.find((a) => a.target === 'sort' && a.value === 'recent')!);
  else if (task.id === 'form-profile' && !state.fields.name) candidates.push(allowed.find((a) => a.target === 'name')!);
  else if (task.id === 'form-profile' && !state.fields.email) candidates.push(allowed.find((a) => a.target === 'email')!);
  else if (task.id === 'form-topic' && !state.topic) candidates.push(allowed.find((a) => a.target === 'topic' && a.value === 'support')!);
  else if (task.id === 'form-required' && !state.fields.name) candidates.push(allowed.find((a) => a.target === 'name')!);
  else if (task.id === 'form-required' && !state.fields.email) candidates.push(allowed.find((a) => a.target === 'email')!);
  else if (task.id === 'form-required' && !state.fields.message) candidates.push(allowed.find((a) => a.target === 'message')!);
  return candidates.filter(Boolean);
}

export function validateBrowserAction(state: BrowserState, candidate: BrowserAction): { ok: true } | { ok: false; reason: string } {
  if (!isAllowlistedAction(state, candidate)) return { ok: false, reason: 'action is outside the synthetic capability allowlist' };
  if (!candidateActions(state).some((allowed) => actionEqual(allowed, candidate))) return { ok: false, reason: 'action is not a candidate for this snapshot' };
  if (candidate.kind === 'type' && (!candidate.value || candidate.value.length > 120)) return { ok: false, reason: 'text value is empty or too long' };
  return { ok: true };
}

export const validateAction = validateBrowserAction;

function diff(before: BrowserState, after: BrowserState): string[] {
  const keys: Array<keyof BrowserState> = ['route', 'query', 'category', 'sort', 'availability', 'topic', 'selectedId', 'scroll', 'notice'];
  const changed = keys.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
  if (JSON.stringify(before.fields) !== JSON.stringify(after.fields)) changed.push('fields');
  return changed;
}

export function applyBrowserAction(state: BrowserState, candidate: BrowserAction): BrowserState {
  if (!validateBrowserAction(state, candidate).ok) return state;
  const next: BrowserState = { ...state, fields: { ...state.fields } };
  if (candidate.kind === 'observe') return { ...next, notice: 'Snapshot observed; no page side effect.' };
  if (candidate.kind === 'scroll') return { ...next, scroll: Number(candidate.value), notice: `Scrolled to ${candidate.value}%.` };
  if (candidate.kind === 'type') {
    if (candidate.target === 'search') return { ...next, query: candidate.value ?? '', notice: 'Search field updated; no external request was made.' };
    next.fields[candidate.target] = candidate.value ?? '';
    return { ...next, notice: `${candidate.target} field updated; submit is unavailable.` };
  }
  if (candidate.kind === 'select') {
    if (candidate.target === 'category') return { ...next, category: candidate.value ?? 'all', notice: 'Local category filter changed.' };
    if (candidate.target === 'sort') return { ...next, sort: candidate.value ?? 'recommended', notice: 'Local sort order changed.' };
    if (candidate.target === 'availability') return { ...next, availability: candidate.value ?? 'all', notice: 'Local availability filter changed.' };
    if (candidate.target === 'topic') return { ...next, topic: candidate.value ?? '', notice: 'Topic selected; submit is unavailable.' };
  }
  if (candidate.kind === 'click') {
    next.selectedId = candidate.target.split(':')[1] ?? null;
    return { ...next, notice: 'Details opened inside the synthetic site.' };
  }
  return next;
}

export function validateTaskCompletion(task: BrowserTask | BrowserTaskId, state: BrowserState): { success: boolean; reason: string } {
  const resolved = typeof task === 'string' ? getBrowserTask(task) : task;
  if (!resolved || state.taskId !== resolved.id || state.site !== resolved.site) return { success: false, reason: 'task/state mismatch' };
  switch (resolved.id) {
    case 'ec-search': return { success: state.query === 'Green Tea Starter Set' && productResults(state).some((product) => product.id === 'ec-green-tea') && state.selectedId === 'ec-green-tea', reason: 'search query and visible product details must match' };
    case 'ec-filter': return { success: state.category === 'stationery' && productResults(state).length > 0 && productResults(state).every((product) => product.category === 'stationery'), reason: 'stationery category must be selected and reflected in results' };
    case 'ec-sort': return { success: state.sort === 'price-low' && productResults(state).map((product) => product.id).join(',') === 'ec-notebook,ec-mug,ec-green-tea', reason: 'price-low sort must be selected and reflected in results' };
    case 'ec-inspect': return { success: state.selectedId === 'ec-mug', reason: 'Morning Mug details must be open' };
    case 'library-search': return { success: state.query === 'The Little Prince' && bookResults(state).some((book) => book.id === 'book-little-prince') && state.selectedId === 'book-little-prince', reason: 'book query and visible details must match' };
    case 'library-filter': return { success: state.availability === 'available' && bookResults(state).length > 0 && bookResults(state).every((book) => book.available), reason: 'available-only filter must be selected and reflected in results' };
    case 'library-sort': return { success: state.sort === 'recent' && bookResults(state).map((book) => book.id).join(',') === 'book-solaris,book-metamorphosis,book-little-prince', reason: 'recent sort must be selected and reflected in results' };
    case 'form-profile': return { success: state.fields.name === 'Aki Tanaka' && state.fields.email === 'aki@example.test', reason: 'safe name and email fields must be filled' };
    case 'form-topic': return { success: state.topic === 'support', reason: 'support topic must be selected' };
    case 'form-required': return { success: Boolean(state.fields.name && state.fields.email && state.fields.message), reason: 'all required fields must be filled; no submit action exists' };
  }
}

function node(id: string, role: string, name: string, text = '', attributes: Record<string, string> = {}): DomNodeSnapshot {
  return { id, role, name, text, visible: true, enabled: attributes.disabled !== 'true', attributes };
}

/** Build both DOM and accessibility views from the same synthetic state. */
export function snapshotFor(state: BrowserState, step = 0): BrowserSnapshot {
  const dom: DomNodeSnapshot[] = [node('page', 'document', state.site === 'ec' ? 'Mock EC' : state.site === 'library' ? 'Mock Library' : 'Mock Form', '', { 'data-layout': state.variant, 'data-shell': state.variant === 'sidebar' ? 'sidebar-navigation' : state.variant === 'dialog' ? 'modal-surface' : state.variant === 'dense' ? 'dense-grid' : 'standard-grid' })];
  if (state.variant === 'sidebar') dom.push(node('layout-navigation', 'navigation', 'Sidebar navigation', 'Synthetic sidebar layout', { 'data-layout': 'sidebar' }));
  if (state.variant === 'dialog') dom.push(node('layout-dialog', 'dialog', 'Details dialog surface', 'Synthetic dialog layout', { 'data-layout': 'dialog' }));
  if (state.variant === 'dense') dom.push(node('layout-grid', 'list', 'Dense results grid', 'Synthetic dense layout', { 'data-layout': 'dense' }));
  if (state.variant === 'standard') dom.push(node('layout-content', 'main', 'Standard content', 'Synthetic standard layout', { 'data-layout': 'standard' }));
  if (state.site === 'ec') {
    dom.push(node('search', 'textbox', 'Search products', state.query));
    dom.push(node('category', 'combobox', 'Category', state.category));
    dom.push(node('sort', 'combobox', 'Sort by', state.sort));
    productResults(state).forEach((product) => dom.push(node(`product:${product.id}`, 'button', product.name, `${product.category} ${product.price}`)));
  } else if (state.site === 'library') {
    dom.push(node('search', 'textbox', 'Search books', state.query));
    dom.push(node('availability', 'combobox', 'Availability', state.availability));
    dom.push(node('sort', 'combobox', 'Sort by', state.sort));
    bookResults(state).forEach((book) => dom.push(node(`book:${book.id}`, 'button', book.title, `${book.author}${book.available ? ' available' : ' checked out'}`)));
  } else {
    dom.push(node('name', 'textbox', 'Name', state.fields.name));
    dom.push(node('email', 'textbox', 'Email', state.fields.email));
    dom.push(node('topic', 'combobox', 'Topic', state.topic || 'Choose a topic'));
    dom.push(node('message', 'textbox', 'Message', state.fields.message));
    dom.push(node('submit-disabled', 'button', 'Submit unavailable', 'Synthetic sandbox does not submit', { disabled: 'true' }));
  }
  dom.push(node('notice', 'status', 'Sandbox status', state.notice));
  const accessibility = dom.map((entry) => ({ role: entry.role, name: entry.name, description: entry.text || undefined, focused: false, disabled: !entry.enabled }));
  return { url: `${SYNTHETIC_ORIGIN}${state.route}`, title: `${state.site.toUpperCase()} · Synthetic browser`, site: state.site, variant: state.variant, step, dom, accessibility };
}

function stateSignature(state: BrowserState): string { return JSON.stringify([state.query, state.category, state.sort, state.availability, state.topic, state.selectedId, state.fields, state.scroll]); }

function recoveryAction(state: BrowserState): BrowserAction { return observeAction(); }

function isBrowserActionShape(value: unknown): value is BrowserAction {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (!['observe', 'click', 'type', 'select', 'scroll'].includes(String(candidate.kind))) return false;
  if (typeof candidate.target !== 'string' || candidate.target.length === 0) return false;
  return candidate.value === undefined || typeof candidate.value === 'string';
}

/** Validate the trace envelope before resetting or replaying any state. */
export function validateBrowserTrace(value: unknown): value is BrowserTraceEnvelope {
  if (!value || typeof value !== 'object') return false;
  const envelope = value as Record<string, unknown>;
  if (envelope.schema !== 'browser-olympics-trace' || envelope.version !== 1 || typeof envelope.taskId !== 'string' || !getBrowserTask(envelope.taskId)) return false;
  if (!Array.isArray(envelope.events) || envelope.events.length > 10000) return false;
  return envelope.events.every((event) => {
    if (!event || typeof event !== 'object') return false;
    const entry = event as Record<string, unknown>;
    if (entry.type === 'decision') return isBrowserActionShape(entry.action) && ['replay', 'rule', 'manual'].includes(String(entry.source));
    if (entry.type === 'invalid') return isBrowserActionShape(entry.action) && isBrowserActionShape(entry.recovery) && typeof entry.reason === 'string';
    if (entry.type === 'apply') return isBrowserActionShape(entry.action) && Array.isArray(entry.changes) && entry.changes.every((change) => typeof change === 'string') && Boolean(entry.snapshot && typeof entry.snapshot === 'object');
    if (entry.type === 'observe') return Boolean(entry.snapshot && typeof entry.snapshot === 'object');
    if (entry.type === 'candidates') return Array.isArray(entry.actions) && entry.actions.every(isBrowserActionShape);
    if (entry.type === 'complete' || entry.type === 'cap') return typeof entry.step === 'number' && (entry.type === 'complete' || typeof entry.reason === 'string');
    return false;
  });
}

export class BrowserOlympicsRuntime {
  private readonly task: BrowserTask;
  private stateValue: BrowserState;
  private statusValue: BrowserRunStatus = 'idle';
  private stepValue = 0;
  private invalidValue = 0;
  private recoveryValue = 0;
  private noProgressValue = 0;
  private noProgressStreak = 0;
  private invalidStreak = 0;
  private seen = new Set<string>();
  private events: BrowserTraceEvent[] = [];

  constructor(task: BrowserTask | BrowserTaskId) {
    const resolved = typeof task === 'string' ? getBrowserTask(task) : task;
    if (!resolved) throw new Error(`Unknown browser task: ${String(task)}`);
    this.task = resolved;
    this.stateValue = createBrowserState(resolved);
    this.seen.add(stateSignature(this.stateValue));
  }

  get taskDefinition() { return this.task; }
  get state() { return structuredClone(this.stateValue); }
  get status() { return this.statusValue; }
  get stepCount() { return this.stepValue; }
  get metrics(): BrowserMetrics {
    return { success: validateTaskCompletion(this.task, this.stateValue).success, stepCount: this.stepValue, invalidActionCount: this.invalidValue, recoveryCount: this.recoveryValue, noProgressCount: this.noProgressValue, capped: this.statusValue === 'capped', status: this.statusValue, cost: { status: 'unavailable' } };
  }
  observe(): BrowserSnapshot {
    const snapshot = snapshotFor(this.stateValue, this.stepValue);
    this.events.push({ type: 'observe', step: this.stepValue, snapshot });
    return snapshot;
  }
  candidates(): BrowserAction[] {
    const candidates = candidateActions(this.stateValue);
    this.events.push({ type: 'candidates', step: this.stepValue, actions: structuredClone(candidates) });
    return candidates;
  }
  step(chosen?: BrowserAction, source: 'replay' | 'rule' | 'manual' = 'manual'): BrowserStepResult {
    if (this.statusValue === 'completed' || this.statusValue === 'capped') return { accepted: false, action: chosen ?? observeAction(), reason: 'run is already terminal', changes: [], snapshot: snapshotFor(this.stateValue, this.stepValue), candidates: candidateActions(this.stateValue), metrics: this.metrics };
    this.statusValue = 'running';
    const candidates = this.candidates();
    const selected = chosen ?? candidates[1] ?? observeAction();
    this.events.push({ type: 'decision', step: this.stepValue + 1, action: structuredClone(selected), source });
    const check = validateBrowserAction(this.stateValue, selected);
    this.stepValue += 1;
    if (!check.ok) {
      this.invalidValue += 1;
      this.recoveryValue += 1;
      this.invalidStreak += 1;
      const recovery = recoveryAction(this.stateValue);
      this.events.push({ type: 'invalid', step: this.stepValue, action: structuredClone(selected), reason: check.reason, recovery });
      const beforeRecovery = this.stateValue;
      this.stateValue = applyBrowserAction(this.stateValue, recovery);
      const recoveryChanges = diff(beforeRecovery, this.stateValue);
      const recoverySnapshot = snapshotFor(this.stateValue, this.stepValue);
      this.events.push({ type: 'apply', step: this.stepValue, action: recovery, changes: recoveryChanges, snapshot: recoverySnapshot });
      if (this.invalidStreak >= MAX_INVALID_STREAK) this.cap('invalid action loop');
      return { accepted: false, action: selected, recovery, reason: check.reason, changes: recoveryChanges, snapshot: recoverySnapshot, candidates, metrics: this.metrics };
    }
    const before = this.stateValue;
    this.stateValue = applyBrowserAction(this.stateValue, selected);
    const changes = diff(before, this.stateValue);
    this.invalidStreak = 0;
    const signature = stateSignature(this.stateValue);
    if (signature === stateSignature(before)) { this.noProgressValue += 1; this.noProgressStreak += 1; } else this.noProgressStreak = 0;
    this.seen.add(signature);
    const snapshot = snapshotFor(this.stateValue, this.stepValue);
    this.events.push({ type: 'apply', step: this.stepValue, action: structuredClone(selected), changes, snapshot });
    const completion = validateTaskCompletion(this.task, this.stateValue);
    if (completion.success) { this.statusValue = 'completed'; this.events.push({ type: 'complete', step: this.stepValue }); }
    else if (this.stepValue >= MAX_STEPS) this.cap('maximum step cap reached');
    else if (this.noProgressStreak >= MAX_NO_PROGRESS) this.cap('no-progress loop detected');
    return { accepted: true, action: selected, changes, snapshot, candidates, metrics: this.metrics };
  }
  reset() {
    this.stateValue = createBrowserState(this.task); this.statusValue = 'idle'; this.stepValue = 0; this.invalidValue = 0; this.recoveryValue = 0; this.noProgressValue = 0; this.noProgressStreak = 0; this.invalidStreak = 0; this.seen = new Set([stateSignature(this.stateValue)]); this.events = [];
  }
  cap(reason: string) { this.statusValue = 'capped'; this.events.push({ type: 'cap', step: this.stepValue, reason }); }
  exportTrace(): string { const trace = { schema: 'browser-olympics-trace' as const, version: 1 as const, taskId: this.task.id, events: this.events }; const serialized = JSON.stringify(trace); if (serialized.length > 500_000) throw new Error('trace exceeds 500KB'); return serialized; }
  get trace() { return this.events.map((event) => structuredClone(event)); }
  replay(serialized: string | BrowserTraceEnvelope): BrowserMetrics {
    let parsed: unknown;
    try { parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized; } catch { throw new Error('invalid browser trace'); }
    if (!validateBrowserTrace(parsed) || parsed.taskId !== this.task.id) throw new Error('invalid browser trace');
    this.reset();
    for (const event of parsed.events) {
      if (event.type === 'decision') this.step(event.action, 'replay');
      if (this.statusValue === 'completed' || this.statusValue === 'capped') break;
    }
    return this.metrics;
  }
}

function planFor(task: BrowserTask): BrowserAction[] {
  switch (task.id) {
    case 'ec-search': return [action('type', 'search', 'Green Tea Starter Set'), action('click', 'product:ec-green-tea')];
    case 'ec-filter': return [action('select', 'category', 'stationery')];
    case 'ec-sort': return [action('select', 'sort', 'price-low')];
    case 'ec-inspect': return [action('click', 'product:ec-mug')];
    case 'library-search': return [action('type', 'search', 'The Little Prince'), action('click', 'book:book-little-prince')];
    case 'library-filter': return [action('select', 'availability', 'available')];
    case 'library-sort': return [action('select', 'sort', 'recent')];
    case 'form-profile': return [action('type', 'name', 'Aki Tanaka'), action('type', 'email', 'aki@example.test')];
    case 'form-topic': return [action('select', 'topic', 'support')];
    case 'form-required': return [action('type', 'name', 'Aki Tanaka'), action('type', 'email', 'aki@example.test'), action('type', 'message', 'Please send the safe demo guide.')];
  }
}

export function runBaseline(task: BrowserTask | BrowserTaskId, mode: 'replay' | 'rule' = 'replay'): BrowserMetrics & { trace: string } {
  const runtime = new BrowserOlympicsRuntime(task);
  const resolved = runtime.taskDefinition;
  const plan = planFor(resolved);
  if (mode === 'rule') runtime.step(action('click', 'submit'), 'rule'); // deterministic safety-recovery probe; submit is never allowed
  for (const next of plan) { if (runtime.status === 'completed' || runtime.status === 'capped') break; runtime.step(next, mode); }
  return { ...runtime.metrics, trace: runtime.exportTrace() };
}

export function runAllBaselines(mode: 'replay' | 'rule' = 'replay') {
  return browserTasks.map((task) => ({ taskId: task.id, ...runBaseline(task, mode) }));
}
