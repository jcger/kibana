/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { CoreSetup, CoreStart, Plugin, PluginInitializerContext } from '@kbn/core/server';
import type { Logger } from '@kbn/logging';
import { fetchAndIngestConnectorSpecs } from './fetch_and_ingest_specs';
import type { ConnectorCatalogFleetStartDeps } from './types';

export class ConnectorCatalogFleetPlugin
  implements Plugin<void, void, object, ConnectorCatalogFleetStartDeps>
{
  private readonly logger: Logger;

  // Core only creates the plugin when xpack.connectorCatalogFleet.enabled is true.
  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get();
  }

  public setup(_core: CoreSetup<ConnectorCatalogFleetStartDeps>) {}

  public start(_core: CoreStart, { actions, fleet }: ConnectorCatalogFleetStartDeps) {
    // Runs in the background, never blocks or fails Kibana start.
    // whenCatalogReady() makes sure the actions catalog flag value has arrived before ingest.
    void Promise.all([fleet.fleetSetupCompleted(), actions.whenCatalogReady()])
      .then(() =>
        fetchAndIngestConnectorSpecs({
          packageClient: fleet.packageService.asInternalUser,
          connectorCatalog: actions.connectorCatalog,
          logger: this.logger,
        })
      )
      .catch((error) => {
        this.logger.warn(`Fleet setup did not complete, skipping connector specs: ${error}`);
      });
  }

  public stop() {}
}
