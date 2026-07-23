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

const DEFAULT_MCP_CLIENT_VERSION = '1.0.0';

/**
 * Registered client type for `ctx.getClient('mcp')`.
 *
 * Build creates an `McpClient` using the `ConfiguredFetchFactory` from the `BuildContext` (which
 * applies SSL/TLS, proxy, and User-Agent policy from the Actions config). If no factory is
 * available, falls back to the built-in Fetch API so the type remains usable in unit tests and
 * contexts where the factory has not been wired yet.
 *
 * `isUserError` classifies 401 and 403 HTTP statuses (from `McpConnectionError.httpStatus`) as
 * user errors so that the executor can surface them as non-retryable USER errors rather than
 * FRAMEWORK errors.
 */
export const mcpClientType: ClientTypeSpec<McpClient> = {
  id: 'mcp',

  async build(ctx: BuildContext): Promise<McpClient> {
    const serverUrl = typeof ctx.config?.serverUrl === 'string' ? ctx.config.serverUrl : undefined;

    if (!serverUrl) {
      throw new McpConnectionError('config.serverUrl is required', { httpStatus: undefined });
    }

    ctx.network.ensureUriAllowed(serverUrl);

    let customFetch: ((url: string | URL, init?: RequestInit) => Promise<Response>) | undefined;

    if (ctx.configuredFetchFactory) {
      const resource = ctx.configuredFetchFactory({
        targetUrl: serverUrl,
        ...(ctx.defaultHeaders ? { headers: ctx.defaultHeaders } : {}),
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
        ...(ctx.defaultHeaders ? { headers: { ...ctx.defaultHeaders } } : {}),
        ...(customFetch ? { fetch: customFetch } : {}),
      }
    );

    await client.connect(ctx.requestTimeout ? { timeout: ctx.requestTimeout } : undefined);

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
};
