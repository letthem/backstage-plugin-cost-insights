import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
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
import { useMemo, useState } from 'react';
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
import { DateTime } from 'luxon';

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
  startDate?: DateTime | null;
  endDate?: DateTime | null;
}

export function EC2Overview({ resources, monthlyData = [], startDate, endDate }: EC2OverviewProps) {
  const [monthsToShow, setMonthsToShow] = useState<6 | 12>(6);

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

    // Only show forecast when the ENTIRE current month is selected
    const now = DateTime.now();
    const currentMonthStart = now.startOf('month');

    // Check if startDate and endDate represent the current month period
    if (!startDate || !endDate) return null;

    const isCurrentMonthStart = startDate.hasSame(currentMonthStart, 'day');
    const isCurrentMonth = endDate.hasSame(now, 'month') && endDate.hasSame(now, 'year');

    if (!isCurrentMonthStart || !isCurrentMonth) return null;

    const daysInMonth = now.daysInMonth || 30;
    const currentDay = now.day;

    // Avoid division by zero
    if (currentDay <= 0) return null;

    const avgDailyCost = totalCost / currentDay;

    const remainingDays = daysInMonth - currentDay;
    const predictedTotal = totalCost + avgDailyCost * remainingDays;

    return {
      current: totalCost,
      predicted: predictedTotal,
      remainingDays,
      avgDailyCost,
    };
  }, [dailyTrendData, totalCost, startDate, endDate]);


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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${totalCost.toFixed(2)}
              </Typography>
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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${instancesCost.toFixed(2)}
              </Typography>
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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${volumeCost.toFixed(2)}
              </Typography>
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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${elasticIpCost.toFixed(2)}
              </Typography>
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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${natGatewayCost.toFixed(2)}
              </Typography>
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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${dataTransferCost.toFixed(2)}
              </Typography>
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
              <Typography sx={{ fontSize: 32, fontWeight: 600 }}>
                ${vpcCost.toFixed(2)}
              </Typography>
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
              stroke="#6ac2e5"
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
              stroke="#1976d2"
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
          <Box sx={{ pt: 6, pb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Monthly Comparison
            </Typography>
            <ButtonGroup size="small" variant="outlined">
              <Button
                variant={monthsToShow === 6 ? 'contained' : 'outlined'}
                onClick={() => setMonthsToShow(6)}
              >
                6 Months
              </Button>
              <Button
                variant={monthsToShow === 12 ? 'contained' : 'outlined'}
                onClick={() => setMonthsToShow(12)}
              >
                12 Months
              </Button>
            </ButtonGroup>
          </Box>
          <Box sx={{ mt: 3, mb: 3 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData.slice(-monthsToShow)}>
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
                  fill="#6ac2e5"
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
                  fill="#1976d2"
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
