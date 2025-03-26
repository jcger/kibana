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
  EuiFieldText,
} from '@elastic/eui';
import * as i18n from './translations';

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
  isDisabled: boolean;
  isInvalid: boolean;
  error: string[];
}
const ThresholdSelector = ({
  title,
  description,
  threshold,
  thresholdUnit,
  onChangeThreshold,
  onChangeThresholdUnit,
  isDisabled,
  isInvalid,
  error,
}: ThresholdSelectorProps) => {
  return (
    <EuiDescribedFormGroup
      fullWidth
      title={<h3>{title}</h3>}
      description={description}
      descriptionFlexItemProps={{ grow: 2 }}
    >
      <EuiFormRow fullWidth isInvalid={isInvalid} isDisabled={isDisabled} error={error}>
        <EuiFlexGroup gutterSize="s" responsive={false}>
          <EuiFlexItem grow={1}>
            <EuiFieldNumber
              min={1}
              max={1000}
              value={threshold}
              onChange={onChangeThreshold}
              disabled={isDisabled}
            />
          </EuiFlexItem>
          <EuiFlexItem grow={1}>
            <EuiSelect
              value={thresholdUnit.value as string}
              onChange={onChangeThresholdUnit}
              options={THRESHOLD_UNITS}
              disabled={isDisabled}
            />
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFormRow>
    </EuiDescribedFormGroup>
  );
};

const getThresholdInDays = (threshold: number, thresholdUnit: EuiSelectOption) => {
  switch (thresholdUnit.value) {
    case 'days':
      return threshold;
    case 'months':
      return threshold * 30;
    case 'years':
      return threshold * 365;
    default:
      return 0;
  }
};

const getThresholdErrorMessages = (threshold: number, thresholdUnit: EuiSelectOption) => {
  const thresholdInDays = getThresholdInDays(threshold, thresholdUnit);
  const errorMessages = [];
  if (thresholdInDays < 1) {
    errorMessages.push(i18n.THRESHOLD_ERROR_MIN);
  }
  if (thresholdInDays > 1000) {
    errorMessages.push(i18n.THRESHOLD_ERROR_MAX);
  }
  return errorMessages;
};

interface AlertDeletionProps {
  closeModal: () => void;
}
export const AlertDeletion = ({ closeModal }: AlertDeletionProps) => {
  const [activeState, setActiveState] = useState({
    checked: false,
    threshold: 1,
    thresholdUnit: THRESHOLD_UNITS[0],
  });

  const [inactiveState, setInactiveState] = useState({
    checked: false,
    threshold: 1,
    thresholdUnit: THRESHOLD_UNITS[0],
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const isDeleteConfirmationValid =
    deleteConfirmation === i18n.DELETE_PASSKEY || deleteConfirmation.length === 0;

  const activeThresholdErrorMessages = getThresholdErrorMessages(
    activeState.threshold,
    activeState.thresholdUnit
  );
  const isActiveThresholdValid = activeThresholdErrorMessages.length === 0;

  const inactiveThresholdErrorMessages = getThresholdErrorMessages(
    inactiveState.threshold,
    inactiveState.thresholdUnit
  );
  const isInactiveThresholdValid = inactiveThresholdErrorMessages.length === 0;

  const isFormValid =
    isDeleteConfirmationValid &&
    isActiveThresholdValid &&
    isInactiveThresholdValid &&
    deleteConfirmation.length > 0;

  const onChangeActive = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveState((prev) => ({ ...prev, checked: e.target.checked }));
  };

  const onChangeActiveThreshold = (e: React.ChangeEvent<HTMLInputElement>) => {
    setActiveState((prev) => ({ ...prev, threshold: Number(e.target.value) }));
  };

  const onChangeActiveThresholdUnit = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = THRESHOLD_UNITS.find((option) => option.text === e.target.value);
    if (selectedValue) {
      setActiveState((prev) => ({ ...prev, thresholdUnit: selectedValue }));
    }
  };

  const onChangeInactive = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInactiveState((prev) => ({ ...prev, checked: e.target.checked }));
  };

  const onChangeInactiveThreshold = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInactiveState((prev) => ({ ...prev, threshold: Number(e.target.value) }));
  };

  const onChangeInactiveThresholdUnit = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = THRESHOLD_UNITS.find((option) => option.text === e.target.value);
    if (selectedValue) {
      setInactiveState((prev) => ({ ...prev, thresholdUnit: selectedValue }));
    }
  };

  const onChangeDeleteConfirmation = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeleteConfirmation(e.target.value);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(e);
  };

  return (
    <EuiModal aria-labelledby={'alert-deletion-modal'} onClose={closeModal}>
      <EuiForm id="alert-deletion-settings" component="form" onSubmit={onSubmit}>
        <EuiModalHeader>
          <EuiModalHeaderTitle id={'alert-deletion-modal'}>{i18n.MODAL_TITLE}</EuiModalHeaderTitle>
        </EuiModalHeader>

        <EuiModalBody>
          <p>{i18n.MODAL_DESCRIPTION}</p>
          <EuiSpacer size="l" />

          <EuiCheckbox
            id="alert-deletion-active"
            checked={activeState.checked}
            onChange={onChangeActive}
            labelProps={{ css: 'width: 100%' }}
            label={
              <ThresholdSelector
                title={i18n.ACTIVE_ALERTS}
                description={i18n.ACTIVE_ALERTS_DESCRIPTION}
                threshold={activeState.threshold}
                thresholdUnit={activeState.thresholdUnit}
                onChangeThreshold={onChangeActiveThreshold}
                onChangeThresholdUnit={onChangeActiveThresholdUnit}
                isInvalid={!isActiveThresholdValid}
                isDisabled={!activeState.checked} // TODO: also if readonly
                error={activeThresholdErrorMessages}
              />
            }
          />
          <EuiSpacer size="m" />

          <EuiCheckbox
            id="alert-deletion-inactive"
            checked={inactiveState.checked}
            onChange={onChangeInactive}
            labelProps={{ css: 'width: 100%' }}
            label={
              <ThresholdSelector
                title={i18n.INACTIVE_ALERTS}
                description={i18n.INACTIVE_ALERTS_DESCRIPTION}
                threshold={inactiveState.threshold}
                thresholdUnit={inactiveState.thresholdUnit}
                onChangeThreshold={onChangeInactiveThreshold}
                onChangeThresholdUnit={onChangeInactiveThresholdUnit}
                isInvalid={!isInactiveThresholdValid}
                isDisabled={!inactiveState.checked} // TODO: also if readonly
                error={inactiveThresholdErrorMessages}
              />
            }
          />

          <EuiHorizontalRule />

          <p>{i18n.PREVIEW}</p>
          <EuiSpacer size="m" />

          <EuiFormRow
            label={i18n.DELETE_CONFIRMATION}
            fullWidth
            isInvalid={!isDeleteConfirmationValid}
          >
            <EuiFieldText value={deleteConfirmation} onChange={onChangeDeleteConfirmation} />
          </EuiFormRow>
        </EuiModalBody>

        <EuiModalFooter>
          <EuiButtonEmpty onClick={closeModal}>Cancel</EuiButtonEmpty>
          <EuiButton type="submit" form="alert-deletion-settings" fill isDisabled={!isFormValid}>
            {i18n.MODAL_SUBMIT}
          </EuiButton>
        </EuiModalFooter>
      </EuiForm>
    </EuiModal>
  );
};
