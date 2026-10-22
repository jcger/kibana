/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { httpServiceMock } from '@kbn/core/server/mocks';
import type { ConnectorSpecSummary } from '../../../../common/connector_spec';
import { getAllConnectorSpecsResponseSchemaV1 } from '../../../../common/routes/connector/response';
import { licenseStateMock } from '../../../lib/license_state.mock';
import { mockHandlerArguments } from '../../_mock_handler_arguments';
import { verifyAccessAndContext } from '../../verify_access_and_context';
import { DEFAULT_ACTION_ROUTE_SECURITY } from '../../constants';
import { specsClientMock } from '../../../specs_client/specs_client.mock';
import { getAllConnectorSpecsRoute } from './get_all_specs';

jest.mock('../../verify_access_and_context', () => ({
  verifyAccessAndContext: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (verifyAccessAndContext as jest.Mock).mockImplementation((license, handler) => handler);
});

const summary: ConnectorSpecSummary = {
  id: 'test-connector',
  displayName: 'Test Connector',
  description: 'A test connector',
  minimumLicense: 'gold',
  isTechnicalPreview: false,
  supportedFeatureIds: ['alerting'],
  availability: {
    enabled: true,
    enabledInConfig: true,
    enabledInLicense: true,
    isDeprecated: false,
  },
  authTypeIds: ['basic'],
  isTestable: true,
  hasInboundEvents: false,
  isInboundOnly: false,
  isEarsExperimental: false,
  actions: [{ name: 'ping', isTool: true, scope: 'read' }],
};

describe('getAllConnectorSpecsRoute', () => {
  it('registers the route with correct path', () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAllConnectorSpecsRoute(router, licenseState);

    expect(router.get).toHaveBeenCalledTimes(1);
    const [config] = router.get.mock.calls[0];
    expect(config.path).toBe('/internal/actions/connector_types/specs');
  });

  it('registers the route with access internal', () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAllConnectorSpecsRoute(router, licenseState);

    const [config] = router.get.mock.calls[0];
    expect(config.options?.access).toBe('internal');
  });

  it('registers the route with default actions route security', () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();

    getAllConnectorSpecsRoute(router, licenseState);

    const [config] = router.get.mock.calls[0];
    expect(config.security).toEqual(DEFAULT_ACTION_ROUTE_SECURITY);
  });

  it('forwards feature_id as featureId', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();
    const specsClient = specsClientMock.create();
    specsClient.getAll.mockResolvedValue([summary]);

    getAllConnectorSpecsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];
    const [context, req, res] = mockHandlerArguments(
      { specsClient },
      { query: { feature_id: 'workflows' } },
      ['ok']
    );

    await handler(context, req, res);

    expect(specsClient.getAll).toHaveBeenCalledWith({ featureId: 'workflows' });
  });

  it('calls getAll with featureId undefined when query is absent', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();
    const specsClient = specsClientMock.create();
    specsClient.getAll.mockResolvedValue([summary]);

    getAllConnectorSpecsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];
    const [context, req, res] = mockHandlerArguments({ specsClient }, { query: {} }, ['ok']);

    await handler(context, req, res);

    expect(specsClient.getAll).toHaveBeenCalledWith({ featureId: undefined });
  });

  it('returns only enabled summaries, keeping enabled deprecated ones', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();
    const specsClient = specsClientMock.create();
    const enabledDeprecated: ConnectorSpecSummary = {
      ...summary,
      id: 'deprecated-connector',
      availability: { ...summary.availability, isDeprecated: true },
    };
    const disabledInConfig: ConnectorSpecSummary = {
      ...summary,
      id: 'disabled-connector',
      availability: {
        enabled: false,
        enabledInConfig: false,
        enabledInLicense: true,
        isDeprecated: false,
      },
    };
    specsClient.getAll.mockResolvedValue([summary, disabledInConfig, enabledDeprecated]);

    getAllConnectorSpecsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];
    const [context, req, res] = mockHandlerArguments({ specsClient }, { query: {} }, ['ok']);

    await handler(context, req, res);

    const body = (res.ok as jest.Mock).mock.calls[0][0].body;
    expect(body.map((item: { id: string }) => item.id)).toEqual([
      'test-connector',
      'deprecated-connector',
    ]);
  });

  it('returns an empty list when every summary is disabled', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();
    const specsClient = specsClientMock.create();
    specsClient.getAll.mockResolvedValue([
      {
        ...summary,
        availability: {
          enabled: false,
          enabledInConfig: false,
          enabledInLicense: false,
          isDeprecated: false,
        },
      },
    ]);

    getAllConnectorSpecsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];
    const [context, req, res] = mockHandlerArguments({ specsClient }, { query: {} }, ['ok']);

    await handler(context, req, res);

    expect((res.ok as jest.Mock).mock.calls[0][0].body).toEqual([]);
  });

  it('returns 200 body from specsClient.getAll that validates and has no schemas', async () => {
    const licenseState = licenseStateMock.create();
    const router = httpServiceMock.createRouter();
    const specsClient = specsClientMock.create();
    specsClient.getAll.mockResolvedValue([summary]);

    getAllConnectorSpecsRoute(router, licenseState);

    const [, handler] = router.get.mock.calls[0];
    const [context, req, res] = mockHandlerArguments({ specsClient }, { query: {} }, ['ok']);

    await handler(context, req, res);

    expect(res.ok).toHaveBeenCalled();
    const body = (res.ok as jest.Mock).mock.calls[0][0].body;
    expect(() => getAllConnectorSpecsResponseSchemaV1.validate(body)).not.toThrow();
    expect(body[0]).not.toHaveProperty('schema');
    expect(body[0].actions[0]).not.toHaveProperty('input_schema');
  });
});
