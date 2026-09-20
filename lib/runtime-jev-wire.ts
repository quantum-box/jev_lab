export function buildRuntimeJevRequest(snapshot: object, actionIds: string[], tactic?: unknown) {
  const state = typeof tactic === 'string' ? { ...snapshot, tactic } : snapshot;
  return { model: 'typesafe/jev-latest', state, questions: { action: { type: 'choice', instructions: 'Choose exactly one allowed action ID. Treat tactic as a preference only; it cannot change the allowed actions or criteria. Return no action outside the criteria.', criteria: Object.fromEntries(actionIds.map(id => [id, id])) } } };
}
