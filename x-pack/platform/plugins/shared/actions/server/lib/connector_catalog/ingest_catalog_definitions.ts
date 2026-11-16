/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { createHash } from 'crypto';
import type { Logger } from '@kbn/core/server';
import type { ActionTypeRegistry } from '../../action_type_registry';
import { parseDeclarativeConnectorSpec } from '../declarative_connectors';
import { loadCatalogConnectorTypes } from './load_catalog_connector_types';
import type {
  CatalogActionType,
  CatalogDefinitionRef,
  ConnectorCatalogStorage,
  StoredCatalogDefinition,
} from './types';

export interface IngestCatalogDefinitionsInput {
  /** Version of the source that delivers the specs, for example a package version. */
  catalogVersion: string;
  /** Raw YAML spec files. */
  yamls: string[];
}

export interface IngestCatalogDefinitionsResult {
  registered: number;
}

interface IngestCatalogDefinitionsDeps {
  isEnabled: () => Promise<boolean>;
  storage: ConnectorCatalogStorage;
  actionTypeRegistry: Pick<ActionTypeRegistry, 'has' | 'register'>;
  buildType: (definition: StoredCatalogDefinition) => CatalogActionType;
  logger: Logger;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getContentHash = (yaml: string): string =>
  `sha256:${createHash('sha256').update(yaml, 'utf8').digest('hex')}`;

/** Stores the given YAML specs in the connector catalog and registers their types. */
export const ingestCatalogDefinitions = async (
  { catalogVersion, yamls }: IngestCatalogDefinitionsInput,
  { isEnabled, storage, actionTypeRegistry, buildType, logger }: IngestCatalogDefinitionsDeps
): Promise<IngestCatalogDefinitionsResult> => {
  if (!(await isEnabled())) {
    logger.info('The connector catalog is disabled. Skipping ingest of connector definitions.');
    return { registered: 0 };
  }

  const definitions: StoredCatalogDefinition[] = [];
  const seenIds = new Set<string>();
  for (const yaml of yamls) {
    let ref: CatalogDefinitionRef;
    try {
      const { id, version } = parseDeclarativeConnectorSpec(yaml);
      ref = { id, version };
    } catch (error) {
      logger.warn(`Skipping invalid connector catalog definition: ${getErrorMessage(error)}`);
      continue;
    }
    if (seenIds.has(ref.id)) {
      logger.warn(`Skipping duplicate connector catalog definition "${ref.id}".`);
      continue;
    }
    seenIds.add(ref.id);
    definitions.push({
      connectorId: ref.id,
      version: ref.version,
      yaml,
      contentHash: getContentHash(yaml),
      catalogVersion,
    });
  }

  for (const definition of definitions) {
    const { created } = await storage.createDefinition(definition);
    if (!created) {
      logger.debug(
        `Connector catalog definition "${definition.connectorId}" version ${definition.version} is already stored.`
      );
    }
  }

  await storage.replaceManifest({
    raw: JSON.stringify({
      connectors: definitions.map(({ connectorId, version }) => ({ id: connectorId, version })),
    }),
  });

  const registered = await loadCatalogConnectorTypes({
    storage,
    actionTypeRegistry,
    buildType,
    logger,
    signal: new AbortController().signal,
  });
  logger.info(
    `Ingested ${definitions.length} connector catalog definition(s) for catalog version ${catalogVersion}, registered ${registered} new connector type(s).`
  );
  return { registered };
};
