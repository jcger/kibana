/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IRouter } from '@kbn/core/server';
import { alertDeleteScheduleQuerySchemaV1 } from '../../../../../common/routes/alert_delete';
import type { ILicenseState } from '../../../../lib';
import type { AlertingRequestHandlerContext } from '../../../../types';
import { INTERNAL_BASE_ALERTING_API_PATH } from '../../../../types';
import { verifyAccessAndContext } from '../../../lib';
import { API_PRIVILEGES } from '../../../../../common';
import { transformRequestToAlertDeleteScheduleV1 } from '../../transforms';

export const alertDeleteScheduleRoute = (
  router: IRouter<AlertingRequestHandlerContext>,
  licenseState: ILicenseState
) => {
  router.post(
    {
      path: `${INTERNAL_BASE_ALERTING_API_PATH}/rules/settings/_alert_delete_schedule`,
      validate: {
        body: alertDeleteScheduleQuerySchemaV1,
      },
      security: {
        authz: {
          requiredPrivileges: [
            `${API_PRIVILEGES.READ_ALERT_DELETE_SETTINGS}`,
            `${API_PRIVILEGES.WRITE_ALERT_DELETE_SETTINGS}`,
          ],
        },
      },
      options: {
        access: 'internal',
      },
    },
    router.handleLegacyErrors(
      verifyAccessAndContext(licenseState, async function (context, req, res) {
        const alertingContext = await context.alerting;
        const alertDeletionClient = alertingContext.getAlertDeletionClient();
        const rulesClient = await alertingContext.getRulesClient();
        const spaceId = rulesClient.getSpaceId();
        const settings = transformRequestToAlertDeleteScheduleV1(req.body);

        try {
          await alertDeletionClient.scheduleTask(req, settings, [spaceId || 'default']);
          return res.noContent();
        } catch (error) {
          return res.customError({
            statusCode: 500,
            body: {
              message: error.message,
            },
          });
        }
      })
    )
  );
};
