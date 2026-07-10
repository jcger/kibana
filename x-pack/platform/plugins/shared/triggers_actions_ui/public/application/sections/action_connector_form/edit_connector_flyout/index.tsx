/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { IconType } from '@elastic/eui';
import React, { memo, useCallback, useRef } from 'react';
import { EuiFlyout } from '@elastic/eui';
import type { ActionConnector, ActionTypeRegistryContract } from '../../../../types';
import { EditConnectorTabs } from '../../../../types';
import { EditConnectorFlyoutContent } from './content';

export interface EditConnectorFlyoutProps {
  actionTypeRegistry: ActionTypeRegistryContract;
  connector: ActionConnector;
  onClose: () => void;
  tab?: EditConnectorTabs;
  onConnectorUpdated?: (connector: ActionConnector) => void;
  isServerless?: boolean;
  icon?: IconType;
  hideRulesTab?: boolean;
  isTestable?: boolean;
}

const EditConnectorFlyoutComponent: React.FC<EditConnectorFlyoutProps> = ({
  actionTypeRegistry,
  connector,
  onClose,
  tab = EditConnectorTabs.Configuration,
  onConnectorUpdated,
  icon,
  hideRulesTab = false,
  isTestable,
}) => {
  const onCloseAttemptRef = useRef<() => void>();

  const onFlyoutClose = useCallback(() => {
    onCloseAttemptRef.current?.();
  }, []);

  return (
    <EuiFlyout
      onClose={onFlyoutClose}
      aria-labelledby="flyoutActionEditTitle"
      size="m"
      data-test-subj="edit-connector-flyout"
    >
      <EditConnectorFlyoutContent
        actionTypeRegistry={actionTypeRegistry}
        connector={connector}
        onClose={onClose}
        tab={tab}
        onConnectorUpdated={onConnectorUpdated}
        icon={icon}
        hideRulesTab={hideRulesTab}
        isTestable={isTestable}
        onCloseAttemptRef={onCloseAttemptRef}
      />
    </EuiFlyout>
  );
};

export const EditConnectorFlyout = memo(EditConnectorFlyoutComponent);

// eslint-disable-next-line import/no-default-export
export { EditConnectorFlyout as default };
