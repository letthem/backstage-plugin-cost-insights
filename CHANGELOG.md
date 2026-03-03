# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-03-03

### Added

- Initial release of Cost Insights plugin
- Frontend plugin with EC2 cost visualization
- Backend plugin with AWS S3 integration
- Multi-environment support (legacy, dev, production)
- Daily and monthly cost trend analysis
- Cost forecasting based on current usage
- Resource breakdown by type (instances, volumes, elastic IPs, NAT gateways, data transfer, VPC)
- Expandable resource table with daily cost details
- Date range filtering
- Interactive charts using Recharts
- AWS S3 client with credential chain support
- Support for AWS SSO profiles (local development)
- Support for IAM roles (IRSA for EKS, instance profiles)
- Comprehensive documentation (README, AWS setup guide, contributing guide)
- GitHub Actions CI/CD workflows
- TypeScript configuration schema for app-config.yaml

### Frontend Features

- `CostInsightsPage`: Main page component
- `EC2Overview`: Cost statistics and trend visualization
- `EC2ResourceTable`: Detailed resource breakdown
- Environment selector (legacy/dev/prd)
- Date range picker with month reset
- Cost growth indicators
- Top 5 cost drivers table
- Month-end forecast calculation

### Backend Features

- `S3CostDataClient`: AWS S3 integration for cost data retrieval
- `S3CostInsightsClient`: Cost insights and analytics logic
- REST API endpoints:
  - `GET /health`: Health check and environment listing
  - `GET /last-complete-date`: Last complete billing date
  - `GET /product/ec2/insights`: EC2 cost insights by date range
- Graceful degradation when S3 not configured
- Support for NDJSON data format
- Multi-environment data aggregation

[unreleased]: https://github.com/letthem/backstage-plugin-cost-insights/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/letthem/backstage-plugin-cost-insights/releases/tag/v0.1.0
