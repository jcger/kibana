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
  EuiSpacer,
  EuiCheckbox,
  EuiFormRow,
  EuiSelectOption,
  EuiHorizontalRule,
  EuiFieldText,
  EuiPanel,
} from '@elastic/eui';
import * as i18n from '../translations';
import { ModalThresholdSelector as ThresholdSelector } from './modal_threshold_selector';
import {
  DEFAULT_THRESHOLD,
  DEFAULT_THRESHOLD_ENABLED,
  DEFAULT_THRESHOLD_UNIT,
  MAX_THRESHOLD_DAYS,
  MIN_THRESHOLD_DAYS,
  THRESHOLD_UNITS,
} from '../constants';

const FORM_ID = 'alert-deletion-settings';

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
  if (thresholdInDays < MIN_THRESHOLD_DAYS) {
    errorMessages.push(i18n.THRESHOLD_ERROR_MIN);
  }
  if (thresholdInDays > MAX_THRESHOLD_DAYS) {
    errorMessages.push(i18n.THRESHOLD_ERROR_MAX);
  }
  return errorMessages;
};

export interface AlertDeletionProps {
  closeModal: () => void;
}
export const AlertDeletionModal = ({ closeModal }: AlertDeletionProps) => {
  const [activeState, setActiveState] = useState({
    checked: DEFAULT_THRESHOLD_ENABLED,
    threshold: DEFAULT_THRESHOLD,
    thresholdUnit: DEFAULT_THRESHOLD_UNIT,
  });

  const [inactiveState, setInactiveState] = useState({
    checked: DEFAULT_THRESHOLD_ENABLED,
    threshold: DEFAULT_THRESHOLD,
    thresholdUnit: DEFAULT_THRESHOLD_UNIT,
  });

  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const errorMessages = {
    activeThreshold: getThresholdErrorMessages(activeState.threshold, activeState.thresholdUnit),
    inactiveThreshold: getThresholdErrorMessages(
      inactiveState.threshold,
      inactiveState.thresholdUnit
    ),
  };

  const validations = {
    isActiveThresholdValid: errorMessages.activeThreshold.length === 0,
    isInactiveThresholdValid: errorMessages.inactiveThreshold.length === 0,
    isDeleteConfirmationValid:
      deleteConfirmation === i18n.DELETE_PASSKEY || deleteConfirmation.length === 0,
  };

  const isFormValid =
    validations.isDeleteConfirmationValid &&
    validations.isActiveThresholdValid &&
    validations.isInactiveThresholdValid &&
    deleteConfirmation.length > 0 &&
    (activeState.checked || inactiveState.checked);

  const activeAlertsCallbacks = {
    onChangeEnabled: (e: React.ChangeEvent<HTMLInputElement>) => {
      setActiveState((prev) => ({ ...prev, checked: e.target.checked }));
    },
    onChangeThreshold: (e: React.ChangeEvent<HTMLInputElement>) => {
      setActiveState((prev) => ({ ...prev, threshold: Number(e.target.value) }));
    },
    onChangeThresholdUnit: (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = THRESHOLD_UNITS.find((option) => option.text === e.target.value);
      if (selectedValue) {
        setActiveState((prev) => ({ ...prev, thresholdUnit: selectedValue }));
      }
    },
  };

  const inactiveAlertsCallbacks = {
    onChangeEnabled: (e: React.ChangeEvent<HTMLInputElement>) => {
      setInactiveState((prev) => ({ ...prev, checked: e.target.checked }));
    },
    onChangeThreshold: (e: React.ChangeEvent<HTMLInputElement>) => {
      setInactiveState((prev) => ({ ...prev, threshold: Number(e.target.value) }));
    },
    onChangeThresholdUnit: (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = THRESHOLD_UNITS.find((option) => option.text === e.target.value);
      if (selectedValue) {
        setInactiveState((prev) => ({ ...prev, thresholdUnit: selectedValue }));
      }
    },
  };

  const onChangeDeleteConfirmation = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeleteConfirmation(e.target.value);
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formState = {
      isActiveAlertsDeletionEnabled: validations.isActiveThresholdValid,
      isInactiveAlertsDeletionEnabled: validations.isInactiveThresholdValid,
      activeAlertsDeletionThreshold: getThresholdInDays(
        activeState.threshold,
        activeState.thresholdUnit
      ),
      inactiveAlertsDeletionThreshold: getThresholdInDays(
        inactiveState.threshold,
        inactiveState.thresholdUnit
      ),
    };
    console.log(formState);
  };

  return (
    <EuiModal aria-labelledby={'alert-deletion-modal'} onClose={closeModal}>
      <EuiForm id={FORM_ID} component="form" onSubmit={onSubmit}>
        <EuiModalHeader>
          <EuiModalHeaderTitle id={'alert-deletion-modal'}>{i18n.MODAL_TITLE}</EuiModalHeaderTitle>
        </EuiModalHeader>

        <EuiModalBody>
          <p>{i18n.MODAL_DESCRIPTION}</p>
          <EuiSpacer size="l" />

          <EuiPanel hasShadow={false} hasBorder color="subdued">
            <EuiCheckbox
              id="alert-deletion-active"
              checked={activeState.checked}
              onChange={activeAlertsCallbacks.onChangeEnabled}
              labelProps={{ css: 'width: 100%' }}
              label={
                <ThresholdSelector
                  title={i18n.ACTIVE_ALERTS}
                  description={i18n.ACTIVE_ALERTS_DESCRIPTION}
                  threshold={activeState.threshold}
                  thresholdUnit={activeState.thresholdUnit}
                  onChangeThreshold={activeAlertsCallbacks.onChangeThreshold}
                  onChangeThresholdUnit={activeAlertsCallbacks.onChangeThresholdUnit}
                  isInvalid={!validations.isActiveThresholdValid}
                  isDisabled={!activeState.checked} // TODO: also if readonly
                  error={errorMessages.activeThreshold}
                />
              }
            />
          </EuiPanel>
          <EuiSpacer size="m" />

          <EuiPanel hasShadow={false} hasBorder color="subdued">
            <EuiCheckbox
              id="alert-deletion-inactive"
              checked={inactiveState.checked}
              onChange={inactiveAlertsCallbacks.onChangeEnabled}
              labelProps={{ css: 'width: 100%' }}
              label={
                <ThresholdSelector
                  title={i18n.INACTIVE_ALERTS}
                  description={i18n.INACTIVE_ALERTS_DESCRIPTION}
                  threshold={inactiveState.threshold}
                  thresholdUnit={inactiveState.thresholdUnit}
                  onChangeThreshold={inactiveAlertsCallbacks.onChangeThreshold}
                  onChangeThresholdUnit={inactiveAlertsCallbacks.onChangeThresholdUnit}
                  isInvalid={!validations.isInactiveThresholdValid}
                  isDisabled={!inactiveState.checked} // TODO: also if readonly
                  error={errorMessages.inactiveThreshold}
                />
              }
            />
          </EuiPanel>
          <EuiHorizontalRule />

          <p>{i18n.PREVIEW}</p>
          <EuiSpacer size="m" />

          <EuiFormRow
            label={i18n.DELETE_CONFIRMATION}
            fullWidth
            isInvalid={!validations.isDeleteConfirmationValid}
          >
            <EuiFieldText value={deleteConfirmation} onChange={onChangeDeleteConfirmation} />
          </EuiFormRow>
        </EuiModalBody>

        <EuiModalFooter>
          <EuiButtonEmpty onClick={closeModal}>Cancel</EuiButtonEmpty>
          <EuiButton type="submit" form={FORM_ID} fill isDisabled={!isFormValid}>
            {i18n.MODAL_SUBMIT}
          </EuiButton>
        </EuiModalFooter>
      </EuiForm>
    </EuiModal>
  );
};
