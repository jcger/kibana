/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { PluginStartContract as ActionsPluginStart } from '@kbn/actions-plugin/server';
import type { FleetStartContract } from '@kbn/fleet-plugin/server';

export type ConnectorCatalogIngestContract = ActionsPluginStart['connectorCatalog'];

export interface ConnectorCatalogFleetStartDeps {
  actions: ActionsPluginStart;
  fleet: FleetStartContract;
}

export type ConnectorSpecsPackageClient = Pick<
  FleetStartContract['packageService']['asInternalUser'],
  'fetchFindLatestPackage' | 'getPackage'
>;
