const Ajv = require("ajv");
const schema = require("./schema.v1.ajv.json");

const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

module.exports = function validateV1(data) {
  const ok = validate(data);
  if (!ok) {
    const err = new Error("Schema validation failed");
    err.details = validate.errors;
    throw err;
  }
  return data;
};
