/*
 * Copyright 2020 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  createAdaptableForwardableComponent,
  useAnalytics,
} from '@backstage/core-plugin-api';
import classnames from 'classnames';

import MaterialLink, {
  LinkProps as MaterialLinkProps,
} from '@material-ui/core/Link';
import { makeStyles } from '@material-ui/core/styles';
import React, { ElementType } from 'react';
import {
  Link as RouterLink,
  LinkProps as RouterLinkProps,
} from 'react-router-dom';

const useStyles = makeStyles(
  {
    visuallyHidden: {
      clip: 'rect(0 0 0 0)',
      clipPath: 'inset(50%)',
      overflow: 'hidden',
      position: 'absolute',
      whiteSpace: 'nowrap',
      height: 1,
      width: 1,
    },
    externalLink: {
      position: 'relative',
    },
  },
  { name: 'Link' },
);

export const isExternalUri = (uri: string) => /^([a-z+.-]+):/.test(uri);

export type LinkProps = MaterialLinkProps &
  RouterLinkProps & {
    component?: ElementType<any>;
    noTrack?: boolean;
  };

/**
 * Given a react node, try to retrieve its text content.
 */
const getNodeText = (node: React.ReactNode): string => {
  // If the node is an array of children, recurse and join.
  if (node instanceof Array) {
    return node.map(getNodeText).join(' ').trim();
  }

  // If the node is a react element, recurse on its children.
  if (typeof node === 'object' && node) {
    return getNodeText((node as React.ReactElement)?.props?.children);
  }

  // Base case: the node is just text. Return it.
  if (['string', 'number'].includes(typeof node)) {
    return String(node);
  }

  // Base case: just return an empty string.
  return '';
};

export interface LinkContext {
  to: string;
  children: React.ReactNode;
}

export const {
  componentRef: linkComponentRef,
  /**
   * This is a Link
   */
  Component: Link,
} = createAdaptableForwardableComponent<LinkProps, LinkContext>({
  id: 'Link:v1',
  Provider: ({ props, Component }) => {
    const to = String(props.to);
    const value: LinkContext = { to, children: props.children };

    return <Component value={value} />;
  },
  /**
   * Thin wrapper on top of material-ui's Link component, which...
   * - Makes the Link use react-router
   * - Captures Link clicks as analytics events.
   */
  Component: ({ props: { onClick, noTrack, ...props }, value, info }) => {
    const { to, children } = value;
    const { ref } = info;

    const classes = useStyles();
    const analytics = useAnalytics();
    const linkText = getNodeText(children) || to;
    const external = isExternalUri(to);
    const newWindow = external && !!/^https?:/.exec(to);

    const handleClick = (event: React.MouseEvent<any, MouseEvent>) => {
      onClick?.(event);
      if (!noTrack) {
        analytics.captureEvent('click', linkText, { attributes: { to } });
      }
    };

    return external ? (
      // External links
      <MaterialLink
        ref={ref}
        href={to}
        onClick={handleClick}
        {...(newWindow ? { target: '_blank', rel: 'noopener' } : {})}
        {...props}
        className={classnames(classes.externalLink, props.className)}
      >
        {children}
        <span className={classes.visuallyHidden}>, Opens in a new window</span>
      </MaterialLink>
    ) : (
      // Interact with React Router for internal links
      <MaterialLink
        ref={ref}
        component={RouterLink}
        onClick={handleClick}
        {...props}
        children={children}
      />
    );
  },
});
