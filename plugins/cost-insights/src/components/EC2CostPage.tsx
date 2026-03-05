import {
  Content,
  Header,
  Page,
  Progress,
  TabbedLayout,
} from '@backstage/core-components';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { EC2Overview } from './EC2Overview';
import { EC2ResourceTable } from './EC2ResourceTable';

interface EC2Resource {
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
  volumeSize?: number;
  totalCost: number;
  usageAmount: number;
  dailyCosts: Array<{
    date: string;
    cost: number;
  }>;
}

interface CostInsightsPluginConfig {
  environments: string[];
  defaultEnvironment: string;
}

export function EC2CostPage() {
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  const [environments, setEnvironments] = useState<string[]>([]);
  const [environment, setEnvironment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resources, setResources] = useState<EC2Resource[]>([]);
  const [monthlyData, setMonthlyData] = useState<
    Array<{
      month: string;
      instances: number;
      volume: number;
      elasticIp: number;
      natGateway: number;
      dataTransfer: number;
      vpc: number;
      total: number;
    }>
  >([]);

  const [startDate, setStartDate] = useState<DateTime | null>(
    DateTime.now().startOf('month'),
  );
  const [endDate, setEndDate] = useState<DateTime | null>(
    DateTime.now().startOf('day'),  // Start of today, not current time
  );

  const handleStartDateChange = (newDate: DateTime | null) => {
    setStartDate(newDate);
    if (newDate && endDate && endDate < newDate) {
      setEndDate(newDate);
    }
  };

  const handleEndDateChange = (newDate: DateTime | null) => {
    if (!newDate) {
      setEndDate(newDate);
      return;
    }

    if (startDate && newDate < startDate) {
      return;
    }

    setEndDate(newDate);
  };

  useEffect(() => {
    const fetchPluginConfig = async () => {
      try {
        const baseUrl = await discoveryApi.getBaseUrl('cost-insights');
        const response = await fetchApi.fetch(`${baseUrl}/config`);

        if (!response.ok) {
          throw new Error(
            `Failed to fetch Cost Insights config: ${response.statusText}`,
          );
        }

        const data = (await response.json()) as CostInsightsPluginConfig;
        const envs =
          data.environments && data.environments.length > 0
            ? data.environments
            : ['prd'];
        const defaultEnv = envs.includes(data.defaultEnvironment)
          ? data.defaultEnvironment
          : envs[0];

        setEnvironments(envs);
        setEnvironment(defaultEnv);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchPluginConfig();
  }, [discoveryApi, fetchApi]);

  useEffect(() => {
    if (!environment) {
      return;
    }

    const fetchEC2Data = async () => {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = await discoveryApi.getBaseUrl('cost-insights');

        const from = (startDate ?? DateTime.now().startOf('month'));
        const to = (endDate ?? DateTime.now());
        if (from > to) {
          throw new Error('From date must be before or equal to To date');
        }
        const intervals = `${from.toISODate()}/${to.toISODate()}`;

        const response = await fetchApi.fetch(
          `${baseUrl}/product/ec2/insights?intervals=${encodeURIComponent(
            intervals,
          )}&environment=${encodeURIComponent(environment)}`,
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch EC2 data: ${response.statusText}`);
        }

        const data = await response.json();
        const ec2Resources = data.entities?.ec2 || [];
        const monthlyDataFromAPI = data.monthlyData || [];

        const filtered = ec2Resources.map((resource: any) => {
          const filteredDailyCosts = resource.dailyCosts.filter(({ date }: any) => {
            const dateStr = date.split('T')[0];
            const startStr = from.toISODate();
            const endStr = to.toISODate();
            return dateStr >= (startStr || '') && dateStr <= (endStr || '');
          });

          const totalCost = filteredDailyCosts.reduce(
            (sum: number, { cost }: any) => sum + cost,
            0,
          );

          return {
            ...resource,
            dailyCosts: filteredDailyCosts,
            totalCost,
          };
        });

        setResources(filtered);
        setMonthlyData(monthlyDataFromAPI);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchEC2Data();
  }, [discoveryApi, fetchApi, environment, startDate, endDate]);


  const instanceResources = useMemo(() => {
    return resources.filter((r) => r.resourceType === 'instance');
  }, [resources]);

  const volumeResources = useMemo(() => {
    return resources.filter(
      (r) => r.resourceType === 'snapshot' || r.resourceType === 'volume',
    );
  }, [resources]);

  const elasticIpResources = useMemo(() => {
    return resources.filter((r) => r.resourceType === 'elastic-ip');
  }, [resources]);

  const natGatewayResources = useMemo(() => {
    return resources.filter((r) => r.resourceType === 'nat-gateway');
  }, [resources]);

  const dataTransferResources = useMemo(() => {
    return resources.filter((r) => r.resourceType === 'data-transfer');
  }, [resources]);

  const vpcResources = useMemo(() => {
    return resources.filter((r) => r.resourceType === 'vpc');
  }, [resources]);

  return (
    <Page themeId="tool">
      <Header
        title="EC2 Cost Analysis"
        subtitle="Detailed EC2 resource cost breakdown and trends"
      />
      <Content>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, color: 'text.primary' }}
          ></Typography>
          <ToggleButtonGroup
            value={environment}
            exclusive
            onChange={(_, newEnv: string | null) => {
              if (newEnv !== null) {
                setEnvironment(newEnv);
              }
            }}
            aria-label="environment selection"
            sx={{
              '& .MuiToggleButton-root': {
                px: 3,
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                border: '1px solid',
                borderColor: 'divider',
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  borderColor: 'primary.main',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                    borderColor: 'primary.dark',
                  },
                },
              },
            }}
          >
            {environments.map((env) => (
              <ToggleButton
                key={env}
                value={env}
                aria-label={`${env} environment`}
              >
                {env}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Date Range:
              </Typography>
              <LocalizationProvider dateAdapter={AdapterLuxon}>
                <DatePicker
                  label="From"
                  value={startDate}
                  onChange={handleStartDateChange}
                  slotProps={{
                    textField: { size: 'small', sx: { minWidth: 180 } },
                  }}
                />
                <Typography sx={{ mx: 1 }}>—</Typography>
                <DatePicker
                  label="To"
                  value={endDate}
                  onChange={handleEndDateChange}
                  minDate={startDate || undefined}
                  slotProps={{
                    textField: { size: 'small', sx: { minWidth: 180 } },
                  }}
                />
              </LocalizationProvider>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setStartDate(DateTime.now().startOf('month'));
                  setEndDate(DateTime.now());
                }}
              >
                Reset to Current Month
              </Button>
            </Box>
          </CardContent>
        </Card>
        {loading && <Progress />}

        {error && (
          <Alert severity="error">Error loading EC2 cost data: {error}</Alert>
        )}

        {!loading &&
          !error &&
          resources.length === 0 &&
          monthlyData.length === 0 && (
            <Alert severity="info">No EC2 cost data found</Alert>
          )}

        {!loading &&
          !error &&
          (resources.length > 0 || monthlyData.length > 0) && (
            <TabbedLayout>
              <TabbedLayout.Route path="/" title="Overview">
                <EC2Overview
                  resources={resources}
                  monthlyData={monthlyData}
                  startDate={startDate}
                  endDate={endDate}
                />
              </TabbedLayout.Route>

              {instanceResources.length > 0 && (
                <TabbedLayout.Route path="/instances" title="EC2 Instances">
                  <EC2ResourceTable
                    resources={instanceResources}
                    title="EC2 Instances"
                  />
                </TabbedLayout.Route>
              )}

              {volumeResources.length > 0 && (
                <TabbedLayout.Route path="/volumes" title="Volumes">
                  <EC2ResourceTable
                    resources={volumeResources}
                    title="Volumes & Snapshots"
                  />
                </TabbedLayout.Route>
              )}

              {elasticIpResources.length > 0 && (
                <TabbedLayout.Route path="/elastic-ip" title="Elastic IP">
                  <EC2ResourceTable
                    resources={elasticIpResources}
                    title="Elastic IP Addresses"
                  />
                </TabbedLayout.Route>
              )}

              {natGatewayResources.length > 0 && (
                <TabbedLayout.Route path="/nat-gateway" title="NAT Gateway">
                  <EC2ResourceTable
                    resources={natGatewayResources}
                    title="NAT Gateway"
                  />
                </TabbedLayout.Route>
              )}

              {dataTransferResources.length > 0 && (
                <TabbedLayout.Route path="/data-transfer" title="Data Transfer">
                  <EC2ResourceTable
                    resources={dataTransferResources}
                    title="Data Transfer"
                  />
                </TabbedLayout.Route>
              )}

              {vpcResources.length > 0 && (
                <TabbedLayout.Route path="/vpc" title="VPC">
                  <EC2ResourceTable
                    resources={vpcResources}
                    title="VPC Endpoints"
                  />
                </TabbedLayout.Route>
              )}
            </TabbedLayout>
          )}
      </Content>
    </Page>
  );
}
