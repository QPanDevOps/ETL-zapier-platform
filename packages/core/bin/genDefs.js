/**
 * this file takes the default build output of the `zapier-platform-schema` and processes it into something that's more standard
 * From what I can tell, the schema we build is non-standard, but all the tools we use it with are fine with that ¯\_(ツ)_/¯
 *
 * there are a few steps we need to perform on the schema to get it ready for json-schema-to-typescript
 */

const { writeFileSync } = require('fs');
const { isPlainObject, isEqual } = require('lodash');
const { compile } = require('json-schema-to-typescript');
const path = require('path');

const WRAPPABLE_OBJ_KEYS = new Set(['$ref', 'description']);

const shouldWrap$Ref = (obj) =>
  // js doesn't have a built-in for testing set equality, who knew!
  isEqual(new Set(Object.keys(obj)), WRAPPABLE_OBJ_KEYS);

const transformReference = ($refStr) => `#/definitions${$refStr}`;
const transformId = (idStr) => `#${idStr.slice(1)}`;

// was going to re-use `data.recurseReplace`, but needed to modify the key and look at objects as a whole
// so, something more custom
const recurse = (item, replacerFunc) => {
  if (isPlainObject(item)) {
    // if an object has only a description and a reference, we need to wrap it to preserve the target class comments
    if (shouldWrap$Ref(item)) {
      return {
        description: item.description,
        oneOf: [
          {
            $ref: transformReference(item.$ref),
          },
        ],
      };
    }

    // if there's no description (just a $ref), no need to wrap
    if (item.$ref) {
      const { $ref, ...remaining } = item;
      return { ...recurse(remaining), $ref: transformReference($ref) };
    }

    // if there's no $ref at all, keep recursing, etc
    return Object.entries(item).reduce(
      (output, [key, val]) => ({ ...output, [key]: recurse(val) }),
      {}
    );
  }

  if (Array.isArray(item)) {
    return item.map(recurse);
  }

  // base case!
  return item;
};

// if this file moves, this breaks
const exportedSchema = require('zapier-platform-schema/exported-schema.json');

/**
 * need to recurse the whole tree and make the following changes:
 *
 * top-level:
 *   rename all `id` keys to `$id`
 *   replace leading `/` of ID value with `#`
 * add a leading `#/definitions` to all `$ref` values
 * if a value is an object with only the `$ref` and `description` keys, wrap the `$ref` in a single-length `oneOf` array
 *   this is probably a bug in `json-schema-to-typescript`, see https://github.com/bcherny/json-schema-to-typescript/issues/334
 */

const recursed = Object.entries(exportedSchema.schemas).reduce(
  (output, [schemaName, schema]) => {
    const { id, ...restOfSchema } = schema;
    return {
      ...output,
      [schemaName]: { ...recurse(restOfSchema), $id: transformId(id) },
    };
  },
  {}
);

// App Schema is special and gets pulled to the top-level. Everything else gets put under `definitions` (previously "schemas")
const { AppSchema, ...definitions } = recursed;

const result = { definitions, ...AppSchema, title: 'Zapier Integration' };

compile(result, '', {
  // default comment with some zapier-specific tips
  bannerComment:
    '/* tslint:disable */\n/* eslint-disable */\n/**\n* This file was automatically generated by json-schema-to-typescript.\n* DO NOT MODIFY IT BY HAND. Instead, modify the source JSONSchema file,\n* and run `yarn gen-defs` in the `core` repo to regenerate this file.\n*/',
}).then((ts) =>
  writeFileSync(path.join(__dirname, '..', 'types', 'schemas.d.ts'), ts)
);
