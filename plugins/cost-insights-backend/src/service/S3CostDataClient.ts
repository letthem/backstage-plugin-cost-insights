import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import type { LoggerService } from '@backstage/backend-plugin-api';
import { Readable } from 'stream';

export interface EC2ResourceData {
  resourceId: string;
  resourceType:
    | 'instance'
    | 'elastic-ip'
    | 'other'
    | 'snapshot'
    | 'volume'
    | 'nat-gateway'
    | 'data-transfer'
    | 'vpc';
  instanceType?: string;
  volumeType?: string;
  totalCost: number;
  usageAmount: number;
  dailyCosts: Array<{
    date: string;
    cost: number;
  }>;
}

export interface MonthlyCostData {
  month: string;
  instances: number;
  volume: number;
  elasticIp: number;
  natGateway: number;
  dataTransfer: number;
  vpc: number;
  total: number;
}

interface S3DailyCostRow {
  usage_date: string;
  resource_id: string;
  resource_type: string;
  product_instance_type: string;
  product_volume_type: string;
  total_cost: number;
  usage_amount: number;
}

/**
 * Convert S3 readable stream to string
 */
function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

/**
 * Find the latest run prefix under a month prefix
 * Example: legacy/daily/2026-01/ -> legacy/daily/2026-01/run=2026-01-16T11-14-00/
 */
async function findLatestRunPrefix(params: {
  s3: S3Client;
  bucket: string;
  monthPrefix: string;
}): Promise<string> {
  const { s3, bucket, monthPrefix } = params;

  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: monthPrefix,
      Delimiter: '/', // List "folders" as CommonPrefixes
    }),
  );

  const runs = (res.CommonPrefixes ?? [])
    .map(p => p.Prefix)
    .filter((p): p is string => !!p)
    .filter(p => p.includes('run=')); // Only run=YYYY-MM-DDTHH-mm-ss/

  if (runs.length === 0) {
    throw new Error(
      `No run prefixes found under: s3://${bucket}/${monthPrefix}`,
    );
  }

  runs.sort();
  return runs[runs.length - 1];
}

/**
 * Find data files under a run prefix (without manifest)
 * Returns all data files found
 */
async function findDataFileKeys(params: {
  s3: S3Client;
  bucket: string;
  runPrefix: string;
}): Promise<string[]> {
  const { s3, bucket, runPrefix } = params;

  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: runPrefix,
    }),
  );

  const dataFiles = (res.Contents ?? [])
    .map(o => o.Key)
    .filter((k): k is string => !!k)
    .filter(k => !k.endsWith('-manifest.csv'))
    .filter(k => !k.endsWith('.metadata'))
    .filter(k => !k.endsWith('/'))
    .sort();

  if (dataFiles.length === 0) {
    throw new Error(
      `No data files found under: s3://${bucket}/${runPrefix}`,
    );
  }

  return dataFiles;
}

/**
 * Parse NDJSON (JSON Lines) to S3DailyCostRow array
 */
function parseNdjsonDailyCostRows(ndjson: string): S3DailyCostRow[] {
  const rows: S3DailyCostRow[] = [];

  for (const line of ndjson.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const obj = JSON.parse(trimmed);

    const totalCost = Number(obj.total_cost);
    const usageAmount = Number(obj.usage_amount);
    if (!Number.isFinite(totalCost) || !Number.isFinite(usageAmount)) {
      continue;
    }

    rows.push({
      usage_date: obj.usage_date,
      resource_id: obj.resource_id,
      resource_type: obj.resource_type,
      product_instance_type: obj.product_instance_type ?? '',
      product_volume_type: obj.product_volume_type ?? '',
      total_cost: totalCost,
      usage_amount: usageAmount,
    });
  }

  return rows;
}

/**
 * Map S3 resource_type to EC2ResourceData resourceType
 */
