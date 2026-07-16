/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@kbn/i18n-react';
import type { RuleApiResponse } from '../../../services/rules_api';
import { RuleProvider } from '../rule_context';
import type { RuleConditionsProps } from './rule_conditions';
import type { RuleSidebarConditionsTabProps } from './rule_sidebar_conditions_tab';
import { RuleSidebarConditionsTab } from './rule_sidebar_conditions_tab';

const mockRuleConditions = jest.fn();
jest.mock('./rule_conditions', () => ({
  RuleConditions: (props: RuleConditionsProps) => {
    mockRuleConditions(props);
    return <div data-test-subj="mockRuleConditions" />;
  },
}));

jest.mock('./rule_metadata', () => ({
  RuleMetadata: () => <div data-test-subj="mockRuleMetadata" />,
}));

const baseRule: RuleApiResponse = {
  id: 'rule-1',
  kind: 'signal',
  enabled: true,
  metadata: { name: 'Test Rule', description: 'A test description' },
  time_field: '@timestamp',
  schedule: { every: '5m', lookback: '10m' },
  query: { format: 'standalone', breach: { query: 'FROM logs-*' } },
  createdBy: 'alice@example.com',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedBy: 'bob@example.com',
  updatedAt: '2026-03-04T12:00:00.000Z',
};

const renderTab = (props: RuleSidebarConditionsTabProps = {}, rule = baseRule) =>
  render(
    <I18nProvider>
      <RuleProvider rule={rule}>
        <RuleSidebarConditionsTab {...props} />
      </RuleProvider>
    </I18nProvider>
  );

describe('RuleSidebarConditionsTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders RuleConditions and RuleMetadata', () => {
    renderTab();
    expect(screen.getByTestId('mockRuleConditions')).toBeInTheDocument();
    expect(screen.getByTestId('mockRuleMetadata')).toBeInTheDocument();
  });

  it('passes showDescription=false to RuleConditions by default', () => {
    renderTab();
    expect(mockRuleConditions).toHaveBeenCalledWith(
      expect.objectContaining({ showDescription: false })
    );
  });

  it('forwards showDescription=true to RuleConditions', () => {
    renderTab({ showDescription: true });
    expect(mockRuleConditions).toHaveBeenCalledWith(
      expect.objectContaining({ showDescription: true })
    );
  });

  it('omits RuleMetadata when createdAt is absent', () => {
    const ruleNoMeta = { ...baseRule, createdAt: undefined as unknown as string };
    renderTab({}, ruleNoMeta);
    expect(screen.queryByTestId('mockRuleMetadata')).not.toBeInTheDocument();
  });
});
