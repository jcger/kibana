/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { z } from '@kbn/zod/v4';
import { addMeta, getMeta } from '../connector_spec_ui';

const CHECK_KIND_TO_ISSUE_CODE: Record<string, string> = {
  min_length: 'too_small',
};

interface ErrorMessagesMeta {
  errorMessages?: Record<string, string>;
}

interface ZodCheckWithDef {
  _zod?: {
    def?: {
      check?: string;
      error?: (issue: { code: string; input?: unknown }) => unknown;
    };
  };
}

interface ZodSchemaDef {
  type?: string;
  shape?: Record<string, z.ZodType>;
  options?: z.ZodType[];
  innerType?: z.ZodType;
  element?: z.ZodType;
  checks?: ZodCheckWithDef[];
}

type ZodTypeWithDef = z.ZodType & {
  _zod: {
    def: ZodSchemaDef;
  };
};

const getSchemaDef = (schema: z.ZodType): ZodSchemaDef | undefined => {
  return (schema as ZodTypeWithDef)._zod?.def;
};

const walk = (schema: z.ZodType, visitor: (node: z.ZodType) => void): void => {
  visitor(schema);

  const def = getSchemaDef(schema);
  if (!def?.type) {
    return;
  }

  switch (def.type) {
    case 'object':
      for (const child of Object.values(def.shape ?? {})) {
        walk(child, visitor);
      }
      return;
    case 'union':
      for (const option of def.options ?? []) {
        walk(option, visitor);
      }
      return;
    case 'optional':
    case 'default':
      if (def.innerType) {
        walk(def.innerType, visitor);
      }
      return;
    case 'array':
      if (def.element) {
        walk(def.element, visitor);
      }
  }
};

const getStaticCheckMessage = (check: ZodCheckWithDef): string | undefined => {
  const errorFn = check._zod?.def?.error;
  if (typeof errorFn !== 'function') {
    return undefined;
  }

  const message = errorFn({ code: 'too_small' });
  const probeMessage = errorFn({ code: 'too_small', input: '__static_probe__' });
  if (typeof message !== 'string' || message !== probeMessage) {
    return undefined;
  }

  return message;
};

export const attachErrorMessagesMeta = (schema: z.ZodType): void => {
  walk(schema, (node) => {
    const def = getSchemaDef(node);
    if (def?.type !== 'string') {
      return;
    }

    const errorMessages: Record<string, string> = {};

    for (const check of def.checks ?? []) {
      const checkKind = check._zod?.def?.check;
      if (!checkKind) {
        continue;
      }

      const issueCode = CHECK_KIND_TO_ISSUE_CODE[checkKind];
      const message = getStaticCheckMessage(check);
      if (!issueCode || !message) {
        continue;
      }

      errorMessages[issueCode] = message;
    }

    if (Object.keys(errorMessages).length > 0) {
      addMeta(node, { errorMessages });
    }
  });
};

export const applyErrorMessagesFromMeta = (schema: z.ZodType): void => {
  walk(schema, (node) => {
    const def = getSchemaDef(node);
    if (def?.type !== 'string') {
      return;
    }

    const errorMessages = (getMeta(node) as ErrorMessagesMeta).errorMessages;
    if (!errorMessages || Object.keys(errorMessages).length === 0) {
      return;
    }

    for (const check of def.checks ?? []) {
      const checkDef = check._zod?.def;
      if (!checkDef?.check) {
        continue;
      }

      const issueCode = CHECK_KIND_TO_ISSUE_CODE[checkDef.check];
      const message = issueCode && errorMessages[issueCode];
      if (!message) {
        continue;
      }

      checkDef.error = () => message;
    }
  });
};
