/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { EuiCheckbox } from '@elastic/eui';
import React, { ChangeEvent, useContext } from 'react';
import { SelectionContext } from '../context';

export const BulkActionsHeader = () => {
  const [selectedRows, updateSelectedRows] = useContext(SelectionContext);

  return (
    <EuiCheckbox
      id="selection-toggle"
      aria-label="Select all rows"
      checked={selectedRows && selectedRows.size > 0}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
          // select everything
          console.log('select all');
          updateSelectedRows({ action: 'selectAll' });
        } else {
          // clear selection
          console.log('clear');
          updateSelectedRows({ action: 'clear' });
        }
      }}
    />
  );
};
