/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger } from '@kbn/logging';
import { CONNECTOR_SPECS_FOLDER, CONNECTOR_SPECS_PACKAGE_NAME } from './constants';
import type { ConnectorCatalogIngestContract, ConnectorSpecsPackageClient } from './types';

type PackageResponse = Awaited<ReturnType<ConnectorSpecsPackageClient['getPackage']>>;

// Archive paths look like '<name>-<version>/connector_specs/<file>.yml'.
export const isConnectorSpecPath = (path: string): boolean => {
  const [, folder, ...rest] = path.split('/');
  const fileName = rest.join('/');
  return (
    folder === CONNECTOR_SPECS_FOLDER &&
    fileName.length > 0 &&
    (fileName.endsWith('.yml') || fileName.endsWith('.yaml'))
  );
};

const readSpecYamls = async ({
  paths,
  assetsMap,
  archiveIterator,
}: PackageResponse): Promise<string[]> => {
  const yamls: string[] = [];

  if (archiveIterator) {
    await archiveIterator.traverseEntries(
      async ({ path, buffer }) => {
        if (isConnectorSpecPath(path) && buffer) {
          yamls.push(buffer.toString('utf8'));
        }
      },
      (path) => isConnectorSpecPath(path)
    );
    return yamls;
  }

  for (const path of paths.filter(isConnectorSpecPath)) {
    const buffer = assetsMap?.get(path);
    if (buffer) {
      yamls.push(buffer.toString('utf8'));
    }
  }
  return yamls;
};

/** Fetches the connector specs package from Fleet (no install) and ingests its YAML specs. */
export const fetchAndIngestConnectorSpecs = async ({
  packageClient,
  connectorCatalog,
  logger,
}: {
  packageClient: ConnectorSpecsPackageClient;
  connectorCatalog: ConnectorCatalogIngestContract;
  logger: Logger;
}): Promise<{ registered: number } | undefined> => {
  try {
    const { version } = await packageClient.fetchFindLatestPackage(CONNECTOR_SPECS_PACKAGE_NAME);
    const packageResponse = await packageClient.getPackage(CONNECTOR_SPECS_PACKAGE_NAME, version);
    const yamls = await readSpecYamls(packageResponse);

    if (yamls.length === 0) {
      logger.warn(
        `No connector specs found in ${CONNECTOR_SPECS_PACKAGE_NAME}-${version} under ${CONNECTOR_SPECS_FOLDER}/`
      );
      return { registered: 0 };
    }

    const result = await connectorCatalog.ingestDefinitions({ catalogVersion: version, yamls });
    logger.info(
      `Ingested ${yamls.length} connector specs from ${CONNECTOR_SPECS_PACKAGE_NAME}-${version}, registered ${result.registered} connector types`
    );
    return result;
  } catch (error) {
    logger.warn(
      `Failed to load connector specs from Fleet package ${CONNECTOR_SPECS_PACKAGE_NAME}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return undefined;
  }
};
