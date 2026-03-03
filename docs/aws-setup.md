# AWS Setup Guide

This guide walks you through setting up AWS Cost and Usage Reports (CUR) and configuring S3 for the Cost Insights plugin.

## Prerequisites

- AWS Account with administrator access
- AWS CLI configured locally (for testing)
- Basic understanding of AWS IAM, S3, and billing

## Step 1: Enable AWS Cost and Usage Reports

### 1.1 Navigate to Cost and Usage Reports Console

1. Sign in to the AWS Management Console
2. Go to **Billing and Cost Management** → **Cost & Usage Reports**
3. Click **Create report**

### 1.2 Configure Report Details

Configure your report with the following settings:

**Report Content:**

- Report name: `backstage-cost-insights` (or your preferred name)
- Additional report details: Check "Include resource IDs"
- Data refresh settings: Check "Automatically refresh when charges are detected"

**Time granularity:**

- Select **Daily**

**Report versioning:**

- Select **Overwrite existing report**

**Report data integration:**

- Check **Amazon Athena** (for potential future enhancements)

### 1.3 Configure S3 Delivery

**S3 bucket:**

- Click "Configure" to create a new S3 bucket or select an existing one
- Bucket name: `your-company-cost-reports` (must be globally unique)
- Region: Choose your preferred AWS region (e.g., `ap-northeast-2`)

**Report path prefix:**

- Set to your preferred structure, e.g., `cur/`

**Compression type:**

- Select **GZIP** (plugin supports compressed files)

**Enable report data integration for:**

- Check **Amazon Athena**

### 1.4 Review and Create

Review your settings and click **Create report**.

Note: It may take up to 24 hours for AWS to deliver the first report.

## Step 2: Configure S3 Bucket Structure

The Cost Insights plugin expects a specific S3 bucket structure:

```
s3://your-bucket/
├── legacy/
│   └── daily/
│       └── 2024-03/
│           └── run=2024-03-15T10-30-00/
│               └── data-file.ndjson
├── dev/
│   └── daily/
│       └── 2024-03/
│           └── run=2024-03-15T10-30-00/
│               └── data-file.ndjson
└── prd/
    └── daily/
        └── 2024-03/
            └── run=2024-03-15T10-30-00/
                └── data-file.ndjson
```

### Directory Structure Explanation

- **Environment folders** (`legacy/`, `dev/`, `prd/`): Separate cost data by environment
- **`daily/`**: Contains daily cost reports
- **`YYYY-MM/`**: Monthly partitions (e.g., `2024-03/`)
- **`run=YYYY-MM-DDTHH-mm-ss/`**: Timestamp of when the report was generated
- **Data files**: NDJSON (newline-delimited JSON) files containing cost data

### Data File Format

Each data file should be in NDJSON format with the following fields:

```json
{"usage_date":"2024-03-15","resource_id":"i-1234567890abcdef0","resource_type":"instance","product_instance_type":"t3.medium","total_cost":1.25,"usage_amount":24}
{"usage_date":"2024-03-15","resource_id":"vol-1234567890abcdef","resource_type":"volume","product_volume_type":"gp3","total_cost":0.08,"usage_amount":100}
```

**Required Fields:**

- `usage_date`: Date of usage (YYYY-MM-DD format)
- `resource_id`: AWS resource identifier
- `resource_type`: Type of EC2 resource (instance, volume, elastic-ip, etc.)
- `total_cost`: Total cost for that day
- `usage_amount`: Usage quantity

**Optional Fields:**

- `product_instance_type`: EC2 instance type (e.g., t3.medium)
- `product_volume_type`: EBS volume type (e.g., gp3, io1)

## Step 3: Configure IAM Permissions

### 3.1 Create IAM Policy

