/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { PluginInitializer, PluginInitializerContext } from '@kbn/core/public';
import { Plugin } from './plugin';
import type { MetricsDataPluginSetup, MetricsDataPluginStart, RouteState } from './types';
import { useAssetDetailsRedirect } from './pages/link_to';

export const plugin: PluginInitializer<MetricsDataPluginSetup, MetricsDataPluginStart> = (
  context: PluginInitializerContext
) => {
  return new Plugin(context);
};

export type { MetricsDataPluginSetup, MetricsDataPluginStart };

export type { RouteState };

export { useAssetDetailsRedirect };
