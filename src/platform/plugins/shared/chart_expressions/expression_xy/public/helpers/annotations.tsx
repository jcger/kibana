/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';
import { Position } from '@elastic/charts';
import {
  EuiFlexGroup,
  EuiIcon,
  EuiIconProps,
  EuiText,
  useEuiFontSize,
  UseEuiTheme,
  euiTextTruncate,
} from '@elastic/eui';
import { css } from '@emotion/react';
import type {
  IconPosition,
  ReferenceLineDecorationConfig,
  MergedAnnotation,
} from '../../common/types';
import { getBaseIconPlacement } from '../components';
import { hasIcon, iconSet } from './icon';
import { AxesMap, getOriginalAxisPosition } from './axes_configuration';

export const LINES_MARKER_SIZE = 20;

type PartialReferenceLineDecorationConfig = Pick<
  ReferenceLineDecorationConfig,
  'icon' | 'iconPosition' | 'textVisibility'
> & {
  position?: Position;
};

type PartialMergedAnnotation = Pick<
  MergedAnnotation,
  'position' | 'icon' | 'textVisibility' | 'label' | 'isGrouped'
>;

const isExtendedDecorationConfig = (
  config: PartialReferenceLineDecorationConfig | PartialMergedAnnotation | undefined
): config is PartialReferenceLineDecorationConfig =>
  (config as PartialReferenceLineDecorationConfig)?.iconPosition ? true : false;

export const isAnnotationConfig = (
  config: PartialReferenceLineDecorationConfig | PartialMergedAnnotation
): config is PartialMergedAnnotation => {
  return 'isGrouped' in config;
};

// Note: it does not take into consideration whether the reference line is in view or not
export const getLinesCausedPaddings = (
  visualConfigs: Array<PartialReferenceLineDecorationConfig | PartialMergedAnnotation | undefined>,
  axesMap: AxesMap,
  shouldRotate: boolean
) => {
  // collect all paddings for the 4 axis: if any text is detected double it.
  const paddings: Partial<Record<Position, number>> = {};
  const icons: Partial<Record<Position, number>> = {};
  visualConfigs?.forEach((config) => {
    if (!config) {
      return;
    }
    const { position, icon, textVisibility } = config;
    const iconPosition = isExtendedDecorationConfig(config) ? config.iconPosition : undefined;
    const isLabelVisible = textVisibility && (isAnnotationConfig(config) ? config.label : true);

    if (position && (hasIcon(icon) || isLabelVisible)) {
      const placement = getBaseIconPlacement(
        iconPosition,
        axesMap,
        getOriginalAxisPosition(position, shouldRotate)
      );
      paddings[placement] = Math.max(
        paddings[placement] || 0,
        LINES_MARKER_SIZE * (isLabelVisible ? 2 : 1) // double the padding size if there's text
      );
      icons[placement] = (icons[placement] || 0) + (hasIcon(icon) ? 1 : 0);
    }
  });
  // post-process the padding based on the icon presence:
  // if no icon is present for the placement, just reduce the padding
  (Object.keys(paddings) as Position[]).forEach((placement) => {
    if (!icons[placement]) {
      paddings[placement] = LINES_MARKER_SIZE;
    }
  });

  return paddings;
};

export function mapVerticalToHorizontalPlacement(placement: Position) {
  switch (placement) {
    case Position.Top:
      return Position.Right;
    case Position.Bottom:
      return Position.Left;
    case Position.Left:
      return Position.Bottom;
    case Position.Right:
      return Position.Top;
  }
}

export function MarkerBody({
  label,
  isHorizontal,
}: {
  label: string | undefined;
  isHorizontal: boolean;
}) {
  if (!label) return null;

  const maxWidth = isHorizontal ? LINES_MARKER_SIZE * 3 : LINES_MARKER_SIZE;

  return (
    <div
      data-test-subj="xyVisAnnotationText"
      css={[
        css`
          ${euiTextTruncate(`${maxWidth}px`)}
        `,
        !isHorizontal && styles.rotatedText,
      ]}
    >
      {label}
    </div>
  );
}

function NumberIcon({ number }: { number: number }) {
  return (
    <EuiFlexGroup
      justifyContent="spaceAround"
      css={styles.numberIcon}
      data-test-subj="xyVisGroupedAnnotationIcon"
      gutterSize="none"
      alignItems="center"
    >
      <EuiText color="ghost" css={[css(useEuiFontSize('xxxs')), styles.numberIconText]}>
        {number < 10 ? number : `9+`}
      </EuiText>
    </EuiFlexGroup>
  );
}

const isNumericalString = (value: string) => !isNaN(Number(value));

export const AnnotationIcon = ({
  type,
  rotateClassName = '',
  isHorizontal,
  renderedInChart,
  ...rest
}: {
  type: string;
  rotateClassName?: string;
  isHorizontal?: boolean;
  renderedInChart?: boolean;
} & EuiIconProps) => {
  if (isNumericalString(type)) {
    return <NumberIcon number={Number(type)} />;
  }
  const iconConfig = iconSet.find((i) => i.value === type);
  if (!iconConfig) {
    return null;
  }

  const shouldRotateIcon = !isHorizontal && iconConfig.shouldRotate && renderedInChart;

  return (
    <EuiIcon
      {...rest}
      data-test-subj="xyVisAnnotationIcon"
      type={iconConfig.icon || type}
      className={iconConfig.shouldRotate ? rotateClassName : undefined}
      css={shouldRotateIcon && styles.rotatedIcon}
    />
  );
};

interface MarkerConfig {
  position?: Position;
  icon?: string;
  textVisibility?: boolean;
  iconPosition?: IconPosition;
}

export function Marker({
  config,
  isHorizontal,
  hasReducedPadding,
  label,
  rotateClassName,
}: {
  config: MarkerConfig;
  isHorizontal: boolean;
  hasReducedPadding: boolean;
  label?: string;
  rotateClassName?: string;
}) {
  if (hasIcon(config.icon)) {
    return (
      <AnnotationIcon
        type={config.icon}
        rotateClassName={rotateClassName}
        renderedInChart={true}
        isHorizontal={isHorizontal}
      />
    );
  }

  // if there's some text, check whether to show it as marker, or just show some padding for the icon
  if (config.textVisibility) {
    if (hasReducedPadding && label) {
      return <MarkerBody label={label} isHorizontal={isHorizontal} />;
    }
    return <EuiIcon type="empty" />;
  }
  return null;
}

const styles = {
  numberIcon: ({ euiTheme }: UseEuiTheme) =>
    css({
      borderRadius: euiTheme.size.base,
      minWidth: euiTheme.size.base,
      height: euiTheme.size.base,
      backgroundColor: 'currentColor',
    }),

  numberIconText: ({ euiTheme }: UseEuiTheme) =>
    css({
      fontWeight: euiTheme.font.weight.medium,
      letterSpacing: '-.5px',
    }),

  rotatedIcon: css({
    transform: 'rotate(90deg) !important',
    transformOrigin: 'center',
  }),

  rotatedText: css({
    display: 'inline-block',
    whiteSpace: 'nowrap',
    transform: 'translate(0, 100%) rotate(-90deg)',
    transformOrigin: '0 0',

    '&::after': {
      content: '""',
      float: 'left',
      marginTop: '100%',
    },
  }),
};