function mapResourceType(s3Type: string): EC2ResourceData['resourceType'] {
  const normalized = s3Type.toLowerCase();

  if (normalized.includes('instance') || normalized.includes('compute'))
    return 'instance';
  if (normalized.includes('elastic-ip') || normalized.includes('ip address'))
    return 'elastic-ip';
  if (normalized.includes('snapshot')) return 'snapshot';
  if (normalized.includes('volume') || normalized.includes('storage'))
    return 'volume';
  if (normalized.includes('nat')) return 'nat-gateway';
  if (normalized.includes('transfer')) return 'data-transfer';
  if (normalized.includes('vpc') || normalized.includes('endpoint'))
    return 'vpc';

  return 'other';
}

export class S3CostDataClient {
  private client: S3Client;
  private bucket: string;
  private dailyPrefixTemplate: string;

  constructor(
    private readonly logger: LoggerService,
    config: {
      region: string;
      bucket: string;
      profile?: string;
      dailyPrefixTemplate?: string;
    },
  ) {
    const credentialConfig = config.profile
      ? {
          region: config.region,
          credentials: fromNodeProviderChain({
            profile: config.profile,
          }),
        }
      : {
          region: config.region,
        };

    this.client = new S3Client(credentialConfig);
    this.bucket = config.bucket;
    this.dailyPrefixTemplate =
      config.dailyPrefixTemplate || '{environment}/daily/{yearMonth}/';

    const authMethod = config.profile
      ? `SSO Profile: ${config.profile}`
      : 'Default credential chain (IRSA/EC2 instance profile)';

    this.logger.info(
      `[CostInsights] S3CostDataClient initialized successfully - Auth: ${authMethod}, Bucket: ${this.bucket}, Region: ${config.region}`,
    );
  }

  private buildDailyPrefix(params: {
    environment: string;
    year: string;
    month: string;
  }): string {
    const { environment, year, month } = params;
    const paddedMonth = month.padStart(2, '0');
    const yearMonth = `${year}-${paddedMonth}`;

    return this.dailyPrefixTemplate
      .replace('{environment}', environment)
      .replace('{yearMonth}', yearMonth)
      .replace('{year}', year)
      .replace('{month}', paddedMonth);
  }

