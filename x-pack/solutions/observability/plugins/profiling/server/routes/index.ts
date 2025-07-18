/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { ElasticsearchClient } from '@kbn/core-elasticsearch-server';
import type { KibanaRequest } from '@kbn/core-http-server';
import type { IRouter, Logger } from '@kbn/core/server';
import type { ProfilingConfig } from '..';
import type {
  ProfilingPluginSetupDeps,
  ProfilingPluginStartDeps,
  ProfilingRequestHandlerContext,
  TelemetryUsageCounter,
} from '../types';
import type { ProfilingESClient } from '../utils/create_profiling_es_client';
import { registerTopNFunctionsAPMTransactionsRoute } from './apm';
import { registerFlameChartSearchRoute } from './flamechart';
import { registerTopNFunctionsSearchRoute } from './functions';
import { registerSetupRoute } from './setup/route';
import { registerStorageExplorerRoute } from './storage_explorer/route';
import {
  registerTraceEventsTopNContainersSearchRoute,
  registerTraceEventsTopNDeploymentsSearchRoute,
  registerTraceEventsTopNExecutablesSearchRoute,
  registerTraceEventsTopNHostsSearchRoute,
  registerTraceEventsTopNStackTracesSearchRoute,
  registerTraceEventsTopNThreadsSearchRoute,
} from './topn';

export interface RouteRegisterParameters {
  router: IRouter<ProfilingRequestHandlerContext>;
  logger: Logger;
  dependencies: {
    start: ProfilingPluginStartDeps;
    setup: ProfilingPluginSetupDeps;
    config: ProfilingConfig;
    stackVersion: string;
    telemetryUsageCounter?: TelemetryUsageCounter;
  };
  services: {
    createProfilingEsClient: (params: {
      request: KibanaRequest;
      esClient: ElasticsearchClient;
      useDefaultAuth?: boolean;
    }) => ProfilingESClient;
  };
}

export const IDLE_SOCKET_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function registerRoutes(params: RouteRegisterParameters) {
  registerFlameChartSearchRoute(params);
  registerTopNFunctionsSearchRoute(params);
  registerTraceEventsTopNContainersSearchRoute(params);
  registerTraceEventsTopNDeploymentsSearchRoute(params);
  registerTraceEventsTopNExecutablesSearchRoute(params);
  registerTraceEventsTopNHostsSearchRoute(params);
  registerTraceEventsTopNStackTracesSearchRoute(params);
  registerTraceEventsTopNThreadsSearchRoute(params);
  // Setup of Profiling resources, automates the configuration of Universal Profiling
  // and will show instructions on how to add data
  registerSetupRoute(params);
  registerStorageExplorerRoute(params);
  registerTopNFunctionsAPMTransactionsRoute(params);
}
