import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
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
import { useState } from 'react';
import {
  CartesianGrid,
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
  dailyCosts: Array<{
    date: string;
    cost: number;
  }>;
}

interface EC2ResourceRowProps {
  resource: EC2Resource;
}

function EC2ResourceRow({ resource }: EC2ResourceRowProps) {
  const [open, setOpen] = useState(false);

  const maxCost = Math.max(...resource.dailyCosts.map(d => d.cost), 1);
  const avgCost =
    resource.dailyCosts.length > 0
      ? resource.dailyCosts.reduce((sum, d) => sum + d.cost, 0) /
        resource.dailyCosts.length
      : 0;
  const peakCost = Math.max(...resource.dailyCosts.map(d => d.cost), 0);
  const peakDate =
    resource.dailyCosts.find(d => d.cost === peakCost)?.date || '';

  const getResourceTypeLabel = () => {
    if (resource.resourceType === 'instance' && resource.instanceType) {
      return resource.instanceType;
    }
    if (
      resource.resourceType === 'snapshot' ||
      resource.resourceType === 'volume'
    ) {
      return resource.volumeType
        ? `${resource.resourceType} (${resource.volumeType})`
        : resource.resourceType;
    }
    return resource.resourceType || 'N/A';
  };

  return (
    <>
      <TableRow>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>{resource.resourceId}</TableCell>
        <TableCell>{getResourceTypeLabel()}</TableCell>
        <TableCell align="right">
          <strong>${resource.totalCost.toFixed(2)}</strong>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={4}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 4, m: 2, backgroundColor: 'background.default', borderRadius: 1 }}>
              <Grid2 container spacing={3}>
                <Grid2 size={{ sm: 12, md: 4 }}>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    Resource Info
                  </Typography>
                  <Box marginTop={2}>
                    <Typography variant="body2" color="textSecondary">
                      Usage: {resource.usageAmount.toFixed(2)}{' '}
                      {resource.resourceType === 'instance'
                        ? 'hours'
                        : 'GB-month'}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      style={{ marginTop: 8 }}
                    >
                      Total Cost:{' '}
                      <strong>${resource.totalCost.toFixed(2)}</strong>
                    </Typography>
                    <Typography
                      variant="body2"
                      color="textSecondary"
                      style={{ marginTop: 8 }}
                    >
                      Type: {getResourceTypeLabel()}
                    </Typography>
                  </Box>
                </Grid2>

                <Grid2 size={{ sm: 12, md: 8 }}>
                  <Typography
                    variant="h6"
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    Daily Cost Trend
                  </Typography>
                  {resource.dailyCosts.length > 0 ? (
                    <>
                      <Box sx={{ mt: 2, mb: 2 }}>
                        <ResponsiveContainer width="100%" height={150}>
                          <LineChart data={resource.dailyCosts}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#e0e0e0"
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              tickFormatter={value => {
                                const date = new Date(value);
                                return `${
                                  date.getMonth() + 1
                                }/${date.getDate()}`;
                              }}
                            />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              domain={[0, maxCost * 1.1]}
                            />
                            <Tooltip
                              formatter={(value: number | undefined) =>
                                value !== undefined
                                  ? `$${value.toFixed(2)}`
                                  : ''
                              }
                              labelFormatter={label => `Date: ${label}`}
                            />
                            <Line
                              type="monotone"
                              dataKey="cost"
                              stroke="#1fd9a7"
                              strokeWidth={2}
                              dot={{ r: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                      <Box>
                        <Chip
                          label={`Avg: $${avgCost.toFixed(2)}/day`}
                          size="small"
                          sx={{ mr: 1 }}
                        />
                        <Chip
                          label={`Peak: $${peakCost.toFixed(2)} (${peakDate})`}
                          size="small"
                          color="secondary"
                          sx={{ mr: 1 }}
                        />
                      </Box>
                    </>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      No daily cost data available
                    </Typography>
                  )}
                </Grid2>
              </Grid2>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

interface EC2ResourceTableProps {
  resources: EC2Resource[];
  title?: string;
}

export function EC2ResourceTable({
  resources,
  title = 'EC2 Resources',
}: EC2ResourceTableProps) {
  const totalCost = resources.reduce((sum, r) => sum + r.totalCost, 0);

  return (
    <Box sx={{ mt: 2 }}>
      <Box marginBottom={2}>
        <Typography variant="h6">
          {title} ({resources.length})
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Total Cost: <strong>${totalCost.toFixed(2)}</strong>
        </Typography>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell style={{ width: 50 }} />
              <TableCell>Resource ID</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Total Cost</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resources.map(resource => (
              <EC2ResourceRow key={resource.resourceId} resource={resource} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
