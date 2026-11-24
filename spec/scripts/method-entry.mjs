// Checks one method entry (the `method` of data/seed/methods/*.json) against the Method schema. The
// method submission check (submissions/check.mjs) uses it.
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";
import { bundle } from "./generate.mjs";

const SPEC = "https://openaudit.com/spec/v1/openaudit.schema.json#/$defs/";
const FAKE_ID = "01900000-0000-7000-8000-000000000000";

let validate;

/** The errors of a method entry. The import sets `id`. */
export function methodEntryErrors(method) {
  if (!validate) {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats.default(ajv);
    ajv.addSchema(bundle());
    validate = ajv.getSchema(`${SPEC}Method`);
  }
  return validate({ id: FAKE_ID, ...method })
    ? []
    : validate.errors.map(
        (e) =>
          `method.json${e.instancePath || "/"} ${e.message}${e.params?.allowedValues ? ` (${e.params.allowedValues.join(", ")})` : ""}`,
      );
}
