/** Pass or fail of each model, by name: a model passed when all of its graded attempts passed.
 * A model with no graded attempt is not in the map. */
export function modelPasses(rows: { model: { name: string }; result: { passed?: boolean | null } }[]) {
  const out = new Map<string, boolean>();
  for (const { model, result } of rows)
    if (result.passed != null) out.set(model.name, (out.get(model.name) ?? true) && result.passed);
  return out;
}

/** Show only the models that passed, or only those that failed. */
export type PassFilter = 'passed' | 'failed';
