# Cost Insights Frontend Plugin

Backstage frontend plugin for EC2 cost visualization.

## What It Shows

- Resource-level EC2 cost breakdown
- Daily trend chart for selected date range
- Monthly comparison chart
- Top cost resources
- Forecast card (month-end estimate)

## Requirements

- `@internal/plugin-cost-insights-backend` must be installed and enabled
- Backend must expose the plugin ID `cost-insights`

## Route Integration

```tsx
import { CostInsightsPage } from '@internal/plugin-cost-insights';

<Route path="/cost-insights/ec2" element={<CostInsightsPage />} />
```

## Runtime Behavior

- On load, frontend calls backend `/config` to get:
  - environments
  - defaultEnvironment
- Environment toggle is rendered dynamically from backend config.
- Data request uses `/product/ec2/insights?intervals=<start>/<end>&environment=<env>`.

## Related Backend Config

```yaml
costInsights:
  environments: [dev, stg, prod]
  defaultEnvironment: prod
  auth:
    allowUnauthenticated: false
  s3:
    region: ap-northeast-2
    bucket: your-cur-result-bucket
    # Optional for local SSO
    # profile: your-aws-profile
    # Optional if your CUR prefix differs
    dailyPrefixTemplate: '{environment}/daily/{yearMonth}/'
```