  async queryEC2Resources(
    environment: string,
    year: string,
    month: string,
  ): Promise<EC2ResourceData[]> {
    const paddedMonth = month.padStart(2, '0');
    const yearMonth = `${year}-${paddedMonth}`;
    const monthPrefix = this.buildDailyPrefix({ environment, year, month });

    this.logger.info(
      `[CostInsights] Loading daily EC2 data from S3: ${environment}/${yearMonth}`,
    );

    const runPrefix = await findLatestRunPrefix({
      s3: this.client,
      bucket: this.bucket,
      monthPrefix,
    });

    this.logger.debug(`[CostInsights] Found run prefix: ${runPrefix}`);

    const dataFileKeys = await findDataFileKeys({
      s3: this.client,
      bucket: this.bucket,
      runPrefix,
    });

    this.logger.debug(
      `[CostInsights] Found ${dataFileKeys.length} data files under ${runPrefix}`,
    );

    const rowsByFile = await Promise.all(
      dataFileKeys.map(async dataFileKey => {
        const dataObj = await this.client.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: dataFileKey,
          }),
        );

        if (!dataObj.Body) {
          throw new Error(
            `Data file has empty body: s3://${this.bucket}/${dataFileKey}`,
          );
        }

        const ndjson = await streamToString(dataObj.Body as Readable);
        return parseNdjsonDailyCostRows(ndjson);
      }),
    );
    const dailyRows = rowsByFile.flat();

    this.logger.info(
      `[CostInsights] Loaded ${dailyRows.length} daily records from S3 for ${environment}/${yearMonth}`,
    );

    const resourceMap = new Map<string, {
      resourceType: string;
      instanceType: string;
      volumeType: string;
      totalCost: number;
      usageAmount: number;
      dailyCosts: Array<{ date: string; cost: number }>;
    }>();

    dailyRows.forEach(row => {
      const key = row.resource_id;

      if (!resourceMap.has(key)) {
        resourceMap.set(key, {
          resourceType: row.resource_type,
          instanceType: row.product_instance_type,
          volumeType: row.product_volume_type,
          totalCost: 0,
          usageAmount: 0,
          dailyCosts: [],
        });
      }

      const resource = resourceMap.get(key)!;
      resource.totalCost += row.total_cost;
      resource.usageAmount += row.usage_amount;
      resource.dailyCosts.push({
        date: row.usage_date,
        cost: row.total_cost,
      });
    });

    const result: EC2ResourceData[] = [];

    resourceMap.forEach((data, resourceId) => {
      result.push({
        resourceId: resourceId || 'Unknown',
        resourceType: mapResourceType(data.resourceType),
        instanceType: data.instanceType || undefined,
        volumeType: data.volumeType || undefined,
        totalCost: data.totalCost,
        usageAmount: data.usageAmount,
        dailyCosts: data.dailyCosts.sort((a, b) => a.date.localeCompare(b.date)),
      });
    });

    result.sort((a, b) => b.totalCost - a.totalCost);

    this.logger.info(
      `[CostInsights] Aggregated ${result.length} resources from ${dailyRows.length} daily records`,
    );

    return result;
  }

  /**
   * Query monthly EC2 costs for a specific environment
   * Reads daily data for each month and aggregates by resource type
   * @param environment - legacy, dev, or prd
   * @param numMonths - number of months to look back (default: 6)
   */
  async queryMonthlyEC2Costs(
    environment: string,
    numMonths: number = 6,
  ): Promise<MonthlyCostData[]> {
    const now = new Date();
    const monthlyData: MonthlyCostData[] = [];

    this.logger.info(
      `[CostInsights] Loading monthly costs for ${environment}, last ${numMonths} months`,
    );

    for (let i = numMonths - 1; i >= 0; i--) {
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1,
      );
      const year = targetDate.getFullYear().toString();
      const month = (targetDate.getMonth() + 1).toString();
      const paddedMonth = month.padStart(2, '0');
      const monthKey = `${year}-${paddedMonth}`;

      try {
        const resources = await this.queryEC2Resources(
          environment,
          year,
          month,
        );

        const monthData: MonthlyCostData = {
          month: monthKey,
          instances: 0,
          volume: 0,
          elasticIp: 0,
          natGateway: 0,
          dataTransfer: 0,
          vpc: 0,
          total: 0,
        };

        resources.forEach(resource => {
          switch (resource.resourceType) {
            case 'instance':
              monthData.instances += resource.totalCost;
              break;
            case 'volume':
            case 'snapshot':
              monthData.volume += resource.totalCost;
              break;
            case 'elastic-ip':
              monthData.elasticIp += resource.totalCost;
              break;
            case 'nat-gateway':
              monthData.natGateway += resource.totalCost;
              break;
            case 'data-transfer':
              monthData.dataTransfer += resource.totalCost;
              break;
            case 'vpc':
              monthData.vpc += resource.totalCost;
              break;
            default:
              break;
          }
          monthData.total += resource.totalCost;
        });

        monthlyData.push(monthData);

        this.logger.debug(
          `[CostInsights] Monthly data for ${monthKey}: $${monthData.total.toFixed(2)}`,
        );
      } catch (error) {
        this.logger.warn(
          `[CostInsights] Failed to load data for ${environment}/${monthKey}: ${error}`,
        );
        monthlyData.push({
          month: monthKey,
          instances: 0,
          volume: 0,
          elasticIp: 0,
          natGateway: 0,
          dataTransfer: 0,
          vpc: 0,
          total: 0,
        });
      }
    }

    return monthlyData;
  }
}
