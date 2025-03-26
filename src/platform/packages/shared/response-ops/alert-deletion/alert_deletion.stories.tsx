/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { EuiButton } from '@elastic/eui';
import { AlertDeletion } from './alert_deletion';

const CallToAction = (props: { name: string }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const closeModal = () => setIsModalVisible(false);
  const showModal = () => setIsModalVisible(true);

  return isModalVisible ? (
    <AlertDeletion {...props} closeModal={closeModal} />
  ) : (
    <EuiButton onClick={showModal}>Click me!</EuiButton>
  );
};

// Define the Meta type for your component
const meta: Meta<typeof AlertDeletion> = {
  title: 'alertDeletion',
  component: CallToAction,
};

export default meta;

type Story = StoryObj<typeof CallToAction>;

export const Default: Story = {
  args: {
    name: 'John',
  },
};
