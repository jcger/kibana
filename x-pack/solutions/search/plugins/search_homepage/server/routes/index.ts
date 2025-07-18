/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IRouter } from '@kbn/core/server';
import type { Logger } from '@kbn/logging';

import { registerStatusRoutes } from './status';
import { registerApiKeyRoutes } from './api_key_routes';

export function defineRoutes(router: IRouter, logger: Logger) {
  registerApiKeyRoutes(router, logger);
  registerStatusRoutes(router, logger);
}
