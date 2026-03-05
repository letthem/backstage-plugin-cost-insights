import type { LoggerService } from '@backstage/backend-plugin-api';
import { DateTime } from 'luxon';
import type { EC2ResourceData, S3CostDataClient } from './S3CostDataClient';

const DEFAULT_DATE_FORMAT = 'yyyy-LL-dd';

export class S3CostInsightsClient {
  constructor(
    private readonly s3Client: S3CostDataClient,
    private readonly logger: LoggerService,
  ) {}

  async getLastCompleteBillingDate(): Promise<string> {
    return DateTime.now().minus({ days: 1 }).toFormat(DEFAULT_DATE_FORMAT);
  }

  async getEC2Insights(
    intervals: string,
    environment: string,
  ) {
    const [startDateStr, endDateStr] = intervals.split('/');
    const startDate = DateTime.fromISO(startDateStr ?? '', { zone: 'utc' });
    const endDate = DateTime.fromISO(endDateStr ?? '', { zone: 'utc' });

    if (!startDate.isValid || !endDate.isValid) {
      throw new Error(`Invalid intervals: ${intervals}`);
    }
    if (startDate > endDate) {
      throw new Error(`Invalid intervals, start > end: ${intervals}`);
    }

    const months: Array<{ year: string; month: string }> = [];
    let cursor = startDate.startOf('month');
    const last = endDate.startOf('month');
    while (cursor <= last) {
      months.push({
        year: cursor.toFormat('yyyy'),
        month: cursor.toFormat('M'),
      });
      cursor = cursor.plus({ months: 1 });
    }

    this.logger.info(
      `[CostInsights] Fetching EC2 resources for ${environment}, months=${months.length}, interval=${intervals}`,
    );

    const monthlyResources = await Promise.all(
      months.map(({ year, month }) =>
        this.s3Client.queryEC2Resources(environment, year, month),
      ),
    );

    const merged = new Map<string, EC2ResourceData>();
    for (const resources of monthlyResources) {
      for (const resource of resources) {
        const key = resource.resourceId || 'Unknown';
        const existing = merged.get(key);
        if (!existing) {
          merged.set(key, {
            ...resource,
            dailyCosts: [...resource.dailyCosts],
          });
          continue;
        }

        existing.totalCost += resource.totalCost;
        existing.usageAmount += resource.usageAmount;
        existing.dailyCosts.push(...resource.dailyCosts);
      }
    }

    const ec2Resources = Array.from(merged.values())
      .map(resource => ({
        ...resource,
        dailyCosts: resource.dailyCosts.sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const totalCost = ec2Resources.reduce((sum, r) => sum + r.totalCost, 0);

    // Always fetch 12 months for frontend flexibility (6/12 months toggle)
    const monthlyData = await this.s3Client.queryMonthlyEC2Costs(
      environment,
      12,
    );

    const entities = ec2Resources.map(resource => ({
      id: resource.resourceId || 'Unknown',
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      instanceType: resource.instanceType,
      volumeType: resource.volumeType,
      totalCost: resource.totalCost,
      usageAmount: resource.usageAmount,
      dailyCosts: resource.dailyCosts,
      entities: {},
      aggregation: [resource.totalCost, 0] as [number, number],
      change: { ratio: 0, amount: 0 },
    }));

    return {
      id: 'ec2',
      entities: { ec2: entities },
      monthlyData: monthlyData,
      aggregation: [totalCost, 0] as [number, number],
      change: { ratio: 0, amount: 0 },
    };
  }
}
