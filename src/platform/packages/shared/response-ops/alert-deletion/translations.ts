/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { i18n } from '@kbn/i18n';

export const MODAL_TITLE = i18n.translate('responseOpsAlertDeletion.modalTitle', {
  defaultMessage: 'Clean up alerts',
});

export const MODAL_DESCRIPTION = i18n.translate('responseOpsAlertDeletion.modalDescription', {
  defaultMessage:
    'Clean up alert history by removing old active alerts and long-inactive alerts based on customizable time thresholds',
});

export const FORM_TITLE = i18n.translate('responseOpsAlertDeletion.modalFormTitle', {
  defaultMessage: 'Select the type of alerts to include in this cleanup task',
});

export const ACTIVE_ALERTS = i18n.translate('responseOpsAlertDeletion.activeAlerts', {
  defaultMessage: 'Active Alerts',
});

export const ACTIVE_ALERTS_DESCRIPTION = i18n.translate(
  'responseOpsAlertDeletion.activeAlertsDescription',
  {
    defaultMessage: 'Active alert was created more than N days ago',
  }
);

export const INACTIVE_ALERTS = i18n.translate('responseOpsAlertDeletion.inactiveAlerts', {
  defaultMessage: 'Inactive Alerts',
});

export const INACTIVE_ALERTS_DESCRIPTION = i18n.translate(
  'responseOpsAlertDeletion.inactiveAlertsDescription',
  {
    defaultMessage: 'Recovered, closed or untracked more than N days ago',
  }
);

export const MODAL_SUBMIT = i18n.translate('responseOpsAlertDeletion.modalSubmit', {
  defaultMessage: 'Run clean up task',
});

export const DAYS = i18n.translate('responseOpsAlertDeletion.days', {
  defaultMessage: 'days',
});

export const MONTHS = i18n.translate('responseOpsAlertDeletion.months', {
  defaultMessage: 'months',
});

export const YEARS = i18n.translate('responseOpsAlertDeletion.years', {
  defaultMessage: 'years',
});

export const PREVIEW = i18n.translate('responseOpsAlertDeletion.preview', {
  defaultMessage:
    "This action will permanently delete a total of 4000 alerts and you won't be able to restore them.",
});

export const DELETE_CONFIRMATION = i18n.translate('responseOpsAlertDeletion.deleteConfirmation', {
  defaultMessage: 'Type "Delete" to confirm clean up task',
});
