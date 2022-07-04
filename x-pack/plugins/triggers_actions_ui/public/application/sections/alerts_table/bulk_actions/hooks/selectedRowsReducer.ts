/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { SelectedRowsAction, SelectedRowsState } from '../../../../../types';

export const selectedRowsReducer = (
  rowSelection: SelectedRowsState,
  { action, rowIndex }: SelectedRowsAction
) => {
  if (action === 'add') {
    const nextRowSelection = new Set(rowSelection);
    nextRowSelection.add(rowIndex);
    return nextRowSelection;
  } else if (action === 'delete') {
    const nextRowSelection = new Set(rowSelection);
    nextRowSelection.delete(rowIndex);
    return nextRowSelection;
  }
  return rowSelection;
};
