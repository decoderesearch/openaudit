/** The URL fragment for one model's results in one document, on an eval page. */
export function runAnchor(modelName: string, documentKey: string) {
  return `${modelName}@${documentKey}`;
}
