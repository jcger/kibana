/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { HttpSetup } from '@kbn/core-http-browser';
import { INTERNAL_API_BASE_PATH } from '../../common';
import { sendRequest } from '../shared_imports';

/**
 * Index Management public API service
 */
export class PublicApiService {
  private http: HttpSetup;

  /**
   * constructor
   * @param http http dependency
   */
  constructor(http: HttpSetup) {
    this.http = http;
  }

  /**
   * Gets a list of all the enrich policies
   */
  getAllEnrichPolicies() {
    return sendRequest(this.http, {
      path: `${INTERNAL_API_BASE_PATH}/enrich_policies`,
      method: 'get',
    });
  }
}
