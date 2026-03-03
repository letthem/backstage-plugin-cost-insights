# Cost Insights Backend Plugin

Backstage backend plugin that serves EC2 cost insights from S3 CUR-derived data.

## Overview

This plugin:

- reads daily cost data files from S3
- aggregates costs by resource
- provides monthly rollups
- exposes REST endpoints consumed by the frontend plugin

## Configuration

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
    # Optional: local SSO profile
    # profile: your-aws-profile
    # Optional: prefix template
    # Tokens: {environment}, {yearMonth}, {year}, {month}
    dailyPrefixTemplate: '{environment}/daily/{yearMonth}/'
```

## Auth Behavior

- `auth.allowUnauthenticated: false` -> `user-cookie`
- `auth.allowUnauthenticated: true` -> `unauthenticated`

Default is `false`.

## AWS Credentials

- If `s3.profile` is set, plugin uses that profile (local SSO use case).
- If omitted, plugin uses AWS default credential chain:
  - IRSA (EKS)
  - EC2 Instance Profile
  - environment variables
  - shared credentials/default profile

## API Endpoints

- `GET /health`
- `GET /config`
- `GET /last-complete-date?environment=<env>`
- `GET /product/ec2/insights?intervals=<ISO_START>/<ISO_END>&environment=<env>`

## Query Rules

- `environment` must exist in `costInsights.environments`.
- `intervals` must be valid ISO interval (`start/end`).
- `start <= end`.
- max interval span is 24 months.

## Data Loading Notes

- The plugin resolves the latest `run=` prefix under month prefix.
- It reads all data files in the run prefix (not just one file).
- Non-numeric cost/usage rows are skipped to avoid `NaN` aggregation.

## Input Data Contract

This plugin is data-source agnostic. It does not require Athena specifically.
Any upstream pipeline is valid as long as it writes data in the contract below.

### Storage Layout

- Base location is defined by `costInsights.s3.bucket`.
- Prefix is resolved by `costInsights.s3.dailyPrefixTemplate`.
- Default template:
  - `'{environment}/daily/{yearMonth}/'`
- Under each month prefix, plugin expects one or more `run=` folders:
  - Example: `prd/daily/2026-01/run=2026-01-16T11-14-00/`

### File Discovery Rules

- All files under selected `run=` prefix are scanned.
- Files ending with `-manifest.csv` are ignored.
- Files ending with `.metadata` are ignored.
- Directory markers (`.../`) are ignored.

### File Format

- NDJSON (JSON Lines): one JSON object per line.
- UTF-8 text.

### Required Fields (per line)

- `usage_date`: string, ISO date (for example `2026-01-15`)
- `resource_id`: string
- `resource_type`: string
- `total_cost`: number-like value
- `usage_amount`: number-like value

### Optional Fields

- `product_instance_type`: string
- `product_volume_type`: string

### Validation Behavior

- If `total_cost` or `usage_amount` is not numeric, that row is skipped.
- Resource costs are aggregated by `resource_id`.
- Daily points are sorted by `usage_date` before response.

### Example NDJSON Line

```json
{"usage_date":"2026-01-15","resource_id":"i-0123456789abcdef0","resource_type":"instance","product_instance_type":"m6i.large","product_volume_type":"","total_cost":12.34,"usage_amount":24}
```

## Appendix: Example Athena UNLOAD Query

Use this only as a reference implementation. Any pipeline is valid if it produces
data that matches the Input Data Contract above.

Replace placeholders before use:

- `<cur_database>`, `<cur_table>`
- `<year>`, `<month>`
- `<bucket>`, `<environment>`, `<year-month>`, `<run-timestamp>`

```sql
UNLOAD (
  SELECT
    usage_date,
    resource_id,
    resource_type,
    product_instance_type,
    product_volume_type,
    SUM(total_cost)   AS total_cost,
    SUM(usage_amount) AS usage_amount
  FROM (
    SELECT
      DATE(line_item_usage_start_date) AS usage_date,
      line_item_resource_id AS resource_id,
      'instance' AS resource_type,
      product_instance_type AS product_instance_type,
      '' AS product_volume_type,
      SUM(line_item_unblended_cost) AS total_cost,
      SUM(line_item_usage_amount) AS usage_amount
    FROM <cur_database>.<cur_table>
    WHERE
      line_item_product_code = 'AmazonEC2'
      AND product_product_family = 'Compute Instance'
      AND line_item_line_item_type IN ('Usage', 'DiscountedUsage', 'SavingsPlanCoveredUsage')
      AND year = '<year>'
      AND month = '<month>'
      AND line_item_resource_id IS NOT NULL
    GROUP BY
      DATE(line_item_usage_start_date),
      line_item_resource_id,
      product_instance_type

    UNION ALL

    SELECT
      DATE(line_item_usage_start_date) AS usage_date,
      line_item_resource_id AS resource_id,
      CASE
        WHEN product_product_family = 'Storage Snapshot' THEN 'snapshot'
        ELSE 'volume'
      END AS resource_type,
      '' AS product_instance_type,
      product_volume_type AS product_volume_type,
      SUM(line_item_unblended_cost) AS total_cost,
      SUM(line_item_usage_amount) AS usage_amount
    FROM <cur_database>.<cur_table>
    WHERE
      line_item_product_code = 'AmazonEC2'
      AND line_item_line_item_type = 'Usage'
      AND year = '<year>'
      AND month = '<month>'
      AND product_product_family IN ('Storage', 'Storage Snapshot')
      AND line_item_resource_id IS NOT NULL
    GROUP BY
      DATE(line_item_usage_start_date),
      line_item_resource_id,
      product_product_family,
      product_volume_type

    UNION ALL

    SELECT
      DATE(line_item_usage_start_date) AS usage_date,
      COALESCE(line_item_resource_id, 'Unattached-IP') AS resource_id,
      'elastic-ip' AS resource_type,
      '' AS product_instance_type,
      line_item_usage_type AS product_volume_type,
      SUM(line_item_unblended_cost) AS total_cost,
      SUM(line_item_usage_amount) AS usage_amount
    FROM <cur_database>.<cur_table>
    WHERE
      line_item_product_code = 'AmazonEC2'
      AND line_item_line_item_type = 'Usage'
      AND year = '<year>'
      AND month = '<month>'
      AND product_product_family = 'IP Address'
    GROUP BY
      DATE(line_item_usage_start_date),
      line_item_resource_id,
      line_item_usage_type

    UNION ALL

    SELECT
      DATE(line_item_usage_start_date) AS usage_date,
      line_item_resource_id AS resource_id,
      'nat-gateway' AS resource_type,
      '' AS product_instance_type,
      '' AS product_volume_type,
      SUM(line_item_unblended_cost) AS total_cost,
      SUM(line_item_usage_amount) AS usage_amount
    FROM <cur_database>.<cur_table>
    WHERE
      line_item_product_code = 'AmazonEC2'
      AND line_item_line_item_type = 'Usage'
      AND year = '<year>'
      AND month = '<month>'
      AND (line_item_resource_id LIKE 'nat-%' OR product_product_family = 'NAT Gateway')
      AND line_item_resource_id IS NOT NULL
    GROUP BY
      DATE(line_item_usage_start_date),
      line_item_resource_id

    UNION ALL

    SELECT
      DATE(line_item_usage_start_date) AS usage_date,
      COALESCE(line_item_resource_id, 'Data-Transfer') AS resource_id,
      'data-transfer' AS resource_type,
      '' AS product_instance_type,
      CASE
        WHEN COUNT(DISTINCT product_transfer_type) > 1 THEN 'Mixed'
        ELSE MAX(product_transfer_type)
      END AS product_volume_type,
      SUM(line_item_unblended_cost) AS total_cost,
      SUM(line_item_usage_amount) AS usage_amount
    FROM <cur_database>.<cur_table>
    WHERE
      line_item_product_code = 'AmazonEC2'
      AND line_item_line_item_type = 'Usage'
      AND year = '<year>'
      AND month = '<month>'
      AND product_product_family = 'Data Transfer'
    GROUP BY
      DATE(line_item_usage_start_date),
      line_item_resource_id

    UNION ALL

    SELECT
      DATE(line_item_usage_start_date) AS usage_date,
      COALESCE(line_item_resource_id, 'VPC-Peering') AS resource_id,
      'vpc' AS resource_type,
      '' AS product_instance_type,
      CASE
        WHEN COUNT(DISTINCT product_product_family) > 1 THEN 'Mixed'
        ELSE MAX(product_product_family)
      END AS product_volume_type,
      SUM(line_item_unblended_cost) AS total_cost,
      SUM(line_item_usage_amount) AS usage_amount
    FROM <cur_database>.<cur_table>
    WHERE
      line_item_product_code = 'AmazonEC2'
      AND line_item_line_item_type = 'Usage'
      AND year = '<year>'
      AND month = '<month>'
      AND (
        line_item_resource_id LIKE 'vpce-%'
        OR product_product_family IN ('VPC Peering', 'VpcEndpoint')
      )
    GROUP BY
      DATE(line_item_usage_start_date),
      line_item_resource_id
  )
  GROUP BY
    usage_date,
    resource_id,
    resource_type,
    product_instance_type,
    product_volume_type
)
TO 's3://<bucket>/<environment>/daily/<year-month>/run=<run-timestamp>/'
WITH (
  format = 'JSON',
  compression = 'NONE'
);
```
