/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { useMutation } from '@tanstack/react-query';
import type { HttpStart } from '@kbn/core-http-browser';
import type { IHttpFetchError, ResponseErrorBody } from '@kbn/core-http-browser';
import { BASE_ALERTING_API_PATH } from '../constants';

export interface AlertDeleteScheduleApiCallRequestBody {
  isActiveAlertDeleteEnabled: boolean;
  isInactiveAlertDeleteEnabled: boolean;
  activeAlertDeleteThreshold: number;
  inactiveAlertDeleteThreshold: number;
  categoryIds?: string[]; // TODO: send it
}
export interface AlertDeleteScheduleApiCallParams {
  http: HttpStart;
  requestBody: AlertDeleteScheduleApiCallRequestBody;
}
export const alertDeleteScheduleApiCall = async ({
  http,
  requestBody: {
    isActiveAlertDeleteEnabled,
    isInactiveAlertDeleteEnabled,
    activeAlertDeleteThreshold,
    inactiveAlertDeleteThreshold,
  },
}: AlertDeleteScheduleApiCallParams) => {
  return http.post(`${BASE_ALERTING_API_PATH}/rules/settings/_alert_delete_schedule`, {
    body: JSON.stringify({
      is_active_alert_delete_enabled: isActiveAlertDeleteEnabled,
      is_inactive_alert_delete_enabled: isInactiveAlertDeleteEnabled,
      active_alert_delete_threshold: activeAlertDeleteThreshold,
      inactive_alert_delete_threshold: inactiveAlertDeleteThreshold,
    }),
  });
};

export interface UseAlertDeleteScheduleParams {
  http: HttpStart;
  onSuccess: () => void;
  onError: (error: IHttpFetchError<ResponseErrorBody>) => void;
}
export const useAlertDeleteSchedule = ({
  http,
  onSuccess,
  onError,
}: UseAlertDeleteScheduleParams) => {
  const mutation = useMutation({
    mutationFn: async (requestBody: AlertDeleteScheduleApiCallRequestBody) => {
      return alertDeleteScheduleApiCall({
        http,
        requestBody,
      });
    },
    onSuccess,
    onError,
  });

  return mutation;
};
