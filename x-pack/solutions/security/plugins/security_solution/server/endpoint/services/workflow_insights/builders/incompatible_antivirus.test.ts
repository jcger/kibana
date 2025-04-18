/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import moment from 'moment';

import type { ElasticsearchClient, KibanaRequest } from '@kbn/core/server';
import type { DefendInsightsPostRequestBody } from '@kbn/elastic-assistant-common';

import { ENDPOINT_ARTIFACT_LISTS } from '@kbn/securitysolution-list-constants';

import type { BuildWorkflowInsightParams } from '.';

import {
  Category,
  SourceType,
  TargetType,
  ActionType,
} from '../../../../../common/endpoint/types/workflow_insights';
import { createMockEndpointAppContext } from '../../../mocks';
import type { EndpointMetadataService } from '../../metadata';
import { groupEndpointIdsByOS } from '../helpers';
import { buildIncompatibleAntivirusWorkflowInsights } from './incompatible_antivirus';

jest.mock('../helpers', () => {
  const actualHelpers = jest.requireActual('../helpers');
  return {
    ...actualHelpers,
    groupEndpointIdsByOS: jest.fn(),
  };
});

describe('buildIncompatibleAntivirusWorkflowInsights', () => {
  const mockEndpointAppContextService = createMockEndpointAppContext().service;
  mockEndpointAppContextService.getEndpointMetadataService = jest.fn().mockReturnValue({
    getMetadataForEndpoints: jest.fn(),
  });
  const endpointMetadataService =
    mockEndpointAppContextService.getEndpointMetadataService() as jest.Mocked<EndpointMetadataService>;

  const generateParams = (signerId?: string): BuildWorkflowInsightParams => ({
    defendInsights: [
      {
        group: 'AVGAntivirus',
        events: [
          {
            id: 'lqw5opMB9Ke6SNgnxRSZ',
            endpointId: 'f6e2f338-6fb7-4c85-9c23-d20e9f96a051',
            value: '/Applications/AVGAntivirus.app/Contents/Backend/services/com.avg.activity',
            ...(signerId ? { signerId } : {}),
          },
        ],
      },
    ],
    request: {
      body: {
        insightType: 'incompatible_antivirus',
        endpointIds: ['endpoint-1'],
        apiConfig: {
          connectorId: 'connector-id-1',
          actionTypeId: 'action-type-id-1',
          model: 'model-1',
        },
        anonymizationFields: [],
        subAction: 'invokeAI',
      },
    } as unknown as KibanaRequest<unknown, unknown, DefendInsightsPostRequestBody>,
    endpointMetadataService,
    esClient: {
      search: jest.fn().mockResolvedValue({
        hits: {
          hits: [],
        },
      }),
    } as unknown as ElasticsearchClient,
  });

  const buildExpectedInsight = (os: string, signerField?: string, signerValue?: string) =>
    expect.objectContaining({
      '@timestamp': expect.any(moment),
      message: 'Incompatible antiviruses detected',
      category: Category.Endpoint,
      type: 'incompatible_antivirus',
      source: {
        type: SourceType.LlmConnector,
        id: 'connector-id-1',
        data_range_start: expect.any(moment),
        data_range_end: expect.any(moment),
      },
      target: {
        type: TargetType.Endpoint,
        ids: ['endpoint-1'],
      },
      action: {
        type: ActionType.Refreshed,
        timestamp: expect.any(moment),
      },
      value: `/Applications/AVGAntivirus.app/Contents/Backend/services/com.avg.activity${
        signerValue ? ` ${signerValue}` : ''
      }`,
      remediation: {
        exception_list_items: [
          {
            list_id: ENDPOINT_ARTIFACT_LISTS.trustedApps.id,
            name: 'AVGAntivirus',
            description: 'Suggested by Automatic Troubleshooting',
            entries: [
              {
                field: 'process.executable.caseless',
                operator: 'included',
                type: 'match',
                value: '/Applications/AVGAntivirus.app/Contents/Backend/services/com.avg.activity',
              },
              ...(signerField && signerValue
                ? [
                    {
                      field: signerField,
                      operator: 'included',
                      type: 'match',
                      value: signerValue,
                    },
                  ]
                : []),
            ],
            tags: ['policy:all'],
            os_types: [os],
          },
        ],
      },
      metadata: {
        notes: {
          llm_model: 'model-1',
        },
        display_name: 'AVGAntivirus',
      },
    });

  it('should correctly build workflow insights', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      windows: ['endpoint-1'],
    });
    const params = generateParams();
    const result = await buildIncompatibleAntivirusWorkflowInsights(params);

    expect(result).toEqual([buildExpectedInsight('windows')]);
    expect(groupEndpointIdsByOS).toHaveBeenCalledWith(
      ['endpoint-1'],
      params.endpointMetadataService
    );
  });

  it('should correctly build workflow insights for Windows with signerId provided', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      windows: ['endpoint-1'],
    });
    const params = generateParams('test.com');

    params.esClient.search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'lqw5opMB9Ke6SNgnxRSZ',
            _source: {
              process: {
                Ext: {
                  code_signature: [
                    {
                      trusted: true,
                      subject_name: 'test.com',
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    });

    const result = await buildIncompatibleAntivirusWorkflowInsights(params);

    expect(result).toEqual([
      buildExpectedInsight('windows', 'process.Ext.code_signature', 'test.com'),
    ]);
    expect(groupEndpointIdsByOS).toHaveBeenCalledWith(
      ['endpoint-1'],
      params.endpointMetadataService
    );
  });

  it('should correctly build workflow insights for Windows with signerId provided as object', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      windows: ['endpoint-1'],
    });
    const params = generateParams('test.com');

    params.esClient.search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'lqw5opMB9Ke6SNgnxRSZ',
            _source: {
              process: {
                Ext: {
                  code_signature: {
                    trusted: true,
                    subject_name: 'test.com',
                  },
                },
              },
            },
          },
        ],
      },
    });

    const result = await buildIncompatibleAntivirusWorkflowInsights(params);

    expect(result).toEqual([
      buildExpectedInsight('windows', 'process.Ext.code_signature', 'test.com'),
    ]);
    expect(groupEndpointIdsByOS).toHaveBeenCalledWith(
      ['endpoint-1'],
      params.endpointMetadataService
    );
  });

  it('should fallback to createRemediation without signer field when no valid signatures exist for Windows', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      windows: ['endpoint-1'],
    });

    const params = generateParams('test.com');
    params.esClient.search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'lqw5opMB9Ke6SNgnxRSZ',
            _source: {
              process: {
                Ext: {
                  code_signature: [{ trusted: false, subject_name: 'Untrusted Publisher' }],
                },
              },
            },
          },
        ],
      },
    });

    const result = await buildIncompatibleAntivirusWorkflowInsights(params);
    expect(result).toEqual([buildExpectedInsight('windows')]);
  });

  it('should skip Microsoft Windows Hardware Compatibility Publisher and use the next trusted signature for Windows', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      windows: ['endpoint-1'],
    });

    const params = generateParams();
    params.esClient.search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'lqw5opMB9Ke6SNgnxRSZ',
            _source: {
              process: {
                Ext: {
                  code_signature: [
                    {
                      trusted: true,
                      subject_name: 'Microsoft Windows Hardware Compatibility Publisher',
                    },
                    { trusted: true, subject_name: 'Next Trusted Publisher' },
                  ],
                },
              },
            },
          },
        ],
      },
    });

    const result = await buildIncompatibleAntivirusWorkflowInsights(params);
    expect(result).toEqual([
      buildExpectedInsight('windows', 'process.Ext.code_signature', 'Next Trusted Publisher'),
    ]);
  });

  it('should correctly build workflow insights for MacOS with signerId provided', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      macos: ['endpoint-1'],
    });

    const params = generateParams('test.com');

    params.esClient.search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'lqw5opMB9Ke6SNgnxRSZ',
            _source: {
              process: {
                code_signature: {
                  trusted: true,
                  subject_name: 'test.com',
                },
              },
            },
          },
        ],
      },
    });

    const result = await buildIncompatibleAntivirusWorkflowInsights(params);

    expect(result).toEqual([buildExpectedInsight('macos', 'process.code_signature', 'test.com')]);
    expect(groupEndpointIdsByOS).toHaveBeenCalledWith(
      ['endpoint-1'],
      params.endpointMetadataService
    );
  });

  it('should fallback to createRemediation without signer field for macOS when no code_signature exists', async () => {
    (groupEndpointIdsByOS as jest.Mock).mockResolvedValue({
      macos: ['endpoint-1'],
    });

    const params = generateParams();
    params.esClient.search = jest.fn().mockResolvedValue({
      hits: {
        hits: [
          {
            _id: 'lqw5opMB9Ke6SNgnxRSZ',
            _source: {
              process: {},
            },
          },
        ],
      },
    });

    const result = await buildIncompatibleAntivirusWorkflowInsights(params);
    expect(result).toEqual([buildExpectedInsight('macos')]);
  });
});
