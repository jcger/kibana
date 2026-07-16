/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@kbn/i18n-react';
import { MemoryRouter } from 'react-router-dom';
import type { RuleApiResponse } from '../../../../services/rules_api';
import { RuleProvider } from '../../rule_context';
import { AlertTimelineSection } from './alert_timeline_section';

jest.mock('@kbn/core-di-browser', () => ({
  useService: (token: unknown) => {
    if (token === 'http') return { basePath: { prepend: (p: string) => p } };
    if (token === 'application') {
      return {
        capabilities: {},
        navigateToUrl: jest.fn(),
      };
    }
    if (token === 'uiSettings') {
      return { get: () => 'Browser' };
    }
    return {};
  },
  CoreStart: (key: string) => key,
  PluginStart: (key: string) => key,
}));

jest.mock('../../../../hooks/use_fetch_rule_events', () => ({
  useFetchRuleEvents: jest.fn(),
}));

jest.mock('./use_alert_timeline_url_state', () => ({
  useAlertTimelineUrlState: () => [{ from: 'now-24h', to: 'now' }, jest.fn()],
}));

jest.mock('../time_range', () => ({
  DEFAULT_ACTIVITY_TIME_RANGE: { from: 'now-24h', to: 'now' },
  resolveGteLte: () => ({ windowStartMs: 0, windowEndMs: 1000 }),
}));

jest.mock('@kbn/alerting-v2-episodes-ui/alert_timeline', () => ({
  deriveAlertTimelineData: () => ({ rows: [], summary: {} }),
  AlertTimelineLegend: () => <div data-test-subj="mockAlertTimelineLegend" />,
}));

jest.mock('./alert_timeline_chart', () => ({
  AlertTimelineChart: () => <div data-test-subj="mockAlertTimelineChart" />,
}));

jest.mock('./alert_timeline_stats_row', () => ({
  AlertTimelineStatsRow: () => <div data-test-subj="mockAlertTimelineStatsRow" />,
}));

jest.mock('./alert_timeline_view_all_button', () => ({
  AlertTimelineViewAllButton: () => <div data-test-subj="mockAlertTimelineViewAllButton" />,
}));

jest.mock('@kbn/alerting-v2-schemas', () => ({
  getRootEsqlQuery: () => 'FROM logs-*',
}));

jest.mock('../../../../utils/discover_href_for_episode', () => ({
  getDiscoverHrefForRuleQuery: () => '/discover',
}));

import { useFetchRuleEvents } from '../../../../hooks/use_fetch_rule_events';

const mockUseFetchRuleEvents = useFetchRuleEvents as jest.MockedFunction<typeof useFetchRuleEvents>;

const baseRule: RuleApiResponse = {
  id: 'rule-1',
  kind: 'alert',
  enabled: true,
  metadata: { name: 'Test Alert Rule' },
  time_field: '@timestamp',
  schedule: { every: '5m', lookback: '10m' },
  query: { format: 'standalone', breach: { query: 'FROM logs-*' } },
  createdBy: 'alice@example.com',
  createdAt: '2026-03-01T12:00:00.000Z',
  updatedBy: 'bob@example.com',
  updatedAt: '2026-03-04T12:00:00.000Z',
};

const defaultFetchResult = {
  phases: [],
  groupingValuesByHash: {},
  summary: {},
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};

const renderSection = (rule: RuleApiResponse = baseRule) =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <RuleProvider rule={rule}>
          <AlertTimelineSection />
        </RuleProvider>
      </I18nProvider>
    </MemoryRouter>
  );

describe('AlertTimelineSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFetchRuleEvents.mockReturnValue(
      defaultFetchResult as unknown as ReturnType<typeof useFetchRuleEvents>
    );
  });

  it('renders a horizontal rule separator after the legend in the empty state', () => {
    renderSection();
    expect(screen.getByTestId('alertTimelineSectionEmpty')).toBeInTheDocument();
    const legend = screen.getByTestId('mockAlertTimelineLegend');
    const separator = document.querySelector('[class*="euiHorizontalRule"]');
    expect(separator).not.toBeNull();
    expect(legend.compareDocumentPosition(separator!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders a horizontal rule separator after the legend in the loading state', () => {
    mockUseFetchRuleEvents.mockReturnValue({
      ...defaultFetchResult,
      isLoading: true,
    } as unknown as ReturnType<typeof useFetchRuleEvents>);
    renderSection();
    expect(screen.getByTestId('alertTimelineSectionLoading')).toBeInTheDocument();
    const separator = document.querySelector('[class*="euiHorizontalRule"]');
    expect(separator).not.toBeNull();
  });

  it('renders a horizontal rule separator after the legend in the error state', () => {
    mockUseFetchRuleEvents.mockReturnValue({
      ...defaultFetchResult,
      isError: true,
    } as unknown as ReturnType<typeof useFetchRuleEvents>);
    renderSection();
    expect(screen.getByTestId('alertTimelineSectionError')).toBeInTheDocument();
    const separator = document.querySelector('[class*="euiHorizontalRule"]');
    expect(separator).not.toBeNull();
  });

  it('renders the "No episodes in this window" empty state', () => {
    renderSection();
    expect(screen.getByText('No episodes in this window')).toBeInTheDocument();
  });
});
