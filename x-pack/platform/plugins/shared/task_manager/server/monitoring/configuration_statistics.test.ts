/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { Subject } from 'rxjs';
import { take, bufferCount } from 'rxjs';
import { createConfigurationAggregator } from './configuration_statistics';
import type { TaskManagerConfig } from '../config';
import { taskPollingLifecycleMock } from '../polling_lifecycle.mock';

describe('Configuration Statistics Aggregator', () => {
  let mockTaskPollingLifecycle = taskPollingLifecycleMock.create({});
  const capacityConfiguration$ = new Subject<number>();
  const pollIntervalConfiguration$ = new Subject<number>();

  beforeEach(() => {
    mockTaskPollingLifecycle = taskPollingLifecycleMock.create({
      capacityConfiguration$,
      pollIntervalConfiguration$,
    });
  });

  test('merges the static config with the merged configs', async () => {
    const configuration: TaskManagerConfig = {
      discovery: {
        active_nodes_lookback: '30s',
        interval: 10000,
      },
      kibanas_per_partition: 2,
      max_attempts: 9,
      poll_interval: 6000000,
      allow_reading_invalid_state: false,
      version_conflict_threshold: 80,
      monitored_stats_required_freshness: 6000000,
      request_capacity: 1000,
      monitored_aggregated_stats_refresh_rate: 5000,
      monitored_stats_health_verbose_log: {
        enabled: false,
        level: 'debug' as const,
        warn_delayed_task_start_in_seconds: 60,
      },
      monitored_stats_running_average_window: 50,
      monitored_task_execution_thresholds: {
        default: {
          error_threshold: 90,
          warn_threshold: 80,
        },
        custom: {},
      },
      unsafe: {
        exclude_task_types: [],
        authenticate_background_task_utilization: true,
      },
      event_loop_delay: {
        monitor: true,
        warn_threshold: 5000,
      },
      worker_utilization_running_average_window: 5,
      metrics_reset_interval: 3000,
      claim_strategy: 'update_by_query',
      request_timeouts: {
        update_by_query: 1000,
      },
      auto_calculate_default_ech_capacity: false,
    };

    return new Promise<void>(async (resolve, reject) => {
      try {
        createConfigurationAggregator(configuration, 10, mockTaskPollingLifecycle)
          .pipe(take(2), bufferCount(2))
          .subscribe(([initial, updatedWorkers]) => {
            expect(initial.value).toEqual({
              capacity: {
                config: 10,
                as_workers: 10,
                as_cost: 20,
              },
              claim_strategy: 'update_by_query',
              poll_interval: 6000000,
              request_capacity: 1000,
              monitored_aggregated_stats_refresh_rate: 5000,
              monitored_stats_running_average_window: 50,
              monitored_task_execution_thresholds: {
                default: {
                  error_threshold: 90,
                  warn_threshold: 80,
                },
                custom: {},
              },
            });
            expect(updatedWorkers.value).toEqual({
              capacity: {
                config: 8,
                as_workers: 8,
                as_cost: 16,
              },
              claim_strategy: 'update_by_query',
              poll_interval: 6000000,
              request_capacity: 1000,
              monitored_aggregated_stats_refresh_rate: 5000,
              monitored_stats_running_average_window: 50,
              monitored_task_execution_thresholds: {
                default: {
                  error_threshold: 90,
                  warn_threshold: 80,
                },
                custom: {},
              },
            });
            resolve();
          }, reject);
        capacityConfiguration$.next(8);
      } catch (error) {
        reject(error);
      }
    });
  });
});
