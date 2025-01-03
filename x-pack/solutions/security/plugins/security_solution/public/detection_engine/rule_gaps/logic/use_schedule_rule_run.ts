/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useCallback } from 'react';
import { useAppToasts } from '../../../common/hooks/use_app_toasts';
import { useKibana } from '../../../common/lib/kibana';
import { useScheduleRuleRunMutation } from '../api/hooks/use_schedule_rule_run_mutation';
import type { ScheduleBackfillProps } from '../types';

import * as i18n from '../translations';
import { ManualRuleRunEventTypes } from '../../../common/lib/telemetry';

export function useScheduleRuleRun() {
  const { mutateAsync } = useScheduleRuleRunMutation();
  const { addError, addSuccess } = useAppToasts();
  const { telemetry } = useKibana().services;

  const scheduleRuleRun = useCallback(
    async (options: ScheduleBackfillProps) => {
      try {
        const results = await mutateAsync(options);
        telemetry.reportEvent(ManualRuleRunEventTypes.ManualRuleRunExecute, {
          rangeInMs: options.timeRange.endDate.diff(options.timeRange.startDate),
          status: 'success',
          rulesCount: options.ruleIds.length,
        });
        addSuccess(i18n.BACKFILL_SCHEDULE_SUCCESS(results.length));
        return results;
      } catch (error) {
        addError(error, { title: i18n.BACKFILL_SCHEDULE_ERROR_TITLE });
        telemetry.reportEvent(ManualRuleRunEventTypes.ManualRuleRunExecute, {
          rangeInMs: options.timeRange.endDate.diff(options.timeRange.startDate),
          status: 'error',
          rulesCount: options.ruleIds.length,
        });
      }
    },
    [addError, addSuccess, mutateAsync, telemetry]
  );

  return { scheduleRuleRun };
}
