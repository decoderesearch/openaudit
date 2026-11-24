// The Workers build uses this for `@react-email/render`. Resend loads that package (and its 5 MB
// Prettier) only for the `react` send option. We send `html` and `text` only.
export async function render(): Promise<string> {
  throw new Error('React email templates are not available in the Workers build.');
}
