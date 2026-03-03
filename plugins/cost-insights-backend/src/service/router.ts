import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';
import express from 'express';
import Router from 'express-promise-router';
import { DateTime } from 'luxon';
import { S3CostDataClient } from './S3CostDataClient';
import { S3CostInsightsClient } from './S3CostInsightsClient';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;

  const router = Router();
  router.use(express.json());

  const costInsightsConfig = config.getOptionalConfig('costInsights');
  const s3Config = costInsightsConfig?.getOptionalConfig('s3');

  if (!s3Config) {
    logger.warn('[CostInsights] S3 configuration not found');
    router.get('/health', (_, res) => {
      res.json({ status: 'ok', message: 'S3 not configured' });
    });
    return router;
  }

  const environments =
    costInsightsConfig?.getOptionalStringArray('environments') ?? ['prd'];
  const configuredDefaultEnvironment =
    costInsightsConfig?.getOptionalString('defaultEnvironment') ??
    environments[0];
  const defaultEnvironment = environments.includes(configuredDefaultEnvironment)
    ? configuredDefaultEnvironment
    : environments[0];
  const monthlyLookbackMonths =
    costInsightsConfig?.getOptionalNumber('monthlyLookbackMonths') ?? 6;

  if (!environments.includes(configuredDefaultEnvironment)) {
    logger.warn(
      `[CostInsights] defaultEnvironment (${configuredDefaultEnvironment}) is not in environments list, fallback to ${defaultEnvironment}`,
    );
  }

  const s3DataClient = new S3CostDataClient(logger, {
    region: s3Config.getString('region'),
    bucket: s3Config.getString('bucket'),
    profile: s3Config.getOptionalString('profile'),
    dailyPrefixTemplate: s3Config.getOptionalString('dailyPrefixTemplate'),
  });

  const costInsightsClient = new S3CostInsightsClient(s3DataClient, logger);

  logger.info(`[CostInsights] Initialized S3 client for environments: ${environments.join(', ')}`)

  router.get('/health', (_, res) => {
    res.json({ status: 'ok', environments });
  });

  router.get('/config', (_, res) => {
    res.json({
      environments,
      defaultEnvironment,
      monthlyLookbackMonths,
    });
  });

  router.get('/last-complete-date', async (req, res) => {
    const { environment = defaultEnvironment } = req.query as {
      environment?: string;
    };

    if (!environments.includes(environment)) {
      res.status(400).json({ error: `Invalid environment: ${environment}` });
      return;
    }

    const date = await costInsightsClient.getLastCompleteBillingDate();
    res.json({ date, environment });
  });

  router.get('/product/ec2/insights', async (req, res) => {
    const { intervals, environment = defaultEnvironment } = req.query as {
      intervals: string;
      environment?: string;
    };

    logger.info(`[CostInsights] GET /product/ec2/insights - intervals: ${intervals}, environment: ${environment}`);

    if (!intervals) {
      res.status(400).json({ error: 'intervals parameter required' });
      return;
    }

    const [startStr, endStr] = intervals.split('/');
    const start = DateTime.fromISO(startStr ?? '', { setZone: true });
    const end = DateTime.fromISO(endStr ?? '', { setZone: true });
    if (!start.isValid || !end.isValid) {
      res
        .status(400)
        .json({ error: 'intervals must be valid ISO interval: start/end' });
      return;
    }
    if (start > end) {
      res
        .status(400)
        .json({ error: 'interval start must be before or equal to end' });
      return;
    }
    const monthDiff = Math.abs(
      end.startOf('month').diff(start.startOf('month'), 'months').months,
    );
    if (monthDiff > 24) {
      res
        .status(400)
        .json({ error: 'intervals range must be within 24 months' });
      return;
    }

    if (!environments.includes(environment)) {
      res.status(400).json({ error: `Invalid environment: ${environment}` });
      return;
    }

    const insights = await costInsightsClient.getEC2Insights(
      intervals,
      environment,
      monthlyLookbackMonths,
    );
    res.json({ ...insights, environment });
  });

  logger.info(`[CostInsights] Router initialized successfully for environments: ${environments.join(', ')}`);

  return router;
}
