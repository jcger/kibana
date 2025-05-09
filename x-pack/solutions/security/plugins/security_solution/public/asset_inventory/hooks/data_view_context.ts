/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */
import { createContext, useContext } from 'react';
import type { DataView } from '@kbn/data-views-plugin/common';

interface DataViewContextValue {
  dataView: DataView;
  dataViewRefetch?: () => void;
  dataViewIsLoading?: boolean;
  dataViewIsRefetching?: boolean;
}

export const DataViewContext = createContext<DataViewContextValue | undefined>(undefined);

/**
 * Retrieve context's properties
 */
export const useDataViewContext = (): DataViewContextValue => {
  const contextValue = useContext(DataViewContext);

  if (!contextValue) {
    throw new Error('useDataViewContext can only be used within DataViewContext provider');
  }

  return contextValue;
};
