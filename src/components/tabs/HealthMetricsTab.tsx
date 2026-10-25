import React, { useState, useMemo } from 'react';
import { Row, Col, Card, Segmented, Typography, Empty, Space } from 'antd';
import {
  FireOutlined,
  HeartOutlined,
  TrophyOutlined,
  ThunderboltOutlined,
  DashboardOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { Area, Column, Pie, Line } from '@ant-design/plots';
import { UserProfile, DailyMetric } from '../../types';
import { MetricCard } from '../MetricCard';
import { filterDailyMetrics, aggregateMetricsByPeriod, TimeRangeKey } from '../../services/dataService';

const { Title, Text } = Typography;

interface HealthMetricsTabProps {
  profile: UserProfile;
  dailyMetrics: DailyMetric[];
}

export const HealthMetricsTab: React.FC<HealthMetricsTabProps> = ({ profile, dailyMetrics }) => {
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('1y');

  // Filter metrics based on selected time range
  const filteredDaily = useMemo(() => {
    return filterDailyMetrics(dailyMetrics, timeRange);
  }, [dailyMetrics, timeRange]);

  // Downsample if range is all or 3y to ensure buttery smooth performance
  const chartData = useMemo(() => {
    const period = timeRange === 'all' ? 'monthly' : timeRange === '3y' ? 'weekly' : 'daily';
    return aggregateMetricsByPeriod(filteredDaily, period);
  }, [filteredDaily, timeRange]);

  // Weight & BMI records (only entries where weight is present)
  const weightData = useMemo(() => {
    return filteredDaily
      .filter((d) => d.weightKg !== null)
      .map((d) => ({
        date: d.date,
        weight: d.weightKg,
        bmi: d.bmi,
      }));
  }, [filteredDaily]);

  // Steps chart data
  const stepsData = useMemo(() => {
    return chartData.map((d) => ({
      date: d.date,
      steps: d.steps,
      goal: 10000,
    }));
  }, [chartData]);

  // Energy expenditure data
  const energyData = useMemo(() => {
    const res: { date: string; type: string; kcal: number }[] = [];
    chartData.forEach((d) => {
      res.push({ date: d.date, type: 'Active Calories', kcal: d.activeKcal });
      res.push({ date: d.date, type: 'Basal Metabolism', kcal: d.basalKcal });
    });
    return res;
  }, [chartData]);

  // Heart Rate & VO2 Max data
  const vitalsData = useMemo(() => {
    const res: { date: string; metric: string; value: number }[] = [];
    filteredDaily.forEach((d) => {
      if (d.restingHR) {
        res.push({ date: d.date, metric: 'Resting Heart Rate (bpm)', value: d.restingHR });
      }
      if (d.vo2max) {
        res.push({ date: d.date, metric: 'VO2 Max (mL/kg·min)', value: d.vo2max });
      }
    });
    return res;
  }, [filteredDaily]);

  // Workout types breakdown
  const workoutTypePieData = useMemo(() => {
    const counts = profile.workoutTypeCounts || {};
    return Object.keys(counts).map((key) => ({
      type: key.replace(/([A-Z])/g, ' $1').trim(),
      count: counts[key],
    }));
  }, [profile]);

  // Sleep hours data
  const sleepData = useMemo(() => {
    return filteredDaily
      .filter((d) => d.sleepHours > 0)
      .slice(-60) // Show last 60 records for readability
      .map((d) => ({
        date: d.date,
        sleepHours: d.sleepHours,
      }));
  }, [filteredDaily]);

  // Configs for Ant Design Plots
  const weightConfig = {
    data: weightData,
    xField: 'date',
    yField: 'weight',
    height: 280,
    style: {
      fill: 'linear-gradient(-90deg, rgba(24, 144, 255, 0.2) 0%, rgba(24, 144, 255, 0.0) 100%)',
      lineWidth: 3,
      stroke: '#1890ff',
    },
    tooltip: {
      items: [
        { channel: 'y', name: 'Weight (kg)' },
      ],
    },
    scale: {
      y: { nice: true },
    },
    theme: 'dark',
  };

  const stepsConfig = {
    data: stepsData,
    xField: 'date',
    yField: 'steps',
    height: 280,
    style: {
      fill: '#52c41a',
      radiusTopLeft: 4,
      radiusTopRight: 4,
    },
    scale: {
      y: { nice: true },
    },
    tooltip: {
      items: [{ channel: 'y', name: 'Daily Steps' }],
    },
    theme: 'dark',
  };

  const energyConfig = {
    data: energyData,
    xField: 'date',
    yField: 'kcal',
    colorField: 'type',
    height: 280,
    scale: {
      color: { range: ['#fa8c16', '#13c2c2'] },
    },
    style: {
      lineWidth: 2,
    },
    theme: 'dark',
  };

  const vitalsConfig = {
    data: vitalsData,
    xField: 'date',
    yField: 'value',
    colorField: 'metric',
    height: 280,
    scale: {
      color: { range: ['#ff4d4f', '#722ed1'] },
      y: { nice: true },
    },
    style: {
      lineWidth: 2,
    },
    theme: 'dark',
  };

  const pieConfig = {
    data: workoutTypePieData,
    angleField: 'count',
    colorField: 'type',
    radius: 0.8,
    innerRadius: 0.5,
    height: 280,
    legend: {
      color: {
        position: 'bottom',
        layout: { justifyContent: 'center' },
      },
    },
    theme: 'dark',
  };

  const sleepConfig = {
    data: sleepData,
    xField: 'date',
    yField: 'sleepHours',
    height: 280,
    style: {
      fill: '#722ed1',
      radiusTopLeft: 4,
      radiusTopRight: 4,
    },
    scale: {
      y: { nice: true },
    },
    tooltip: {
      items: [{ channel: 'y', name: 'Sleep (hours)' }],
    },
    theme: 'dark',
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Top Filter & Summary Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0, color: '#fff' }}>
            Health & Activity Metrics
          </Title>
          <Text style={{ color: '#8c9ba5' }}>
            Data timeline from Apple Health export: {profile.dateRange?.start} to {profile.dateRange?.end}
          </Text>
        </div>

        <Space>
          <Text style={{ color: '#8c9ba5', fontSize: 13 }}>Timeline Filter:</Text>
          <Segmented<TimeRangeKey>
            value={timeRange}
            onChange={(val) => setTimeRange(val)}
            options={[
              { label: '30 Days', value: '30d' },
              { label: '90 Days', value: '90d' },
              { label: '1 Year', value: '1y' },
              { label: '3 Years', value: '3y' },
              { label: 'All Time (10y)', value: 'all' },
            ]}
          />
        </Space>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Current Weight"
            value={profile.currentWeight ?? '—'}
            suffix="kg"
            tag={profile.currentBMI !== null ? `BMI ${profile.currentBMI}` : 'BMI —'}
            tagColor="orange"
            description="Latest weigh-in"
            icon={<DashboardOutlined />}
            delay={0.05}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Avg Daily Steps"
            value={profile.avgDailySteps30d.toLocaleString()}
            suffix="steps"
            tag="Active Walker"
            tagColor="green"
            description="30-day moving avg"
            icon={<ThunderboltOutlined />}
            delay={0.1}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Active Energy"
            value={profile.avgActiveKcal30d}
            suffix="kcal/d"
            tag={`TDEE ~${(profile.avgBasalKcal30d + profile.avgActiveKcal30d).toLocaleString()}`}
            tagColor="volcano"
            description="30-day avg burn"
            icon={<FireOutlined />}
            delay={0.15}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Resting Heart Rate"
            value={profile.avgRestingHR30d}
            suffix="bpm"
            tag="Healthy"
            tagColor="cyan"
            description="Normal sinus rhythm"
            icon={<HeartOutlined />}
            delay={0.2}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Cardio Fitness"
            value={profile.recentVO2Max}
            suffix="VO2 Max"
            tag="Aerobic"
            tagColor="purple"
            description="mL/(kg·min)"
            icon={<TrophyOutlined />}
            delay={0.25}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <MetricCard
            title="Total Workouts"
            value={profile.totalWorkouts}
            suffix="sessions"
            tag="10 Years"
            tagColor="blue"
            description={`${Math.round(profile.totalDistanceKm).toLocaleString()} km logged`}
            icon={<FieldTimeOutlined />}
            delay={0.3}
          />
        </Col>
      </Row>

      {/* Main Charts Grid */}
      <Row gutter={[20, 20]}>
        {/* Weight & Body Composition */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <DashboardOutlined style={{ color: '#1890ff' }} />
                <span>Body Weight & BMI Progression</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            {weightData.length > 0 ? (
              <Area {...weightConfig} />
            ) : (
              <Empty description="No weight data in selected time range" />
            )}
          </Card>
        </Col>

        {/* Daily Steps */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#52c41a' }} />
                <span>Daily Steps & Walking Activity</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            {stepsData.length > 0 ? (
              <Column {...stepsConfig} />
            ) : (
              <Empty description="No steps recorded in selected time range" />
            )}
          </Card>
        </Col>

        {/* Energy Expenditure */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: '#fa8c16' }} />
                <span>Daily Energy Burn: Active vs Basal (kcal)</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            {energyData.length > 0 ? (
              <Line {...energyConfig} />
            ) : (
              <Empty description="No energy data in selected range" />
            )}
          </Card>
        </Col>

        {/* Cardiovascular Vitals */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <HeartOutlined style={{ color: '#ff4d4f' }} />
                <span>Cardiovascular Health (Resting HR & VO2 Max)</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            {vitalsData.length > 0 ? (
              <Line {...vitalsConfig} />
            ) : (
              <Empty description="No vitals recorded in selected range" />
            )}
          </Card>
        </Col>

        {/* Workout Activity Distribution */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#faad14' }} />
                <span>Workout Distribution by Activity Type</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            <Pie {...pieConfig} />
          </Card>
        </Col>

        {/* Sleep Analysis */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <FieldTimeOutlined style={{ color: '#722ed1' }} />
                <span>Sleep Duration (Hours per Night)</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            {sleepData.length > 0 ? (
              <Column {...sleepConfig} />
            ) : (
              <Empty description="No sleep records in selected range" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
