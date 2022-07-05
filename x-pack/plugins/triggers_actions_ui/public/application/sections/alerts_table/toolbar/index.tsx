/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import React from 'react';
import { BulkActions } from '../bulk_actions/components/toolbar';

export const getToolbarVisibility = ({
  selectedRowsCount,
  bulkActionItems,
}: {
  selectedRowsCount: number;
  bulkActionItems?: JSX.Element[];
}) => {
  if (selectedRowsCount === 0 || selectedRowsCount === undefined) return false;

  const options = {
    showColumnSelector: selectedRowsCount === 0 || selectedRowsCount === undefined,
    additionalControls: {
      left: {
        append: bulkActionItems && (
          <BulkActions
            selectedCount={selectedRowsCount}
            totalItems={0}
            showClearSelection={true}
            onSelectAll={() => {}}
            onClearSelection={() => {}}
            bulkActionItems={bulkActionItems}
          />
        ),
      },
    },
  };

  return options;
};
