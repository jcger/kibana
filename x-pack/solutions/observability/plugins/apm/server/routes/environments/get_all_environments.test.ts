/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { getAllEnvironments } from './get_all_environments';
import type { SearchParamsMock } from '../../utils/test_helpers';
import { inspectSearchParams } from '../../utils/test_helpers';

describe('getAllEnvironments', () => {
  let mock: SearchParamsMock;

  afterEach(() => {
    mock.teardown();
  });

  it('fetches all environments', async () => {
    mock = await inspectSearchParams(({ mockApmEventClient }) =>
      getAllEnvironments({
        searchAggregatedTransactions: false,
        serviceName: 'test',
        apmEventClient: mockApmEventClient,
        size: 50,
      })
    );

    expect(mock.params).toMatchSnapshot();
  });

  it('fetches all environments with includeMissing', async () => {
    mock = await inspectSearchParams(({ mockApmEventClient }) =>
      getAllEnvironments({
        includeMissing: true,
        searchAggregatedTransactions: false,
        serviceName: 'test',
        apmEventClient: mockApmEventClient,
        size: 50,
      })
    );

    expect(mock.params).toMatchSnapshot();
  });
});
