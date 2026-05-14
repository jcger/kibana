/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { isError } from 'lodash';

export class ConnectorResponseSizeLimitError extends Error {
  public readonly limitBytes?: number;
  public readonly contentLengthBytes?: number;
  public readonly estimatedOutputBytes?: number;

  constructor({
    message,
    limitBytes,
    contentLengthBytes,
    estimatedOutputBytes,
  }: {
    message: string;
    limitBytes?: number;
    contentLengthBytes?: number;
    estimatedOutputBytes?: number;
  }) {
    super(message);
    this.name = 'ConnectorResponseSizeLimitError';
    this.limitBytes = limitBytes;
    this.contentLengthBytes = contentLengthBytes;
    this.estimatedOutputBytes = estimatedOutputBytes;
  }
}

export const isConnectorResponseSizeLimitError = (
  error: unknown
): error is ConnectorResponseSizeLimitError =>
  error instanceof ConnectorResponseSizeLimitError ||
  (isError(error) && error.name === 'ConnectorResponseSizeLimitError');
