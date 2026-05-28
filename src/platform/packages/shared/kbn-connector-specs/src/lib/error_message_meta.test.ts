/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { z, lazySchema } from '@kbn/zod/v4';
import { fromJSONSchema } from '@kbn/zod/v4/from_json_schema';
import { addMeta, getMeta } from '../connector_spec_ui';
import { applyErrorMessagesFromMeta, attachErrorMessagesMeta } from './error_message_meta';

describe('attachErrorMessagesMeta', () => {
  it('writes errorMessages meta on a leaf string', () => {
    const schema = z.string().min(1, { message: 'X' });
    attachErrorMessagesMeta(schema);

    expect(getMeta(schema).errorMessages).toEqual({ too_small: 'X' });
  });

  it('writes meta on the inner string inside an object, not the object', () => {
    const obj = z.object({ field: z.string().min(1, { message: 'X' }) });
    attachErrorMessagesMeta(obj);

    expect(getMeta(obj.shape.field).errorMessages).toEqual({ too_small: 'X' });
    expect(getMeta(obj).errorMessages).toBeUndefined();
  });

  it('writes meta on the inner string inside optional', () => {
    const schema = z.string().min(1, { message: 'X' }).optional();
    attachErrorMessagesMeta(schema);

    expect(getMeta(schema.unwrap()).errorMessages).toEqual({ too_small: 'X' });
  });

  it('writes meta on the array element string', () => {
    const schema = z.array(z.string().min(1, { message: 'X' }));
    attachErrorMessagesMeta(schema);

    expect(getMeta(schema.element).errorMessages).toEqual({ too_small: 'X' });
  });

  it('resolves lazy discriminated union options and writes meta on inner strings', () => {
    const schema = z.discriminatedUnion('kind', [
      lazySchema(() =>
        z.object({
          kind: z.literal('a'),
          name: z.string().min(1, { message: 'X' }),
        })
      ),
    ]);
    attachErrorMessagesMeta(schema);

    const option = schema.options[0] as z.ZodObject<{ kind: z.ZodLiteral<'a'>; name: z.ZodString }>;
    expect(getMeta(option.shape.name).errorMessages).toEqual({ too_small: 'X' });
  });

  it('does not write errorMessages meta when min has no custom message', () => {
    const schema = z.string().min(1);
    attachErrorMessagesMeta(schema);

    expect(getMeta(schema).errorMessages).toBeUndefined();
  });

  it('does not write errorMessages meta for a non-static error function', () => {
    const schema = z.string().min(1, { error: (issue) => `bad ${issue.input}` });
    attachErrorMessagesMeta(schema);

    expect(getMeta(schema).errorMessages).toBeUndefined();
  });
});

describe('applyErrorMessagesFromMeta', () => {
  it('installs check errors from meta so safeParse emits the stored message', () => {
    const schema = z.string().min(1);
    addMeta(schema, { errorMessages: { too_small: 'X' } });

    applyErrorMessagesFromMeta(schema);

    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues[0]?.message).toBe('X');
  });

  it('rehydrates messages through wrapper schemas', () => {
    const schema = z.string().min(1, { message: 'X' }).optional();
    attachErrorMessagesMeta(schema);
    applyErrorMessagesFromMeta(schema);

    const result = schema.safeParse('');
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues[0]?.message).toBe('X');
  });

  it('round-trips errorMessages through JSON Schema and rehydrates parse messages', () => {
    const schema = z.object({ name: z.string().min(1, { message: 'X' }) }).strict();
    attachErrorMessagesMeta(schema);

    const jsonSchema = z.toJSONSchema(schema);
    const overTheWire = JSON.parse(JSON.stringify(jsonSchema));
    const rebuilt = fromJSONSchema(overTheWire, { preserveMeta: true }) as z.ZodObject<{
      name: z.ZodString;
    }>;

    applyErrorMessagesFromMeta(rebuilt);

    const result = rebuilt.safeParse({ name: '' });
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.issues[0]?.message).toBe('X');
  });
});
