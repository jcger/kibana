/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { useQuery } from '@kbn/react-query';
import { useKibana } from '../../common/lib/kibana';
import { loadActionTypes } from '../lib/action_connector_api';
import type { ActionType } from '../../types';

export interface UseConnectorActionTypeParams {
  actionTypeId: string;
  enabled?: boolean;
}

export const useConnectorActionType = ({
  actionTypeId,
  enabled = true,
}: UseConnectorActionTypeParams): {
  actionType: ActionType | undefined;
  isLoading: boolean;
} => {
  const { http } = useKibana().services;

  const { data, isLoading } = useQuery({
    queryKey: ['loadConnectorTypesForFlyout'],
    queryFn: () => loadActionTypes({ http }),
    enabled,
    refetchOnWindowFocus: false,
  });

  const actionType = data?.find(({ id }) => id === actionTypeId);

  return { actionType, isLoading };
};
