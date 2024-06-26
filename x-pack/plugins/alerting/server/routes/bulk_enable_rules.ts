/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { schema } from '@kbn/config-schema';
import { IRouter } from '@kbn/core/server';
import { verifyAccessAndContext, handleDisabledApiKeysError } from './lib';
import { ILicenseState, RuleTypeDisabledError } from '../lib';
import { AlertingRequestHandlerContext, INTERNAL_BASE_ALERTING_API_PATH } from '../types';

export const bulkEnableRulesRoute = ({
  router,
  licenseState,
}: {
  router: IRouter<AlertingRequestHandlerContext>;
  licenseState: ILicenseState;
}) => {
  router.patch(
    {
      path: `${INTERNAL_BASE_ALERTING_API_PATH}/rules/_bulk_enable`,
      validate: {
        body: schema.object({
          filter: schema.maybe(schema.string()),
          ids: schema.maybe(schema.arrayOf(schema.string(), { minSize: 1, maxSize: 1000 })),
        }),
      },
    },
    handleDisabledApiKeysError(
      router.handleLegacyErrors(
        verifyAccessAndContext(licenseState, async (context, req, res) => {
          const rulesClient = (await context.alerting).getRulesClient();
          const { filter, ids } = req.body;

          try {
            const bulkEnableResults = await rulesClient.bulkEnableRules({ filter, ids });

            const resultBody = {
              body: {
                ...bulkEnableResults,
                // TODO We need to fix this API to return snake case like every other API
                rules: bulkEnableResults.rules.map(({ actions, systemActions, ...rule }) => {
                  return { ...rule, actions: [...actions, ...(systemActions ?? [])] };
                }),
              },
            };

            return res.ok(resultBody);
          } catch (e) {
            if (e instanceof RuleTypeDisabledError) {
              return e.sendResponse(res);
            }
            throw e;
          }
        })
      )
    )
  );
};
