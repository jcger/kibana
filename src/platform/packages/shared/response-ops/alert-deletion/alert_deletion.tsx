/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import {
  EuiModal,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiModalBody,
  EuiModalFooter,
  EuiForm,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexItem,
  EuiSpacer,
  EuiCheckbox,
  EuiFormRow,
  EuiFieldNumber,
  EuiFlexGroup,
  EuiDescribedFormGroup,
  EuiSelect,
  EuiSelectOption,
  EuiHorizontalRule,
  EuiText,
  EuiFieldText,
} from '@elastic/eui';
import * as i18n from './translations';

const formId = 'todo';

const THRESHOLD_UNITS: EuiSelectOption[] = [
  { text: i18n.DAYS, value: 'days' },
  { text: i18n.MONTHS, value: 'months' },
  { text: i18n.YEARS, value: 'years' },
];

interface ThresholdSelectorProps {
  title: string;
  description: string;
  threshold: number;
  thresholdUnit: EuiSelectOption;
  onChangeThreshold: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeThresholdUnit: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}
const ThresholdSelector = ({
  title,
  description,
  threshold,
  thresholdUnit,
  onChangeThreshold,
  onChangeThresholdUnit,
}: ThresholdSelectorProps) => {
  return (
    <EuiDescribedFormGroup
      fullWidth
      title={<h3>{title}</h3>}
      description={description}
      descriptionFlexItemProps={{ grow: 2 }}
    >
      <EuiFormRow fullWidth>
        <EuiFlexGroup gutterSize="s" responsive={false}>
          <EuiFlexItem grow={1}>
            <EuiFieldNumber min={1} max={1000} value={threshold} onChange={onChangeThreshold} />
          </EuiFlexItem>
          <EuiFlexItem grow={2}>
            <EuiSelect
              value={thresholdUnit.value as string}
              onChange={onChangeThresholdUnit}
              options={THRESHOLD_UNITS}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFormRow>
    </EuiDescribedFormGroup>
  );
};

interface AlertDeletionProps {
  closeModal: () => void;
}
export const AlertDeletion = ({ closeModal }: AlertDeletionProps) => {
  const [activeChecked, setActiveChecked] = useState(false);
  const [activeThreshold, setActiveThreshold] = useState(1);
  const [activeThresholdUnit, setActiveThresholdUnit] = useState<EuiSelectOption>(
    THRESHOLD_UNITS[0]
  );
  const [inactiveThreshold, setInactiveThreshold] = useState(1);
  const [inactiveThresholdUnit, setInactiveThresholdUnit] = useState<EuiSelectOption>(
    THRESHOLD_UNITS[0]
  );
  const [inactiveChecked, setInactiveChecked] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const onChangeActive = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveChecked(e.target.checked);
  };

  const onChangeActiveThreshold = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveThreshold(Number(e.target.value));
  };

  const onChangeInactive = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInactiveChecked(e.target.checked);
  };

  const onChangeInactiveThreshold = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInactiveThreshold(Number(e.target.value));
  };

  const onChangeActiveThresholdUnit = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = THRESHOLD_UNITS.find((option) => option.label === event.target.value);
    if (selectedValue) {
      setActiveThresholdUnit(selectedValue);
    }
  };

  const onChangeInactiveThresholdUnit = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = THRESHOLD_UNITS.find((option) => option.label === event.target.value);
    if (selectedValue) {
      setInactiveThresholdUnit(selectedValue);
    }
  };

  const onChangeDeleteConfirmation = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeleteConfirmation(e.target.value);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  return (
    <>
      <EuiModal aria-labelledby={'alert-deletion-modal'} onClose={closeModal}>
        <EuiForm id={formId} component="form" onSubmit={onSubmit}>
          <EuiModalHeader>
            <EuiModalHeaderTitle id={'alert-deletion-modal'}>
              {i18n.MODAL_TITLE}
            </EuiModalHeaderTitle>
          </EuiModalHeader>

          <EuiModalBody>
            <p>{i18n.MODAL_DESCRIPTION}</p>
            <EuiSpacer size="l" />

            <EuiCheckbox
              id="alert-deletion-active"
              checked={activeChecked}
              onChange={onChangeActive}
              labelProps={{ css: 'width: 100%' }}
              label={
                <ThresholdSelector
                  title={i18n.ACTIVE_ALERTS}
                  description={i18n.ACTIVE_ALERTS_DESCRIPTION}
                  threshold={activeThreshold}
                  thresholdUnit={activeThresholdUnit}
                  onChangeThreshold={onChangeActiveThreshold}
                  onChangeThresholdUnit={onChangeActiveThresholdUnit}
                />
              }
            />
            <EuiSpacer size="m" />

            <EuiCheckbox
              id="alert-deletion-inactive"
              checked={inactiveChecked}
              onChange={onChangeInactive}
              labelProps={{ css: 'width: 100%' }}
              label={
                <ThresholdSelector
                  title={i18n.INACTIVE_ALERTS}
                  description={i18n.INACTIVE_ALERTS_DESCRIPTION}
                  threshold={inactiveThreshold}
                  thresholdUnit={inactiveThresholdUnit}
                  onChangeThreshold={onChangeInactiveThreshold}
                  onChangeThresholdUnit={onChangeInactiveThresholdUnit}
                />
              }
            />
            <EuiHorizontalRule />
            <p>{i18n.PREVIEW}</p>
            <EuiSpacer size="m" />
            <EuiFormRow label={i18n.DELETE_CONFIRMATION} fullWidth>
              <EuiFieldText value={deleteConfirmation} onChange={onChangeDeleteConfirmation} />
            </EuiFormRow>
          </EuiModalBody>
          <EuiModalFooter>
            <EuiButtonEmpty onClick={closeModal}>Cancel</EuiButtonEmpty>
            <EuiButton type="submit" form={formId} fill>
              {i18n.MODAL_SUBMIT}
            </EuiButton>
          </EuiModalFooter>
        </EuiForm>
      </EuiModal>
    </>
  );
};