Create an IAM policy that grants read access to the S3 bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::your-cost-reports-bucket",
        "arn:aws:s3:::your-cost-reports-bucket/*"
      ]
    }
  ]
}
```

### 3.2 Attach Policy to Role/User

Choose one of the following approaches based on your environment:

#### Option A: For EKS with IRSA (Recommended for Production)

1. Create an IAM role with the above policy
2. Configure IRSA (IAM Roles for Service Accounts)
3. Associate the role with your Backstage service account
4. The plugin will automatically use the pod's IAM role

#### Option B: For EC2 Instances

1. Create an IAM role with the above policy
2. Attach the role to your EC2 instance
3. The plugin will use the instance profile credentials

#### Option C: For Local Development with AWS SSO

1. Configure AWS SSO:

   ```bash
   aws configure sso
   ```

2. Add the profile to your `app-config.local.yaml`:
   ```yaml
   costInsights:
     s3:
       region: 'ap-northeast-2'
       bucket: 'your-cost-reports-bucket'
       profile: 'your-sso-profile'
   ```

#### Option D: For IAM User (Not Recommended for Production)

1. Create an IAM user with the above policy
2. Generate access keys
3. Configure via environment variables:
   ```bash
   export AWS_ACCESS_KEY_ID=your-access-key
   export AWS_SECRET_ACCESS_KEY=your-secret-key
   export AWS_REGION=ap-northeast-2
   ```

## Step 4: Verify S3 Bucket Access

### 4.1 Test with AWS CLI

Verify you can access the bucket:

```bash
# List bucket contents
aws s3 ls s3://your-cost-reports-bucket/ --profile your-profile

# Check specific environment
aws s3 ls s3://your-cost-reports-bucket/prd/daily/ --profile your-profile

# Download a sample file
aws s3 cp s3://your-cost-reports-bucket/prd/daily/2024-03/run=2024-03-15T10-30-00/data.ndjson . --profile your-profile
```

### 4.2 Verify Data Format

Check the downloaded file to ensure it matches the expected format:

```bash
head -n 5 data.ndjson
```

Expected output:

```json
{"usage_date":"2024-03-15","resource_id":"i-abc123","resource_type":"instance",...}
{"usage_date":"2024-03-15","resource_id":"vol-def456","resource_type":"volume",...}
```

## Step 5: Configure Backstage Plugin

Update your `app-config.yaml`:

```yaml
costInsights:
  s3:
    region: 'ap-northeast-2' # Your AWS region
    bucket: 'your-cost-reports-bucket' # Your S3 bucket name
    profile: 'your-aws-sso-profile' # Optional: for local dev
```

## Step 6: Test the Integration

1. Start your Backstage instance
2. Navigate to the Cost Insights page
3. Check the browser console for any errors
4. Verify data loads correctly for each environment

## Troubleshooting

### Issue: "AccessDenied" Error

**Cause**: Insufficient IAM permissions

**Solution**:

- Verify IAM policy includes `s3:GetObject` and `s3:ListBucket`
- Check resource ARNs in the policy match your bucket name
- Ensure credentials are correctly configured

### Issue: No Data Showing

**Cause**: Incorrect S3 path structure or missing data

**Solution**:

- Verify S3 bucket structure matches expected format
- Check that data files exist in the correct locations
- Confirm data files are in NDJSON format
- Use AWS CLI to list bucket contents and verify paths

### Issue: "S3 not configured" Error

**Cause**: Missing configuration in app-config.yaml

**Solution**:

- Add `costInsights.s3` section to app-config.yaml
- Ensure `region` and `bucket` are specified
- Restart Backstage backend

### Issue: SSL/TLS Errors

**Cause**: Network or proxy configuration issues

**Solution**:

- Check your network allows outbound HTTPS to S3
- If behind a proxy, configure AWS SDK proxy settings
- Verify SSL certificates are not blocked

## Security Best Practices

1. **Use IAM Roles over Access Keys**: Prefer IRSA or instance profiles over hardcoded credentials
2. **Least Privilege**: Grant only necessary S3 permissions
3. **Encrypt Data**: Enable S3 bucket encryption at rest
4. **Audit Access**: Enable S3 access logging and CloudTrail
5. **Rotate Credentials**: Regularly rotate access keys if using IAM users
6. **Use Private Endpoints**: Consider using VPC endpoints for S3 access

## Cost Optimization

- **S3 Lifecycle Policies**: Archive old reports to S3 Glacier
- **Intelligent Tiering**: Use S3 Intelligent-Tiering for automatic cost optimization
- **Compression**: Ensure reports are compressed (GZIP) to reduce storage costs
- **Retention**: Set up lifecycle rules to delete reports older than your retention period

## Next Steps

- Review [Configuration Guide](./configuration.md) for advanced plugin settings
- Check [Architecture Documentation](./architecture.md) to understand data flow
- See [Troubleshooting Guide](./troubleshooting.md) for common issues

## References

- [AWS Cost and Usage Reports User Guide](https://docs.aws.amazon.com/cur/latest/userguide/)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [IRSA Documentation](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
