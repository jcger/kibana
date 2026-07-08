/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';

import { actionTypeRegistryMock } from '../../../action_type_registry.mock';
import userEvent from '@testing-library/user-event';
import { waitFor, screen } from '@testing-library/react';
import EditConnectorFlyout from '.';
import { ACTION_TYPE_SOURCES } from '@kbn/actions-types';
import type { ActionType } from '../../../../types';
import { EditConnectorTabs } from '../../../../types';
import { createMockActionConnector } from '@kbn/alerts-ui-shared/src/common/test_utils/connector.mock';
import type { AppMockRenderer } from '../../test_utils';
import { createAppMockRenderer } from '../../test_utils';

jest.mock('../../../lib/action_connector_api', () => ({
  ...(jest.requireActual('../../../lib/action_connector_api') as object),
  loadActionTypes: jest.fn(),
  checkConnectorIdAvailability: jest.fn().mockResolvedValue({ isAvailable: true }),
}));

const { loadActionTypes } = jest.requireMock('../../../lib/action_connector_api');

describe('spec connector edit flyout Test tab', () => {
  let appMockRenderer: AppMockRenderer;
  const onClose = jest.fn();
  const onConnectorUpdated = jest.fn();

  const actionTypeRegistry = actionTypeRegistryMock.create();

  const specConnectorType: ActionType = {
    id: 'spec-connector-test',
    name: 'Spec Connector Test',
    enabled: true,
    enabledInConfig: true,
    enabledInLicense: true,
    minimumLicenseRequired: 'basic',
    supportedFeatureIds: ['workflows'],
    source: ACTION_TYPE_SOURCES.spec,
    description: 'Test spec connector description',
    isTestable: true,
    isSystemActionType: false,
    isDeprecated: false,
  };

  const mockSpecResponse = {
    metadata: {
      id: 'spec-connector-test',
      display_name: 'Spec Connector Test',
      description: 'Connect to Test API',
      minimum_license: 'basic',
      supported_feature_ids: ['workflows'],
    },
    schema: {
      type: 'object',
      properties: {
        config: {
          type: 'object',
          properties: {},
        },
        secrets: {
          anyOf: [
            {
              type: 'object',
              properties: {
                authType: { const: 'api_key_header', type: 'string' },
                apiKey: {
                  type: 'string',
                  minLength: 1,
                  label: 'API key',
                  sensitive: true,
                },
              },
              required: ['authType', 'apiKey'],
              label: 'API key header authentication',
            },
          ],
          label: 'Authentication',
        },
      },
      required: ['config', 'secrets'],
    },
  };

  const specConnector = createMockActionConnector({
    id: 'spec-connector-id',
    name: 'Spec Connector Test',
    actionTypeId: 'spec-connector-test',
    config: {},
    secrets: {},
  });

  beforeEach(() => {
    jest.clearAllMocks();
    appMockRenderer = createAppMockRenderer();
    appMockRenderer.coreStart.application.capabilities = {
      ...appMockRenderer.coreStart.application.capabilities,
      actions: { save: true, show: true, execute: true },
    };
    actionTypeRegistry.has.mockReturnValue(false);
    appMockRenderer.coreStart.http.get = jest.fn().mockResolvedValue(mockSpecResponse);
    appMockRenderer.coreStart.uiSettings.get = jest.fn().mockImplementation((key: string) => {
      if (key === 'workflows:ui:enabled') {
        return true;
      }
      return undefined;
    });
  });

  it('renders the test form for a spec connector without throwing', async () => {
    appMockRenderer.render(
      <EditConnectorFlyout
        actionTypeRegistry={actionTypeRegistry}
        connector={specConnector}
        onClose={onClose}
        onConnectorUpdated={onConnectorUpdated}
        tab={EditConnectorTabs.Test}
        isTestable={true}
        connectorActionType={specConnectorType}
      />
    );

    expect(await screen.findByTestId('edit-connector-flyout')).toBeInTheDocument();
    expect(await screen.findByTestId('test-connector-form')).toBeInTheDocument();
    expect(screen.queryByText('Create an action')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(appMockRenderer.coreStart.http.get).toHaveBeenCalledWith(
        '/internal/actions/connector_types/spec-connector-test/spec',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });
  });

  it('shows loading state on the Test tab while fetching spec', async () => {
    let resolveSpec: (value: typeof mockSpecResponse) => void;
    const specPromise = new Promise<typeof mockSpecResponse>((resolve) => {
      resolveSpec = resolve;
    });
    appMockRenderer.coreStart.http.get = jest.fn().mockReturnValue(specPromise);

    appMockRenderer.render(
      <EditConnectorFlyout
        actionTypeRegistry={actionTypeRegistry}
        connector={specConnector}
        onClose={onClose}
        onConnectorUpdated={onConnectorUpdated}
        tab={EditConnectorTabs.Test}
        isTestable={true}
        connectorActionType={specConnectorType}
      />
    );

    await waitFor(() => {
      expect(appMockRenderer.coreStart.http.get).toHaveBeenCalled();
    });

    expect(screen.queryByTestId('test-connector-form')).not.toBeInTheDocument();

    resolveSpec!(mockSpecResponse);

    expect(await screen.findByTestId('test-connector-form')).toBeInTheDocument();
  });

  it('shows error state on the Test tab when spec fetch fails and retries', async () => {
    const errorMessage = 'Failed to fetch spec';
    appMockRenderer.coreStart.http.get = jest
      .fn()
      .mockRejectedValueOnce(new Error(errorMessage))
      .mockResolvedValueOnce(mockSpecResponse);

    appMockRenderer.render(
      <EditConnectorFlyout
        actionTypeRegistry={actionTypeRegistry}
        connector={specConnector}
        onClose={onClose}
        onConnectorUpdated={onConnectorUpdated}
        tab={EditConnectorTabs.Test}
        isTestable={true}
        connectorActionType={specConnectorType}
      />
    );

    await waitFor(() => {
      expect(appMockRenderer.coreStart.http.get).toHaveBeenCalledWith(
        '/internal/actions/connector_types/spec-connector-test/spec',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      );
    });

    expect(await screen.findByTestId('connector-spec-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('test-connector-form')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('connector-spec-load-retry'));

    expect(await screen.findByTestId('test-connector-form')).toBeInTheDocument();
    expect(appMockRenderer.coreStart.http.get).toHaveBeenCalledTimes(2);
  });
});

describe('default (no isTestable prop) — embedder path', () => {
  let appMockRenderer: AppMockRenderer;
  const onClose = jest.fn();
  const onConnectorUpdated = jest.fn();
  const actionTypeRegistry = actionTypeRegistryMock.create();

  const stackConnector = createMockActionConnector({
    id: 'stack-connector-id',
    name: 'Stack Connector',
    actionTypeId: '.test',
    config: {},
    secrets: {},
  });

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

  const specConnector = createMockActionConnector({
    id: 'spec-connector-id',
    name: 'Spec Connector Test',
    actionTypeId: 'spec-connector-test',
    config: {},
    secrets: {},
  });

  const actionTypeModel = actionTypeRegistryMock.createMockActionTypeModel();

  beforeEach(() => {
    jest.clearAllMocks();
    appMockRenderer = createAppMockRenderer();
    appMockRenderer.coreStart.application.capabilities = {
      ...appMockRenderer.coreStart.application.capabilities,
      actions: { save: true, show: true, execute: true },
    };
    actionTypeRegistry.has.mockImplementation((id: string) => id === '.test');
    actionTypeRegistry.get.mockReturnValue(actionTypeModel);
  });

  const renderEmbedderFlyout = (connector: typeof stackConnector) =>
    appMockRenderer.render(
      <EditConnectorFlyout
        actionTypeRegistry={actionTypeRegistry}
        connector={connector}
        onClose={onClose}
        onConnectorUpdated={onConnectorUpdated}
      />
    );

  it('shows the test tab for a stack connector', async () => {
    loadActionTypes.mockResolvedValue([stackConnectorType]);

    renderEmbedderFlyout(stackConnector);

    expect(await screen.findByTestId('testConnectorTab')).toBeInTheDocument();
  });

  it('hides the test tab for a non-testable spec connector', async () => {
    loadActionTypes.mockResolvedValue([
      {
        ...stackConnectorType,
        id: 'spec-connector-test',
        source: ACTION_TYPE_SOURCES.spec,
        isTestable: false,
      },
    ]);

    renderEmbedderFlyout(specConnector);

    expect(await screen.findByTestId('configureConnectorTab')).toBeInTheDocument();
    expect(screen.queryByTestId('testConnectorTab')).not.toBeInTheDocument();
  });

  it('shows the test tab for a testable spec connector', async () => {
    loadActionTypes.mockResolvedValue([
      {
        ...stackConnectorType,
        id: 'spec-connector-test',
        source: ACTION_TYPE_SOURCES.spec,
        isTestable: true,
      },
    ]);
    actionTypeRegistry.has.mockReturnValue(false);
    appMockRenderer.coreStart.http.get = jest.fn().mockResolvedValue({
      metadata: {
        id: 'spec-connector-test',
        display_name: 'Spec Connector Test',
        description: 'Connect to Test API',
        minimum_license: 'basic',
        supported_feature_ids: ['workflows'],
      },
      schema: {
        type: 'object',
        properties: {
          config: { type: 'object', properties: {} },
          secrets: {
            anyOf: [
              {
                type: 'object',
                properties: {
                  authType: { const: 'api_key_header', type: 'string' },
                  apiKey: { type: 'string', minLength: 1, label: 'API key', sensitive: true },
                },
                required: ['authType', 'apiKey'],
                label: 'API key header authentication',
              },
            ],
            label: 'Authentication',
          },
        },
        required: ['config', 'secrets'],
      },
    });
    appMockRenderer.coreStart.uiSettings.get = jest.fn().mockImplementation((key: string) => {
      if (key === 'workflows:ui:enabled') {
        return true;
      }
      return undefined;
    });

    renderEmbedderFlyout(specConnector);

    expect(await screen.findByTestId('testConnectorTab')).toBeInTheDocument();
  });

  it('hides the test tab when connector types are unavailable', async () => {
    loadActionTypes.mockResolvedValue([]);

    renderEmbedderFlyout(stackConnector);

    expect(await screen.findByTestId('configureConnectorTab')).toBeInTheDocument();
    expect(screen.queryByTestId('testConnectorTab')).not.toBeInTheDocument();
  });

  it('hides the test tab when connector types fail to load', async () => {
    loadActionTypes.mockRejectedValue(new Error('Failed to load connector types'));

    expect(() => renderEmbedderFlyout(stackConnector)).not.toThrow();

    expect(await screen.findByTestId('configureConnectorTab')).toBeInTheDocument();
    expect(screen.queryByTestId('testConnectorTab')).not.toBeInTheDocument();
  });
});
