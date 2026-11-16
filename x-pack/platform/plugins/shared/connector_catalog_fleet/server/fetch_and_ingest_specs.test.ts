/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { loggingSystemMock } from '@kbn/core/server/mocks';
import { fetchAndIngestConnectorSpecs, isConnectorSpecPath } from './fetch_and_ingest_specs';
import { CONNECTOR_SPECS_PACKAGE_NAME } from './constants';
import type { ConnectorCatalogIngestContract, ConnectorSpecsPackageClient } from './types';

interface ArchiveEntry {
  path: string;
  buffer?: Buffer;
}

const PKG_ROOT = `${CONNECTOR_SPECS_PACKAGE_NAME}-1.0.0`;
const OKTA_YAML = 'id: .fleet_poc_okta\nversion: 1.0.0\n';
const OTHER_YAML = 'id: .other\nversion: 1.0.0\n';

const entries: ArchiveEntry[] = [
  { path: `${PKG_ROOT}/manifest.yml`, buffer: Buffer.from('name: x') },
  { path: `${PKG_ROOT}/connector_specs/okta.yml`, buffer: Buffer.from(OKTA_YAML) },
  { path: `${PKG_ROOT}/connector_specs/other.yaml`, buffer: Buffer.from(OTHER_YAML) },
  { path: `${PKG_ROOT}/connector_specs/README.md`, buffer: Buffer.from('# readme') },
  { path: `${PKG_ROOT}/docs/connector_specs.yml`, buffer: Buffer.from('nope') },
];

const createPackageClient = (
  response: Partial<Awaited<ReturnType<ConnectorSpecsPackageClient['getPackage']>>> = {}
) => {
  const packageClient = {
    fetchFindLatestPackage: jest.fn().mockResolvedValue({ version: '1.0.0' }),
    getPackage: jest.fn().mockResolvedValue({
      paths: entries.map(({ path }) => path),
      packageInfo: {},
      ...response,
    }),
  };
  return packageClient as typeof packageClient & ConnectorSpecsPackageClient;
};

const createConnectorCatalog = () => ({
  ingestDefinitions: jest.fn<
    ReturnType<ConnectorCatalogIngestContract['ingestDefinitions']>,
    Parameters<ConnectorCatalogIngestContract['ingestDefinitions']>
  >(async () => ({ registered: 2 })),
});

describe('isConnectorSpecPath', () => {
  it.each([
    [`${PKG_ROOT}/connector_specs/a.yml`, true],
    [`${PKG_ROOT}/connector_specs/a.yaml`, true],
    [`${PKG_ROOT}/connector_specs/a.json`, false],
    [`${PKG_ROOT}/connector_specs/`, false],
    [`${PKG_ROOT}/kibana/connector_specs/a.yml`, false],
    [`connector_specs/a.yml`, false],
  ])('%s -> %s', (path, expected) => {
    expect(isConnectorSpecPath(path)).toBe(expected);
  });
});

describe('fetchAndIngestConnectorSpecs', () => {
  const logger = loggingSystemMock.createLogger();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads specs from the archive iterator and ingests them', async () => {
    const traverseEntries = jest.fn(
      async (
        onEntry: (entry: ArchiveEntry) => Promise<void>,
        readBuffer?: (path: string) => boolean
      ) => {
        for (const entry of entries) {
          await onEntry(readBuffer?.(entry.path) ? entry : { path: entry.path });
        }
      }
    );
    const packageClient = createPackageClient({
      archiveIterator: { traverseEntries, getPaths: jest.fn() },
    });
    const connectorCatalog = createConnectorCatalog();

    const result = await fetchAndIngestConnectorSpecs({ packageClient, connectorCatalog, logger });

    expect(packageClient.fetchFindLatestPackage).toHaveBeenCalledWith(CONNECTOR_SPECS_PACKAGE_NAME);
    expect(packageClient.getPackage).toHaveBeenCalledWith(CONNECTOR_SPECS_PACKAGE_NAME, '1.0.0');
    expect(connectorCatalog.ingestDefinitions).toHaveBeenCalledWith({
      catalogVersion: '1.0.0',
      yamls: [OKTA_YAML, OTHER_YAML],
    });
    expect(result).toEqual({ registered: 2 });
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('falls back to the assets map when there is no archive iterator', async () => {
    const packageClient = createPackageClient({
      assetsMap: new Map(entries.map(({ path, buffer }) => [path, buffer])),
    });
    const connectorCatalog = createConnectorCatalog();

    await fetchAndIngestConnectorSpecs({ packageClient, connectorCatalog, logger });

    expect(connectorCatalog.ingestDefinitions).toHaveBeenCalledWith({
      catalogVersion: '1.0.0',
      yamls: [OKTA_YAML, OTHER_YAML],
    });
  });

  it('does not call ingest when the package has no specs', async () => {
    const packageClient = createPackageClient({ paths: [], assetsMap: new Map() });
    const connectorCatalog = createConnectorCatalog();

    const result = await fetchAndIngestConnectorSpecs({ packageClient, connectorCatalog, logger });

    expect(result).toEqual({ registered: 0 });
    expect(connectorCatalog.ingestDefinitions).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('logs a warning and stops when Fleet fails', async () => {
    const packageClient = createPackageClient();
    packageClient.fetchFindLatestPackage.mockRejectedValue(new Error('registry down'));
    const connectorCatalog = createConnectorCatalog();

    const result = await fetchAndIngestConnectorSpecs({ packageClient, connectorCatalog, logger });

    expect(result).toBeUndefined();
    expect(packageClient.getPackage).not.toHaveBeenCalled();
    expect(connectorCatalog.ingestDefinitions).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('registry down'));
  });

  it('logs a warning when ingest fails', async () => {
    const packageClient = createPackageClient({
      assetsMap: new Map(entries.map(({ path, buffer }) => [path, buffer])),
    });
    const connectorCatalog = createConnectorCatalog();
    connectorCatalog.ingestDefinitions.mockRejectedValue(new Error('storage failed'));

    const result = await fetchAndIngestConnectorSpecs({ packageClient, connectorCatalog, logger });

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('storage failed'));
  });
});
