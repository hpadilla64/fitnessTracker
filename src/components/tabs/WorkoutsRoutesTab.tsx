import React, { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Typography,
  Space,
  Input,
  Select,
  Button,
  Statistic,
  Badge,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CompassOutlined,
  SearchOutlined,
  EnvironmentOutlined,
  FieldTimeOutlined,
  FireOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup } from 'react-leaflet';
import { Workout, GpxRoute } from '../../types';

const { Title, Text } = Typography;

interface WorkoutsRoutesTabProps {
  workouts: Workout[];
  routes: Record<string, GpxRoute>;
}

export const WorkoutsRoutesTab: React.FC<WorkoutsRoutesTabProps> = ({ workouts, routes }) => {
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(() => {
    // Default to the first workout that has route data
    const withRoute = workouts.find((w) => w.routeData || (w.routePath && routes[w.routePath.split('/').pop() || '']));
    return withRoute || workouts[0] || null;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Filtered workouts
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      const matchType = selectedType === 'all' || w.type === selectedType;
      const matchSearch =
        !searchQuery ||
        w.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.startDate.includes(searchQuery);
      return matchType && matchSearch;
    });
  }, [workouts, selectedType, searchQuery]);

  // Distinct workout types for dropdown filter
  const workoutTypes = useMemo(() => {
    const types = new Set<string>();
    workouts.forEach((w) => types.add(w.type));
    return Array.from(types);
  }, [workouts]);

  // Selected route data
  const currentRouteData = useMemo(() => {
    if (!selectedWorkout) return null;
    if (selectedWorkout.routeData) return selectedWorkout.routeData;
    if (selectedWorkout.routePath) {
      const filename = selectedWorkout.routePath.split('/').pop() || '';
      return routes[filename] || null;
    }
    return null;
  }, [selectedWorkout, routes]);

  // Table columns for workouts
  const columns: ColumnsType<Workout> = [
    {
      title: 'Activity Type',
      dataIndex: 'type',
      key: 'type',
      width: 170,
      render: (type: string) => {
        let color = 'cyan';
        if (type.includes('Strength')) color = 'gold';
        else if (type.includes('HIIT')) color = 'volcano';
        else if (type.includes('Walking')) color = 'green';
        else if (type.includes('Running')) color = 'magenta';
        return <Tag color={color}>{type.replace(/([A-Z])/g, ' $1').trim()}</Tag>;
      },
    },
    {
      title: 'Date & Time',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 180,
      sorter: (a, b) => a.startDate.localeCompare(b.startDate),
      defaultSortOrder: 'descend',
      render: (dateStr: string) => (
        <Text style={{ fontSize: 13, color: '#d9d9d9' }}>
          {dateStr.slice(0, 16)}
        </Text>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      key: 'durationMinutes',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.durationMinutes - b.durationMinutes,
      render: (m: number) => (
        <span style={{ fontWeight: 600 }}>{m} min</span>
      ),
    },
    {
      title: 'Distance',
      dataIndex: 'distanceKm',
      key: 'distanceKm',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.distanceKm - b.distanceKm,
      render: (km: number) => (
        km > 0 ? `${km} km` : '—'
      ),
    },
    {
      title: 'Calories',
      dataIndex: 'energyKcal',
      key: 'energyKcal',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.energyKcal - b.energyKcal,
      render: (kcal: number) => (
        <Tag color="volcano">{kcal} kcal</Tag>
      ),
    },
    {
      title: 'GPS Route',
      key: 'route',
      width: 110,
      align: 'center',
      render: (_, record: Workout) => {
        const hasRoute = record.routeData || (record.routePath && routes[record.routePath.split('/').pop() || '']);
        return hasRoute ? (
          <Badge status="processing" text={<span style={{ color: '#52c41a', fontSize: 12 }}>GPS Track</span>} />
        ) : (
          <span style={{ color: '#666', fontSize: 12 }}>Indoor/No GPS</span>
        );
      },
    },
    {
      title: 'Select',
      key: 'action',
      width: 90,
      align: 'center',
      render: (_, record: Workout) => (
        <Button
          size="small"
          type={selectedWorkout?.id === record.id ? 'primary' : 'default'}
          onClick={() => setSelectedWorkout(record)}
        >
          View
        </Button>
      ),
    },
  ];

  // Map coordinates
  const polylineCoords = useMemo(() => {
    if (!currentRouteData || !currentRouteData.points || currentRouteData.points.length === 0) {
      return [];
    }
    return currentRouteData.points.map((p) => [p.lat, p.lon] as [number, number]);
  }, [currentRouteData]);

  const mapCenter = useMemo(() => {
    if (polylineCoords.length > 0) {
      return polylineCoords[Math.floor(polylineCoords.length / 2)];
    }
    return [0, 0] as [number, number]; // unused: the map only renders when a route has points
  }, [polylineCoords]);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#fff' }}>
          Workout History & GPX Route Explorer
        </Title>
        <Text style={{ color: '#8c9ba5' }}>
          Browse all {workouts.length} recorded workouts from your Apple Watch and explore GPS-tracked outdoor routes on the interactive map.
        </Text>
      </div>

      {/* Main Grid: Left = Table, Right = Map & Details */}
      <Row gutter={[20, 20]}>
        {/* Workout Catalog Table */}
        <Col xs={24} lg={13}>
          <Card
            title={
              <Space>
                <FieldTimeOutlined style={{ color: '#1890ff' }} />
                <span>Recorded Workouts ({filteredWorkouts.length})</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
            extra={
              <Space wrap>
                <Input
                  placeholder="Search workouts or dates..."
                  prefix={<SearchOutlined />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: 180 }}
                  allowClear
                />
                <Select
                  value={selectedType}
                  onChange={(v) => setSelectedType(v)}
                  style={{ width: 150 }}
                  options={[
                    { label: 'All Activities', value: 'all' },
                    ...workoutTypes.map((t) => ({
                      label: t.replace(/([A-Z])/g, ' $1').trim(),
                      value: t,
                    })),
                  ]}
                />
              </Space>
            }
          >
            <Table<Workout>
              columns={columns}
              dataSource={filteredWorkouts}
              rowKey="id"
              size="middle"
              pagination={{ pageSize: 8, showSizeChanger: false }}
              rowClassName={(record) => (selectedWorkout?.id === record.id ? 'ant-table-row-selected' : '')}
              onRow={(record) => ({
                onClick: () => setSelectedWorkout(record),
                style: { cursor: 'pointer' },
              })}
            />
          </Card>
        </Col>

        {/* Selected Workout Map & Metrics */}
        <Col xs={24} lg={11}>
          <Card
            title={
              <Space>
                <CompassOutlined style={{ color: '#52c41a' }} />
                <span>
                  {selectedWorkout
                    ? `${selectedWorkout.type.replace(/([A-Z])/g, ' $1').trim()} - ${selectedWorkout.startDate.slice(0, 10)}`
                    : 'Select a Workout'}
                </span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28' }}
          >
            {selectedWorkout ? (
              <div>
                {/* Stats Row */}
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: 11, color: '#8c9ba5' }}>Duration</span>}
                        value={selectedWorkout.durationMinutes}
                        suffix="min"
                        valueStyle={{ color: '#fff', fontSize: 18, fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: 11, color: '#8c9ba5' }}>Distance</span>}
                        value={selectedWorkout.distanceKm || (currentRouteData ? currentRouteData.distanceKm : 0)}
                        suffix="km"
                        valueStyle={{ color: '#52c41a', fontSize: 18, fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                      <Statistic
                        title={<span style={{ fontSize: 11, color: '#8c9ba5' }}>Active Energy</span>}
                        value={selectedWorkout.energyKcal}
                        suffix="kcal"
                        valueStyle={{ color: '#fa8c16', fontSize: 18, fontWeight: 700 }}
                      />
                    </Card>
                  </Col>
                </Row>

                {/* Map Section */}
                {polylineCoords.length > 0 ? (
                  <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <MapContainer
                      key={`${selectedWorkout.id}-${polylineCoords.length}`}
                      center={mapCenter}
                      zoom={14}
                      style={{ height: 380, width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />

                      {/* Route Path Polyline */}
                      <Polyline
                        positions={polylineCoords}
                        pathOptions={{
                          color: '#1890ff',
                          weight: 5,
                          opacity: 0.9,
                          lineCap: 'round',
                          lineJoin: 'round',
                        }}
                      />

                      {/* Start Marker (Green) */}
                      {currentRouteData?.startPoint && (
                        <CircleMarker
                          center={[currentRouteData.startPoint.lat, currentRouteData.startPoint.lon]}
                          pathOptions={{ color: '#52c41a', fillColor: '#52c41a', fillOpacity: 1 }}
                          radius={7}
                        >
                          <Popup>
                            <strong>Start Point</strong>
                            <br />
                            Elevation: {currentRouteData.startPoint.ele}m
                          </Popup>
                        </CircleMarker>
                      )}

                      {/* Finish Marker (Red) */}
                      {currentRouteData?.endPoint && (
                        <CircleMarker
                          center={[currentRouteData.endPoint.lat, currentRouteData.endPoint.lon]}
                          pathOptions={{ color: '#f5222d', fillColor: '#f5222d', fillOpacity: 1 }}
                          radius={7}
                        >
                          <Popup>
                            <strong>Finish Point</strong>
                            <br />
                            Elevation: {currentRouteData.endPoint.ele}m
                          </Popup>
                        </CircleMarker>
                      )}
                    </MapContainer>

                    <div style={{ padding: '10px 14px', background: '#1a2233', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8c9ba5' }}>
                      <span>GPS Track Points: {currentRouteData?.pointCount}</span>
                      <span>Route Distance: {currentRouteData?.distanceKm} km</span>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: 380,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#1b2234',
                      borderRadius: 10,
                      border: '1px dashed rgba(255,255,255,0.15)',
                    }}
                  >
                    <EnvironmentOutlined style={{ fontSize: 40, color: '#8c9ba5', marginBottom: 12 }} />
                    <Text style={{ color: '#8c9ba5' }}>
                      No GPS route recorded for this workout (indoor training session).
                    </Text>
                  </div>
                )}
              </div>
            ) : (
              <Empty description="Select a workout to view GPS route and metrics" />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
