/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { EuiSpacer } from '@elastic/eui';
import { useRule } from '../rule_context';
import { RuleConditions } from './rule_conditions';
import { RuleMetadata } from './rule_metadata';

export interface RuleSidebarConditionsTabProps {
  showDescription?: boolean;
}

export const RuleSidebarConditionsTab: React.FC<RuleSidebarConditionsTabProps> = ({
  showDescription = false,
}) => {
  const rule = useRule();
  const hasMetadata = Boolean(rule.createdAt);

  return (
    <>
      <RuleConditions showDescription={showDescription} />
      {hasMetadata && (
        <>
          <EuiSpacer size="l" />
          <RuleMetadata />
        </>
      )}
    </>
  );
};
