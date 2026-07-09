/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { AuthContext } from '../connector_spec';
import { BearerAuth } from './bearer';

describe('BearerAuth', () => {
  it('getAuthHeaders returns the bearer Authorization header', async () => {
    const mockCtx: AuthContext = {
      logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never,
      getCustomHostSettings: () => undefined,
      getToken: async () => null,
      sslSettings: {} as never,
    };

    const headers = await BearerAuth.getAuthHeaders?.(mockCtx, { token: 'my-secret-token' });

    expect(headers).toEqual({ Authorization: 'Bearer my-secret-token' });
  });
});
