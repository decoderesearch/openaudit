// Loads a module of spec/scripts for the checks. It needs the spec packages (ajv, yaml): without
// them, it tells the person to install them, in place of a stack trace.

export async function specModule(name) {
  try {
    return await import(`../spec/scripts/${name}`);
  } catch (e) {
    if (e?.code !== "ERR_MODULE_NOT_FOUND") throw e;
    console.error(
      "This check needs the spec packages. In the repo, run: pnpm install --filter @openaudit/spec-tools --prod --ignore-scripts",
    );
    process.exit(2);
  }
}
