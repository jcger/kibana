/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { ValidationFunc } from '../../hook_form_lib';
import { ERROR_CODE } from './types';

export const isInteger =
  ({ message }: { message: string }) =>
  (...args: Parameters<ValidationFunc>): ReturnType<ValidationFunc<any, ERROR_CODE>> => {
    const [{ value }] = args;

    if (
      value === '' ||
      (typeof value === 'number' && Number.isInteger(value)) ||
      (typeof value === 'string' && Number.isInteger(Number(value)))
    ) {
      return undefined;
    }

    return { message, code: 'ERR_NOT_INT_NUMBER' };
  };
