/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@kbn/react-query';
import { ACTION_TYPE_SOURCES } from '@kbn/actions-types';
import { useKibana } from '../../common/lib/kibana';
import { loadActionTypes } from '../lib/action_connector_api';
import type { ActionType } from '../../types';
import { useConnectorActionType } from './use_connector_action_type';

jest.mock('../../common/lib/kibana');
jest.mock('../lib/action_connector_api', () => ({
  ...jest.requireActual('../lib/action_connector_api'),
  loadActionTypes: jest.fn(),
}));

const useKibanaMock = useKibana as jest.Mocked<typeof useKibana>;
const loadActionTypesMock = loadActionTypes as jest.MockedFunction<typeof loadActionTypes>;

const stackConnectorType: ActionType = {
  id: '.test',
  name: 'Test',
  enabled: true,
  enabledInConfig: true,
  enabledInLicense: true,
  minimumLicenseRequired: 'basic',
  supportedFeatureIds: ['alerting'],
  source: ACTION_TYPE_SOURCES.stack,
  isSystemActionType: false,
  isDeprecated: false,
};

const specConnectorType: ActionType = {
  id: 'spec-connector-test',
  name: 'Spec Connector Test',
  enabled: true,
  enabledInConfig: true,
  enabledInLicense: true,
  minimumLicenseRequired: 'basic',
  supportedFeatureIds: ['workflows'],
  source: ACTION_TYPE_SOURCES.spec,
  testable: true,
  isSystemActionType: false,
  isDeprecated: false,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, cacheTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useConnectorActionType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useKibanaMock().services.http = jest.fn() as any;
  });

  it('returns the matching ActionType by id from an unfiltered list', async () => {
    loadActionTypesMock.mockResolvedValue([stackConnectorType, specConnectorType]);

    const { result } = renderHook(
      () => useConnectorActionType({ actionTypeId: stackConnectorType.id }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.actionType).toEqual(stackConnectorType));
    expect(loadActionTypesMock).toHaveBeenCalledWith({ http: useKibanaMock().services.http });
  });

  it('returns undefined when the action type is not found', async () => {
    loadActionTypesMock.mockResolvedValue([stackConnectorType]);

    const { result } = renderHook(
      () => useConnectorActionType({ actionTypeId: 'missing-connector-type' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.actionType).toBeUndefined();
  });

  it('does not fetch when enabled is false', async () => {
    renderHook(
      () => useConnectorActionType({ actionTypeId: stackConnectorType.id, enabled: false }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(loadActionTypesMock).not.toHaveBeenCalled());
  });

  it('surfaces spec types that are absent from the registry', async () => {
    loadActionTypesMock.mockResolvedValue([specConnectorType]);

    const { result } = renderHook(
      () => useConnectorActionType({ actionTypeId: specConnectorType.id }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.actionType).toEqual(specConnectorType));
  });
});
