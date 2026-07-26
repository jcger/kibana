/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { McpClient, McpConnectionError } from '@kbn/mcp-client';
import { createMcpFetch } from '../mcp/create_mcp_fetch';
import type { BuildContext, ClientTypeSpec } from './client_type_spec';
import type { ConfiguredFetchFactory } from './configured_fetch_types';

const DEFAULT_MCP_CLIENT_VERSION = '1.0.0';

/**
 * Dependencies the MCP client type closes over. These are outbound-HTTP concerns specific to the
 * MCP client type and intentionally do not travel through the generic `BuildContext`, so non-HTTP
 * client types stay unaffected.
 */
export interface McpClientTypeDeps {
  configuredFetchFactory?: ConfiguredFetchFactory;
  defaultHeaders?: Readonly<Record<string, string>>;
  requestTimeout?: number;
}

/**
 * Factory for the registered client type behind `ctx.getClient('mcp')`.
 *
 * Build creates an `McpClient` using the `ConfiguredFetchFactory` closed over via `deps` (which
 * applies SSL/TLS, proxy, and User-Agent policy from the Actions config). If no factory is
 * available, falls back to the built-in Fetch API so the type remains usable in unit tests and
 * contexts where the factory has not been wired yet.
 *
 * `isUserError` classifies 401 and 403 HTTP statuses (from `McpConnectionError.httpStatus`) as
 * user errors so that the executor can surface them as non-retryable USER errors rather than
 * FRAMEWORK errors.
 */
export const createMcpClientType = (deps: McpClientTypeDeps = {}): ClientTypeSpec<McpClient> => ({
  id: 'mcp',

  async build(ctx: BuildContext): Promise<McpClient> {
    const serverUrl = typeof ctx.config?.serverUrl === 'string' ? ctx.config.serverUrl : undefined;

    if (!serverUrl) {
      throw new McpConnectionError('config.serverUrl is required', { httpStatus: undefined });
    }

    ctx.network.ensureUriAllowed(serverUrl);

    let customFetch: ((url: string | URL, init?: RequestInit) => Promise<Response>) | undefined;

    if (deps.configuredFetchFactory) {
      const resource = deps.configuredFetchFactory({
        targetUrl: serverUrl,
        ...(deps.defaultHeaders ? { headers: deps.defaultHeaders } : {}),
      });
      customFetch = createMcpFetch(resource);
    }

    const client = new McpClient(
      ctx.logger,
      {
        name: `kibana-mcp-${serverUrl}`,
        version: DEFAULT_MCP_CLIENT_VERSION,
        url: serverUrl,
      },
      {
        ...(deps.defaultHeaders ? { headers: { ...deps.defaultHeaders } } : {}),
        ...(customFetch ? { fetch: customFetch } : {}),
      }
    );

    await client.connect(deps.requestTimeout ? { timeout: deps.requestTimeout } : undefined);

    return client;
  },

  async terminate(client: McpClient): Promise<void> {
    try {
      await client.terminateSession();
    } catch {
      // best-effort
    }
    await client.disconnect();
  },

  isUserError(err: unknown): boolean {
    if (err instanceof McpConnectionError) {
      return (
        typeof err.httpStatus === 'number' && (err.httpStatus === 401 || err.httpStatus === 403)
      );
    }
    return false;
  },
});
