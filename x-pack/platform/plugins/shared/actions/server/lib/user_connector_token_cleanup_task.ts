/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { Logger, CoreSetup } from '@kbn/core/server';
import type {
  TaskManagerSetupContract,
  TaskManagerStartContract,
  IntervalSchedule,
  ConcreteTaskInstance,
} from '@kbn/task-manager-plugin/server';
import type { ActionsPluginsStart } from '../plugin';
import { UserConnectorTokenClient } from './user_connector_token_client';
import { USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE } from '../constants/saved_objects';

export const USER_CONNECTOR_TOKEN_CLEANUP_TASK_TYPE = 'actions:user_connector_token_cleanup';
export const USER_CONNECTOR_TOKEN_CLEANUP_TASK_ID = `Actions-${USER_CONNECTOR_TOKEN_CLEANUP_TASK_TYPE}`;
export const USER_CONNECTOR_TOKEN_CLEANUP_SCHEDULE: IntervalSchedule = { interval: '1d' };

interface TaskState extends Record<string, unknown> {
  runs: number;
  last_cleanup_count: number;
}

const emptyState: TaskState = {
  runs: 0,
  last_cleanup_count: 0,
};

export function initializeUserConnectorTokenCleanupTask(
  logger: Logger,
  taskManager: TaskManagerSetupContract,
  core: CoreSetup<ActionsPluginsStart>
) {
  registerUserConnectorTokenCleanupTask(logger, taskManager, core);
}

export function scheduleUserConnectorTokenCleanupTask(
  logger: Logger,
  taskManager: TaskManagerStartContract
) {
  scheduleTask(logger, taskManager).catch(() => {
    // catch to prevent unhandled promise rejection
  });
}

function registerUserConnectorTokenCleanupTask(
  logger: Logger,
  taskManager: TaskManagerSetupContract,
  core: CoreSetup<ActionsPluginsStart>
) {
  taskManager.registerTaskDefinitions({
    [USER_CONNECTOR_TOKEN_CLEANUP_TASK_TYPE]: {
      title: 'User connector token cleanup task',
      description: 'Periodically removes stale per-user OAuth connector tokens',
      timeout: '1m',
      createTaskRunner: ({ taskInstance }: { taskInstance: ConcreteTaskInstance }) => {
        return {
          run: async () => {
            const state = taskInstance.state as TaskState;

            try {
              const [coreStart, { encryptedSavedObjects }] = await core.getStartServices();

              const unsecuredSavedObjectsClient = coreStart.savedObjects.createInternalRepository([
                USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE,
              ]);
              const encryptedSavedObjectsClient = encryptedSavedObjects.getClient({
                includedHiddenTypes: [USER_CONNECTOR_TOKEN_SAVED_OBJECT_TYPE],
              });
              const userConnectorTokenClient = new UserConnectorTokenClient({
                encryptedSavedObjectsClient,
                unsecuredSavedObjectsClient,
                logger: logger.get('user_connector_token_cleanup'),
              });

              const cleanupCount = await userConnectorTokenClient.cleanupStaleTokens();

              const updatedState: TaskState = {
                runs: (state.runs || 0) + 1,
                last_cleanup_count: cleanupCount,
              };

              return {
                state: updatedState,
                schedule: USER_CONNECTOR_TOKEN_CLEANUP_SCHEDULE,
              };
            } catch (error) {
              logger.error(
                `User connector token cleanup task failed: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );

              return {
                state: {
                  runs: (state.runs || 0) + 1,
                  last_cleanup_count: 0,
                },
                schedule: USER_CONNECTOR_TOKEN_CLEANUP_SCHEDULE,
              };
            }
          },
        };
      },
    },
  });
}

async function scheduleTask(logger: Logger, taskManager: TaskManagerStartContract) {
  try {
    await taskManager.ensureScheduled({
      id: USER_CONNECTOR_TOKEN_CLEANUP_TASK_ID,
      taskType: USER_CONNECTOR_TOKEN_CLEANUP_TASK_TYPE,
      state: emptyState,
      params: {},
      schedule: USER_CONNECTOR_TOKEN_CLEANUP_SCHEDULE,
    });
  } catch (e) {
    logger.error(
      `Error scheduling ${USER_CONNECTOR_TOKEN_CLEANUP_TASK_ID}, received ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}
