/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import * as connectorsSpecs from './all_specs';
import type { ActionContext, ConnectorSpec } from './connector_spec';

const TEST_HANDLER_CONFIGS: Record<string, Record<string, unknown>> = {
  '.sublime_security': {
    baseUrl: 'https://example.com',
  },
};

const createFailingContext = (
  config: Record<string, unknown>
): {
  ctx: ActionContext;
  failingRequests: Record<string, jest.Mock>;
} => {
  const rejection = new Error('connection failed');
  const reject = () => Promise.reject(rejection);
  const failingRequests = {
    callable: jest.fn(reject),
    request: jest.fn(reject),
    get: jest.fn(reject),
    delete: jest.fn(reject),
    head: jest.fn(reject),
    options: jest.fn(reject),
    post: jest.fn(reject),
    put: jest.fn(reject),
    patch: jest.fn(reject),
    postForm: jest.fn(reject),
    putForm: jest.fn(reject),
    patchForm: jest.fn(reject),
    query: jest.fn(reject),
  };
  const client = Object.assign(failingRequests.callable, failingRequests);

  return {
    ctx: {
      client,
      config,
      log: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
      },
    } as unknown as ActionContext,
    failingRequests,
  };
};

const didMakeFailingRequest = (failingRequests: Record<string, jest.Mock>): boolean =>
  Object.values(failingRequests).some((request) => request.mock.calls.length > 0);

describe('opted-in connector test handlers', () => {
  const optedInSpecs = Object.entries(connectorsSpecs).filter(
    (entry): entry is [string, ConnectorSpec & { test: NonNullable<ConnectorSpec['test']> }] => {
      const [, spec] = entry;
      return spec.test?.enabled === true;
    }
  );

  it.each(optedInSpecs)(
    '%s test handler must attempt an HTTP request and throw on failure',
    async (_exportName, spec) => {
      const handler = spec.test.handler;
      const config = TEST_HANDLER_CONFIGS[spec.metadata.id] ?? {};
      const { ctx, failingRequests } = createFailingContext(config);

      await expect(handler(ctx)).rejects.toThrow();
      expect(didMakeFailingRequest(failingRequests)).toBe(true);
    }
  );
});
