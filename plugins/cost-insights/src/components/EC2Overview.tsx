import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

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
  totalCost: number;
  usageAmount: number;
  dailyCosts: Array<{ date: string; cost: number }>;
}

interface EC2OverviewProps {
  resources: EC2Resource[];
  monthlyData?: Array<{
    month: string;
    instances: number;
    volume: number;
    elasticIp: number;
    natGateway: number;
    dataTransfer: number;
    vpc: number;
    total: number;
  }>;
}

export function EC2Overview({ resources, monthlyData = [] }: EC2OverviewProps) {
  const instancesCost = resources
    .filter(r => r.resourceType === 'instance')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const volumeCost = resources
    .filter(r => r.resourceType === 'snapshot' || r.resourceType === 'volume')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const elasticIpCost = resources
    .filter(r => r.resourceType === 'elastic-ip')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const natGatewayCost = resources
    .filter(r => r.resourceType === 'nat-gateway')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const dataTransferCost = resources
    .filter(r => r.resourceType === 'data-transfer')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const vpcCost = resources
    .filter(r => r.resourceType === 'vpc')
    .reduce((sum, r) => sum + r.totalCost, 0);

  const totalCost =
    instancesCost +
    volumeCost +
    elasticIpCost +
    natGatewayCost +
    dataTransferCost +
    vpcCost;

  const calculateGrowth = (
    currentValue: number,
    type:
      | 'total'
      | 'instances'
      | 'volume'
      | 'elasticIp'
      | 'natGateway'
      | 'dataTransfer'
      | 'vpc',
  ) => {
    if (monthlyData.length < 2) return null;

    const lastMonth = monthlyData[monthlyData.length - 2];
    const previousValue = type === 'total' ? lastMonth.total : lastMonth[type];

    if (previousValue === 0) return null;

    const growth = ((currentValue - previousValue) / previousValue) * 100;
    return growth;
  };

  const totalGrowth = calculateGrowth(totalCost, 'total');
  const instancesGrowth = calculateGrowth(instancesCost, 'instances');
  const volumeGrowth = calculateGrowth(volumeCost, 'volume');
  const elasticIpGrowth = calculateGrowth(elasticIpCost, 'elasticIp');
  const natGatewayGrowth = calculateGrowth(natGatewayCost, 'natGateway');
  const dataTransferGrowth = calculateGrowth(dataTransferCost, 'dataTransfer');
  const vpcGrowth = calculateGrowth(vpcCost, 'vpc');

  const dailyTrendData = useMemo(() => {
    const dailyMap = new Map<
      string,
      {
        instances: number;
        volume: number;
        elasticIp: number;
        natGateway: number;
        dataTransfer: number;
        vpc: number;
      }
    >();

    resources.forEach(resource => {
      resource.dailyCosts.forEach(({ date, cost }) => {
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            instances: 0,
            volume: 0,
            elasticIp: 0,
            natGateway: 0,
            dataTransfer: 0,
            vpc: 0,
          });
        }

        const entry = dailyMap.get(date) as {
          instances: number;
          volume: number;
          elasticIp: number;
          natGateway: number;
          dataTransfer: number;
          vpc: number;
        };
        if (resource.resourceType === 'instance') {
          entry.instances += cost;
        } else if (
          resource.resourceType === 'snapshot' ||
          resource.resourceType === 'volume'
        ) {
          entry.volume += cost;
        } else if (resource.resourceType === 'elastic-ip') {
          entry.elasticIp += cost;
        } else if (resource.resourceType === 'nat-gateway') {
          entry.natGateway += cost;
        } else if (resource.resourceType === 'data-transfer') {
          entry.dataTransfer += cost;
        } else if (resource.resourceType === 'vpc') {
          entry.vpc += cost;
        }
      });
    });

    return Array.from(dailyMap.entries())
      .map(([date, costs]) => ({
        date,
        Instances: costs.instances,
        Volume: costs.volume,
        'Elastic IP': costs.elasticIp,
        'NAT Gateway': costs.natGateway,
        'Data Transfer': costs.dataTransfer,
        VPC: costs.vpc,
        Total:
          costs.instances +
          costs.volume +
          costs.elasticIp +
          costs.natGateway +
          costs.dataTransfer +
          costs.vpc,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [resources]);

  const topResources = useMemo(() => {
    return [...resources]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 5)
      .map(resource => ({
        ...resource,
        percentage: totalCost > 0 ? (resource.totalCost / totalCost) * 100 : 0,
      }));
  }, [resources, totalCost]);

  const predictedMonthEndCost = useMemo(() => {
    if (dailyTrendData.length === 0) return null;

    const today = new Date();
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();
    const currentDay = today.getDate();

    const avgDailyCost = totalCost / currentDay;

    const remainingDays = daysInMonth - currentDay;
    const predictedTotal = totalCost + avgDailyCost * remainingDays;

    return {
      current: totalCost,
      predicted: predictedTotal,
      remainingDays,
      avgDailyCost,
    };
  }, [dailyTrendData, totalCost]);

  const renderTrendChip = (growth: number | null) => {
    if (growth === null) return null;

    const isPositive = growth > 0;
    return (
      <Chip
        icon={isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
        label={`${isPositive ? '+' : ''}${growth.toFixed(1)}%`}
        size="small"
        color={isPositive ? 'secondary' : 'primary'}
        sx={{ fontWeight: 600 }}
      />
    );
  };

  return (
    <Box>
      <Grid2 container spacing={3}>
        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                Total EC2 Cost
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${totalCost.toFixed(2)}
              </Typography>
              {renderTrendChip(totalGrowth)}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                EC2 Instances
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${instancesCost.toFixed(2)}
              </Typography>
              {renderTrendChip(instancesGrowth)}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                Volumes
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${volumeCost.toFixed(2)}
              </Typography>
              {renderTrendChip(volumeGrowth)}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                Elastic IP
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${elasticIpCost.toFixed(2)}
              </Typography>
              {renderTrendChip(elasticIpGrowth)}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                NAT Gateway
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${natGatewayCost.toFixed(2)}
              </Typography>
              {renderTrendChip(natGatewayGrowth)}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                Data Transfer
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${dataTransferCost.toFixed(2)}
              </Typography>
              {renderTrendChip(dataTransferGrowth)}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ sm: 12, md: 3 }}>
          <Card
            sx={{
              height: '100%',
              position: 'relative',
              bgcolor: 'background.paper',
            }}
          >
            <CardContent>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1 }}>
                VPC
              </Typography>
              <Typography sx={{ fontSize: 32, fontWeight: 600, mb: 1 }}>
                ${vpcCost.toFixed(2)}
              </Typography>
              {renderTrendChip(vpcGrowth)}
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>

      {predictedMonthEndCost && (
        <Box sx={{ mt: 3 }}>
          <Card
            sx={{
              backgroundColor: 'rgba(33, 150, 243, 0.08)',
              borderLeft: '4px solid',
              borderColor: 'info.main',
            }}
          >
            <CardContent>
              <Typography variant="h6">Month-End Forecast</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Current spend:{' '}
                <strong>${predictedMonthEndCost.current.toFixed(2)}</strong>
              </Typography>
              <Typography variant="body2">
                Predicted month-end:{' '}
                <strong>${predictedMonthEndCost.predicted.toFixed(2)}</strong>
              </Typography>
              <Typography variant="body2">
                Average daily cost: $
                {predictedMonthEndCost.avgDailyCost.toFixed(2)} (
                {predictedMonthEndCost.remainingDays} days remaining)
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}

      <Typography variant="h6" sx={{ pt: 6, pb: 2, fontWeight: 600 }}>
        Current Month Daily Trend
      </Typography>
      <Box sx={{ mt: 3, mb: 3 }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={value => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number | undefined) =>
                value !== undefined ? `$${value.toFixed(2)}` : ''
              }
              labelFormatter={label => `Date: ${label}`}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="Instances"
              stroke="#1976d2"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="Volume"
              stroke="#1fd9a7"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="Elastic IP"
              stroke="#f4b630"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="NAT Gateway"
              stroke="#6ac2e5"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="Data Transfer"
              stroke="#603fba"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="VPC"
              stroke="#aa51f7"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="Total"
              stroke="#e552d1"
              strokeWidth={3}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      <Typography variant="h6" sx={{ pt: 6, pb: 2, fontWeight: 600 }}>
        Top Cost Resources This Month
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Rank</TableCell>
              <TableCell>Resource ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell align="right">% of Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {topResources.map((resource, index) => (
              <TableRow
                key={resource.resourceId}
                sx={{ '&:hover': { backgroundColor: 'action.hover' } }}
              >
                <TableCell>{index + 1}</TableCell>
                <TableCell>{resource.resourceId}</TableCell>
                <TableCell>
                  {resource.resourceType === 'instance' && resource.instanceType
                    ? resource.instanceType
                    : resource.resourceType === 'snapshot' ||
                        resource.resourceType === 'volume'
                      ? resource.volumeType
                        ? `${resource.resourceType} (${resource.volumeType})`
                        : resource.resourceType
                      : resource.resourceType}
                </TableCell>
                <TableCell align="right">
                  <strong>${resource.totalCost.toFixed(2)}</strong>
                </TableCell>
                <TableCell align="right">
                  {resource.percentage.toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {monthlyData.length > 0 && (
        <>
          <Typography variant="h6" sx={{ pt: 6, pb: 2, fontWeight: 600 }}>
            Monthly Comparison (Last 6 Months)
          </Typography>
          <Box sx={{ mt: 3, mb: 3 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number | undefined) =>
                    value !== undefined ? `$${value.toFixed(2)}` : ''
                  }
                />
                <Legend />
                <Bar
                  dataKey="instances"
                  stackId="a"
                  fill="#1976d2"
                  name="Instances"
                />
                <Bar
                  dataKey="volume"
                  stackId="a"
                  fill="#1fd9a7"
                  name="Volume"
                />
                <Bar
                  dataKey="elasticIp"
                  stackId="a"
                  fill="#f4b630"
                  name="Elastic IP"
                />
                <Bar
                  dataKey="natGateway"
                  stackId="a"
                  fill="#6ac2e5"
                  name="NAT Gateway"
                />
                <Bar
                  dataKey="dataTransfer"
                  stackId="a"
                  fill="#603fba"
                  name="Data Transfer"
                />
                <Bar dataKey="vpc" stackId="a" fill="#aa51f7" name="VPC" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
    </Box>
  );
}
