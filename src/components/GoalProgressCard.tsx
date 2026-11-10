'use client';
import React, { useMemo } from 'react';
import { Card, Space, Alert, Tag, Statistic, Row, Col, Empty } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import type { GoalProgress, GoalProgressStatus } from '../types/api';

const STATUS_TAG: Record<GoalProgressStatus, { color?: string; label: string }> = {
  ahead: { color: 'green', label: 'Ahead' },
  on_track: { color: 'blue', label: 'On track' },
  behind: { color: 'orange', label: 'Behind' },
  no_data: { label: 'No data' },
};

const cardStyle = { borderRadius: 12, background: '#151a28' };
const statStyle = { borderRadius: 8, background: '#1b2234' };

interface Props {
  progress: GoalProgress | null;
}

export default function GoalProgressCard({ progress }: Props) {
  const data = useMemo(() => {
    if (!progress) return [];
    // G2's time scale needs Date values; YYYY-MM-DD strings collapse onto one x position
    return [
      ...progress.plan.map((p) => ({ date: new Date(p.date), weight: p.weightKg, type: 'Planned path' })),
      ...progress.weighIns.map((p) => ({ date: new Date(p.date), weight: p.weightKg, type: 'Weigh-ins' })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [progress]);

  const title = (
    <Space>
      <LineChartOutlined style={{ color: '#52c41a' }} />
      <span>Goal Progress</span>
    </Space>
  );

  if (!progress) {
    return (
      <Card title={title} variant="borderless" style={cardStyle}>
        <Empty description="Set a goal above to track your progress against it." />
      </Card>
    );
  }

  const { latest, status, startDate, dataEndDate } = progress;
  const tag = STATUS_TAG[status];
  const fmt = (v: number) => v.toFixed(1);

  const config = {
    data,
    xField: 'date',
    yField: 'weight',
    colorField: 'type',
    height: 280,
    scale: {
      x: { type: 'time', mask: 'MMM D' },
      color: { domain: ['Planned path', 'Weigh-ins'], range: ['#52c41a', '#8c9ba5'] },
      y: { nice: true },
    },
    style: { lineWidth: 2 },
    point: { shape: 'circle', size: 3 },
    annotations: [
      { type: 'lineX', data: [new Date(startDate)], style: { stroke: '#faad14', strokeDasharray: [4, 4] } },
    ],
    tooltip: { items: [{ channel: 'y', name: 'Weight (kg)' }] },
    theme: 'dark',
  };

  return (
    <Card title={title} variant="borderless" style={cardStyle} extra={<Tag color={tag.color}>{tag.label}</Tag>}>
      {!latest && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={`No weigh-ins since the goal started on ${startDate}.${
            dataEndDate ? ` Health data ends ${dataEndDate};` : ''
          } import a newer export to track progress.`}
        />
      )}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card variant="borderless" style={statStyle}>
            <Statistic title="Latest weigh-in" value={latest ? fmt(latest.weightKg) : '–'} suffix={latest ? 'kg' : undefined} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card variant="borderless" style={statStyle}>
            <Statistic title="Planned for that date" value={latest ? fmt(latest.plannedKg) : '–'} suffix={latest ? 'kg' : undefined} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card variant="borderless" style={statStyle}>
            <Statistic
              title="Delta (actual − planned)"
              value={latest ? `${latest.deltaKg > 0 ? '+' : ''}${fmt(latest.deltaKg)}` : '–'}
              suffix={latest ? 'kg' : undefined}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card variant="borderless" style={statStyle}>
            <Statistic title="Goal window" value={`${startDate} → ${progress.endDate}`} styles={{ content: { fontSize: 14 } }} />
          </Card>
        </Col>
      </Row>
      {data.length ? <Line {...config} /> : <Empty description="No weight data" />}
    </Card>
  );
}
