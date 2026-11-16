/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createHash } from 'crypto';
import { loggingSystemMock } from '@kbn/core/server/mocks';
import { licensingMock } from '@kbn/licensing-plugin/server/mocks';
import { taskManagerMock } from '@kbn/task-manager-plugin/server/mocks';
import { ACTION_TYPE_SOURCES } from '@kbn/actions-types';
import { actionsConfigMock } from '../../actions_config.mock';
import { ActionTypeRegistry } from '../../action_type_registry';
import { licenseStateMock } from '../license_state.mock';
import type { PluginSetupContract as ActionsPluginSetupContract } from '../../plugin';
import { loadFixture } from '../declarative_connectors/__fixtures__/load_fixture';
import { buildTypeFromStoredSpec } from './build_type_from_stored_spec';
import { ingestCatalogDefinitions } from './ingest_catalog_definitions';
import type {
  CatalogDefinitionRef,
  ConnectorCatalogStorage,
  StoredCatalogAsset,
  StoredCatalogDefinition,
  StoredCatalogManifest,
} from './types';

jest.mock('../get_custom_agents', () => ({
  getCustomAgents: jest.fn().mockReturnValue({
    httpAgent: undefined,
    httpsAgent: undefined,
  }),
}));

// Same spec as the Fleet PoC package: the okta fixture with a unique id, no icon, and no auth prefix
// (the parser rejects `auth.prefix`).
const FLEET_POC_OKTA_YAML = loadFixture('okta-1.0.0.yaml')
  .replace(/^id: \.okta$/m, 'id: .fleet_poc_okta')
  .replace(/^ {2}displayName: .*$/m, '  displayName: Okta (Fleet PoC)')
  .replace(/^ {2}icon:\n( {4}.*\n)+/m, '')
  .replace(/^ {6}prefix: .*\n/m, '');

const createInMemoryStorage = () => {
  const definitions = new Map<string, StoredCatalogDefinition>();
  let manifest: StoredCatalogManifest | undefined;
  const key = ({ id, version }: CatalogDefinitionRef) => `${id}@${version}`;

  const storage: jest.Mocked<ConnectorCatalogStorage> = {
    getManifest: jest.fn(async () => manifest),
    getDefinitions: jest.fn(async (refs: CatalogDefinitionRef[]) =>
      refs.flatMap((ref) => {
        const definition = definitions.get(key(ref));
        return definition ? [definition] : [];
      })
    ),
    createDefinition: jest.fn(async (definition: StoredCatalogDefinition) => {
      const id = key({ id: definition.connectorId, version: definition.version });
      if (definitions.has(id)) {
        return { created: false };
      }
      definitions.set(id, definition);
      return { created: true };
    }),
    createAsset: jest.fn(async (_asset: StoredCatalogAsset) => ({ created: true })),
    replaceManifest: jest.fn(async (next: StoredCatalogManifest) => {
      manifest = next;
    }),
  };
  return storage;
};

const setup = () => {
  const licenseState = licenseStateMock.create();
  licenseState.isLicenseValidForActionType.mockReturnValue({ isValid: true });
  const configUtils = actionsConfigMock.create();
  const actionTypeRegistry = new ActionTypeRegistry({
    licensing: licensingMock.createSetup(),
    taskManager: taskManagerMock.createSetup(),
    taskRunnerFactory: { create: jest.fn() } as never,
    actionsConfigUtils: configUtils,
    licenseState,
    inMemoryConnectors: [],
  });
  const actions = {
    getActionsConfigurationUtilities: () => configUtils,
    getAxiosInstanceWithAuth: jest.fn(),
    getCredential: jest.fn(),
    getClientLeasePool: jest.fn(),
  } as unknown as ActionsPluginSetupContract;
  const logger = loggingSystemMock.create().get();
  const storage = createInMemoryStorage();
  const deps = {
    isEnabled: jest.fn().mockResolvedValue(true),
    storage,
    actionTypeRegistry,
    buildType: (definition: StoredCatalogDefinition) =>
      buildTypeFromStoredSpec(definition, actions),
    logger,
  };
  return { actionTypeRegistry, storage, logger, deps };
};

describe('ingestCatalogDefinitions', () => {
  it('stores the YAML, writes the manifest, and registers .fleet_poc_okta', async () => {
    const { actionTypeRegistry, storage, deps } = setup();

    const result = await ingestCatalogDefinitions(
      { catalogVersion: '1.0.0', yamls: [FLEET_POC_OKTA_YAML] },
      deps
    );

    expect(result).toEqual({ registered: 1 });
    expect(storage.createDefinition).toHaveBeenCalledWith({
      connectorId: '.fleet_poc_okta',
      version: '1.0.0',
      yaml: FLEET_POC_OKTA_YAML,
      contentHash: `sha256:${createHash('sha256').update(FLEET_POC_OKTA_YAML).digest('hex')}`,
      catalogVersion: '1.0.0',
    });
    expect(storage.replaceManifest).toHaveBeenCalledWith({
      raw: JSON.stringify({ connectors: [{ id: '.fleet_poc_okta', version: '1.0.0' }] }),
    });
    expect(actionTypeRegistry.has('.fleet_poc_okta')).toBe(true);
    expect(actionTypeRegistry.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '.fleet_poc_okta',
          name: 'Okta (Fleet PoC)',
          source: ACTION_TYPE_SOURCES.spec,
        }),
      ])
    );
  });

  it('skips an invalid YAML with a warning and still registers the valid one', async () => {
    const { actionTypeRegistry, storage, logger, deps } = setup();

    const result = await ingestCatalogDefinitions(
      { catalogVersion: '1.0.0', yamls: ['id: [unclosed', FLEET_POC_OKTA_YAML] },
      deps
    );

    expect(result).toEqual({ registered: 1 });
    expect(storage.createDefinition).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Skipping invalid connector catalog definition')
    );
    expect(actionTypeRegistry.has('.fleet_poc_okta')).toBe(true);
  });

  it('registers nothing new on a second ingest of the same YAML', async () => {
    const { deps } = setup();
    const input = { catalogVersion: '1.0.0', yamls: [FLEET_POC_OKTA_YAML] };

    await ingestCatalogDefinitions(input, deps);
    const result = await ingestCatalogDefinitions(input, deps);

    expect(result).toEqual({ registered: 0 });
  });

  it('stores nothing and registers nothing when the catalog flag is off', async () => {
    const { actionTypeRegistry, storage, logger, deps } = setup();
    deps.isEnabled.mockResolvedValue(false);

    const result = await ingestCatalogDefinitions(
      { catalogVersion: '1.0.0', yamls: [FLEET_POC_OKTA_YAML] },
      deps
    );

    expect(result).toEqual({ registered: 0 });
    expect(storage.createDefinition).not.toHaveBeenCalled();
    expect(storage.replaceManifest).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('disabled'));
    expect(actionTypeRegistry.has('.fleet_poc_okta')).toBe(false);
  });
});
