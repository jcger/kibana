/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { RulesSettingsAlertDeleteProperties } from '@kbn/alerting-types';
import {
  alertDeleteCategoryIds,
  type AlertDeleteCategoryIds,
} from '../../../../../common/constants/alert_delete';
import type {
  AlertDeletePreviewQueryV1,
  AlertDeleteScheduleQueryV1,
} from '../../../../../common/routes/alert_delete';

// Accepting single category id or array of category ids because
// sending an array of just one element is decoded as a simple string
const getCategoryIds = (input: AlertDeleteCategoryIds | AlertDeleteCategoryIds[] | undefined) => {
  if (!input)
    return [
      alertDeleteCategoryIds.MANAGEMENT,
      alertDeleteCategoryIds.SECURITY_SOLUTION,
      alertDeleteCategoryIds.OBSERVABILITY,
    ];
  return Array.isArray(input) ? input : [input];
};

export const transformRequestToAlertDeletePreview = ({
  is_active_alert_delete_enabled: isActiveAlertDeleteEnabled,
  is_inactive_alert_delete_enabled: isInactiveAlertDeleteEnabled,
  active_alert_delete_threshold: activeAlertDeleteThreshold,
  inactive_alert_delete_threshold: inactiveAlertDeleteThreshold,
  category_ids: _categoryIds,
}: AlertDeletePreviewQueryV1): RulesSettingsAlertDeleteProperties => {
  return {
    isActiveAlertDeleteEnabled,
    isInactiveAlertDeleteEnabled,
    activeAlertDeleteThreshold,
    inactiveAlertDeleteThreshold,
    categoryIds: getCategoryIds(_categoryIds),
  };
};

export const transformRequestToAlertDeleteSchedule = ({
  is_active_alert_delete_enabled: isActiveAlertDeleteEnabled,
  is_inactive_alert_delete_enabled: isInactiveAlertDeleteEnabled,
  active_alert_delete_threshold: activeAlertDeleteThreshold,
  inactive_alert_delete_threshold: inactiveAlertDeleteThreshold,
  category_ids: categoryIds,
}: AlertDeleteScheduleQueryV1): RulesSettingsAlertDeleteProperties => {
  return {
    isActiveAlertDeleteEnabled,
    isInactiveAlertDeleteEnabled,
    activeAlertDeleteThreshold,
    inactiveAlertDeleteThreshold,
    categoryIds: getCategoryIds(categoryIds),
  };
};
