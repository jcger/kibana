/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import type { AxiosInstance } from 'axios';
import type { Logger } from '@kbn/logging';

export interface ConnectorNetwork {
  ensureUriAllowed(url: string): void;
  ensureHostnameAllowed(host: string): void;
}

export interface CredentialAccessor {
  getAuthHeaders(): Promise<Record<string, string>>;
}

export interface BuildContext {
  logger: Logger;
  axiosInstance: AxiosInstance;
  config?: Record<string, unknown>;
  network: ConnectorNetwork;
  credential: CredentialAccessor;
}

export interface ClientTypeSpec<TClient> {
  id: string;
  build(ctx: BuildContext): Promise<TClient>;
  terminate(client: TClient): Promise<void>;
  isUserError?(err: unknown): boolean;
}
