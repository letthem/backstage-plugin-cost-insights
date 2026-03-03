# Backstage Cost Insights Plugin

A Backstage plugin for visualizing and analyzing AWS EC2 costs from S3-stored Cost and Usage Reports (CUR).

[![CI](https://github.com/letthem/backstage-plugin-cost-insights/actions/workflows/ci.yaml/badge.svg)](https://github.com/letthem/backstage-plugin-cost-insights/actions/workflows/ci.yaml)

## Features

- 📊 **Resource-level cost breakdown** - View costs by EC2 instances, volumes, snapshots, Elastic IPs, NAT gateways, and more
- 📈 **Daily cost trends** - Track cost changes over time with interactive charts
- 📅 **Date range filtering** - Analyze costs for any custom date range
- 🌍 **Multi-environment support** - Switch between dev, staging, production, etc.
- 🔮 **Monthly forecasting** - Estimate month-end costs based on current trends
- 🎯 **Top cost resources** - Identify highest cost contributors

## Plugin Architecture

This repository contains two packages:

- **`@letthem/backstage-plugin-cost-insights`** - Frontend plugin for visualization
- **`@letthem/backstage-plugin-cost-insights-backend`** - Backend plugin for data aggregation

## Installation

### 1. Install Packages

```bash
# From your Backstage root directory
yarn add --cwd packages/app @letthem/backstage-plugin-cost-insights
yarn add --cwd packages/backend @letthem/backstage-plugin-cost-insights-backend
```

### 2. Configure Backend

Add to `packages/backend/src/index.ts`:

```typescript
import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// ... other plugins

backend.add(import('@letthem/backstage-plugin-cost-insights-backend'));

backend.start();
```

### 3. Configure Frontend

Add to `packages/app/src/App.tsx`:

```tsx
import { EC2CostPage } from '@letthem/backstage-plugin-cost-insights';

// Inside your routes:
<Route path="/cost-insights/ec2" element={<EC2CostPage />} />
```

### 4. Add Configuration

Add to your `app-config.yaml`:

```yaml
costInsights:
  environments:
    - dev
    - stg
    - prod
  defaultEnvironment: prod
  monthlyLookbackMonths: 6
  auth:
    allowUnauthenticated: false
  s3:
    region: ap-northeast-2
    bucket: your-cur-result-bucket
    # Optional: AWS profile for local development
    # profile: your-aws-profile
    # Optional: customize S3 prefix structure
    # dailyPrefixTemplate: '{environment}/daily/{yearMonth}/'
```

## AWS Setup

### Prerequisites

1. **S3 bucket** containing processed CUR data in NDJSON format
2. **IAM permissions** for the backend to read from S3

### Data Format

Your S3 bucket should contain daily cost data in NDJSON format:

```
s3://your-bucket/
├── prod/daily/2026-01/
│   └── run=2026-01-15T10-00-00/
│       ├── data-001.json
│       └── data-002.json
├── dev/daily/2026-01/
│   └── run=2026-01-15T10-00-00/
│       └── data-001.json
```

Each NDJSON file should contain lines like:

```json
{"usage_date":"2026-01-15","resource_id":"i-0123456789abcdef0","resource_type":"instance","product_instance_type":"m6i.large","total_cost":12.34,"usage_amount":24}
```

**Required fields:**
- `usage_date` - ISO date string
- `resource_id` - AWS resource ID
- `resource_type` - One of: `instance`, `volume`, `snapshot`, `elastic-ip`, `nat-gateway`, `data-transfer`, `vpc`
- `total_cost` - Numeric cost value
- `usage_amount` - Numeric usage value

**Optional fields:**
- `product_instance_type` - EC2 instance type
- `product_volume_type` - EBS volume type

### Authentication Options

The backend supports multiple AWS authentication methods:

1. **IRSA (EKS)** - Recommended for production
2. **EC2 Instance Profile** - For EC2-hosted Backstage
3. **AWS SSO Profile** - For local development (`s3.profile` config)
4. **IAM User credentials** - Via environment variables

See [docs/aws-setup.md](docs/aws-setup.md) for detailed setup instructions including:
- CUR data processing with Athena
- IAM policy examples
- Troubleshooting guide

## Development

```bash
# Install dependencies
yarn install

# Run type checking
yarn tsc

# Run linting
yarn lint

# Build all packages
yarn build:all

# Run tests
yarn test
```

## Configuration Reference

See individual plugin READMEs for detailed configuration:

- [Frontend Plugin README](plugins/cost-insights/README.md)
- [Backend Plugin README](plugins/cost-insights-backend/README.md)
- [AWS Setup Guide](docs/aws-setup.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

Apache-2.0

## Support

- [Report Issues](https://github.com/letthem/backstage-plugin-cost-insights/issues)
- [View Documentation](https://github.com/letthem/backstage-plugin-cost-insights#readme)
