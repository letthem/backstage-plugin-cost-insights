import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const costInsightsPlugin = createPlugin({
  id: 'cost-insights',
  routes: {
    root: rootRouteRef,
  },
});

export const CostInsightsPage = costInsightsPlugin.provide(
  createRoutableExtension({
    name: 'CostInsightsPage',
    component: () =>
      import('./components/EC2CostPage').then(m => m.EC2CostPage),
    mountPoint: rootRouteRef,
  }),
);
