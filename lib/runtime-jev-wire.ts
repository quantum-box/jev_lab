export function buildRuntimeJevRequest(snapshot: object, actionIds: string[]) {
  return { model: 'typesafe/jev-latest', state: snapshot, questions: { action: { type: 'choice', instructions: 'Choose exactly one allowed action ID. Return no action outside the criteria.', criteria: Object.fromEntries(actionIds.map(id => [id, id])) } } };
}
