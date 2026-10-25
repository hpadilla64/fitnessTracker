import React, { useState, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Form,
  InputNumber,
  Slider,
  Select,
  Alert,
  Table,
  Tag,
  Typography,
  Space,
  Button,
  Statistic,
  Divider,
  Modal,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AimOutlined,
  ThunderboltOutlined,
  FireOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  TrophyOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Line } from '@ant-design/plots';
import { UserProfile, WeightGoalConfig, RoutineExercise, TrainingFocus } from '../../types';
import { evaluateWeightGoalAndRecommendRoutine, DEFAULT_WEIGHT_KG } from '../../services/recommendationEngine';

const { Title, Text, Paragraph } = Typography;

interface WeightGoalPlannerTabProps {
  profile: UserProfile;
}

export const WeightGoalPlannerTab: React.FC<WeightGoalPlannerTabProps> = ({ profile }) => {
  const initialCurrentWeight = profile.currentWeight || DEFAULT_WEIGHT_KG;

  // Form states
  const [currentWeight, setCurrentWeight] = useState<number>(initialCurrentWeight);
  const [targetWeight, setTargetWeight] = useState<number>(Math.max(60, Math.round((initialCurrentWeight - 12) * 10) / 10));
  const [timeframeWeeks, setTimeframeWeeks] = useState<number>(16);
  const [workoutDays, setWorkoutDays] = useState<number>(4);
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus>('balanced');

  // Modal state for viewing full exercise details
  const [selectedSession, setSelectedSession] = useState<RoutineExercise | null>(null);

  // Evaluate goal configuration and generate routine
  const evaluation = useMemo(() => {
    const config: WeightGoalConfig = {
      currentWeightKg: currentWeight,
      targetWeightKg: targetWeight,
      timeframeWeeks,
      workoutDaysPerWeek: workoutDays,
      trainingFocus,
      activityLevel: 'active',
    };
    return evaluateWeightGoalAndRecommendRoutine(profile, config);
  }, [profile, currentWeight, targetWeight, timeframeWeeks, workoutDays, trainingFocus]);

  // Projected weight chart data
  const trajectoryChartData = useMemo(() => {
    const data: { week: string; weight: number; type: string }[] = [];
    evaluation.projectedTrajectory.forEach((p) => {
      data.push({
        week: `Wk ${p.week} (${p.date.slice(5)})`,
        weight: p.projectedWeightKg,
        type: 'Projected Goal Path',
      });
      data.push({
        week: `Wk ${p.week} (${p.date.slice(5)})`,
        weight: p.maintenanceWeightKg,
        type: 'Current Baseline',
      });
    });
    return data;
  }, [evaluation]);

  const trajectoryChartConfig = {
    data: trajectoryChartData,
    xField: 'week',
    yField: 'weight',
    colorField: 'type',
    height: 250,
    scale: {
      color: { range: ['#52c41a', '#8c9ba5'] },
      y: { nice: true },
    },
    style: {
      lineWidth: 3,
    },
    tooltip: {
      items: [{ channel: 'y', name: 'Weight (kg)' }],
    },
    theme: 'dark',
  };

  // Ant Design Table Columns for Recommended Routine
  const columns: ColumnsType<RoutineExercise> = [
    {
      title: 'Day',
      dataIndex: 'day',
      key: 'day',
      width: 110,
      render: (day: string, record: RoutineExercise) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ color: record.isRest ? '#8c9ba5' : '#fff' }}>
            {day}
          </Text>
          {record.isRest ? (
            <Tag color="default">Rest</Tag>
          ) : (
            <Tag color="processing">Training</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Workout Category',
      dataIndex: 'workoutType',
      key: 'workoutType',
      width: 200,
      render: (type: string, record: RoutineExercise) => {
        let color = 'cyan';
        if (record.isRest) color = 'default';
        else if (type.includes('Strength')) color = 'gold';
        else if (type.includes('HIIT')) color = 'volcano';
        else if (type.includes('Walking')) color = 'green';
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      title: 'Session Title & Details',
      dataIndex: 'sessionTitle',
      key: 'sessionTitle',
      render: (title: string, record: RoutineExercise) => (
        <div>
          <div style={{ fontWeight: 600, color: record.isRest ? '#8c9ba5' : '#fff' }}>
            {title}
          </div>
          <div style={{ color: '#8c9ba5', fontSize: 12, marginTop: 4 }}>
            {record.coachingTips}
          </div>
        </div>
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'targetDurationMin',
      key: 'targetDurationMin',
      width: 100,
      align: 'center',
      render: (min: number) => (
        <span>{min > 0 ? `${min} min` : '—'}</span>
      ),
    },
    {
      title: 'Intensity / Zone',
      dataIndex: 'targetHeartRateZone',
      key: 'targetHeartRateZone',
      width: 200,
      render: (zone: string, record: RoutineExercise) => (
        <Text style={{ fontSize: 12, color: record.isRest ? '#8c9ba5' : '#d9d9d9' }}>
          {zone}
        </Text>
      ),
    },
    {
      title: 'Volume / Protocol',
      dataIndex: 'volume',
      key: 'volume',
      width: 180,
      render: (vol: string) => (
        <Text style={{ fontSize: 12 }}>{vol}</Text>
      ),
    },
    {
      title: 'Est. Burn',
      dataIndex: 'estCaloriesBurned',
      key: 'estCaloriesBurned',
      width: 120,
      align: 'right',
      render: (kcal: number) => (
        kcal > 0 ? (
          <Tag color="red" style={{ fontWeight: 600 }}>
            {kcal} kcal
          </Tag>
        ) : (
          <Text style={{ color: '#8c9ba5' }}>0 kcal</Text>
        )
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_, record: RoutineExercise) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => setSelectedSession(record)}
        >
          View Plan
        </Button>
      ),
    },
  ];

  // Total weekly exercise burn from routine
  const totalWeeklyBurn = evaluation.routine.reduce((sum, r) => sum + r.estCaloriesBurned, 0);
  const totalWeeklyMinutes = evaluation.routine.reduce((sum, r) => sum + r.targetDurationMin, 0);

  // Print/Export routine function
  const handleExport = () => {
    window.print();
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0, color: '#fff' }}>
          Weight Goal Planner & Adaptive Routine Recommendation
        </Title>
        <Text style={{ color: '#8c9ba5' }}>
          Personalized recommendation engine calibrated against your biological data (BMR: ~{profile.avgBasalKcal30d} kcal, TDEE: ~{Math.round(evaluation.tdeeKcal)} kcal).
        </Text>
      </div>

      {/* Goal Configuration Controls & Evaluation Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {/* Left Column: Input Form Controls */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <AimOutlined style={{ color: '#1890ff' }} />
                <span>Configure Your Target & Timeframe</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28', height: '100%' }}
          >
            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={<span style={{ color: '#d9d9d9' }}>Current Weight (kg)</span>}>
                    <InputNumber
                      min={40}
                      max={200}
                      step={0.5}
                      value={currentWeight}
                      onChange={(v) => setCurrentWeight(v || initialCurrentWeight)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: 4 }}>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, fontSize: 11 }}
                        onClick={() => setCurrentWeight(initialCurrentWeight)}
                      >
                        Reset to latest recorded ({initialCurrentWeight} kg)
                      </Button>
                    </div>
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item label={<span style={{ color: '#d9d9d9' }}>Target Weight (kg)</span>}>
                    <InputNumber
                      min={40}
                      max={200}
                      step={0.5}
                      value={targetWeight}
                      onChange={(v) => setTargetWeight(v || 85)}
                      style={{ width: '100%' }}
                    />
                    <div style={{ marginTop: 4, fontSize: 11, color: '#8c9ba5' }}>
                      Change: {Math.round((currentWeight - targetWeight) * 10) / 10} kg
                    </div>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span style={{ color: '#d9d9d9' }}>Target Timeframe: {timeframeWeeks} Weeks (~{Math.round(timeframeWeeks / 4.3)} months)</span>
                  </div>
                }
              >
                <Slider
                  min={2}
                  max={52}
                  marks={{ 4: '4w', 12: '12w', 24: '24w', 36: '36w', 52: '1y' }}
                  value={timeframeWeeks}
                  onChange={(v) => setTimeframeWeeks(v)}
                />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label={<span style={{ color: '#d9d9d9' }}>Weekly Workout Frequency</span>}>
                    <Select
                      value={workoutDays}
                      onChange={(v) => setWorkoutDays(v)}
                      options={[
                        { label: '3 Days / Week (Full Body)', value: 3 },
                        { label: '4 Days / Week (Upper/Lower Split)', value: 4 },
                        { label: '5 Days / Week (Optimized)', value: 5 },
                        { label: '6 Days / Week (High Frequency)', value: 6 },
                      ]}
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item label={<span style={{ color: '#d9d9d9' }}>Training Focus</span>}>
                    <Select
                      value={trainingFocus}
                      onChange={(v) => setTrainingFocus(v as TrainingFocus)}
                      options={[
                        { label: 'Balanced (Cardio & Strength)', value: 'balanced' },
                        { label: 'Incline Walk & Zone 2 Cardio', value: 'cardio' },
                        { label: 'Strength & Hypertrophy', value: 'strength' },
                        { label: 'High Calorie Burn (HIIT)', value: 'fat_loss' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>
          </Card>
        </Col>

        {/* Right Column: Calculated Scientific Breakdown & Feasibility */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#fa8c16' }} />
                <span>Caloric Deficit & Feasibility Analysis</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12, background: '#151a28', height: '100%' }}
          >
            {/* Feasibility Alert */}
            <Alert
              message={
                <Space>
                  {evaluation.status === 'safe' && <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  {evaluation.status === 'moderate' && <InfoCircleOutlined style={{ color: '#faad14' }} />}
                  {(evaluation.status === 'aggressive' || evaluation.status === 'extreme') && (
                    <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                  )}
                  <span style={{ fontWeight: 600 }}>
                    {evaluation.status.toUpperCase()} RATE: {evaluation.weeklyWeightChangeKg} kg / week
                  </span>
                </Space>
              }
              description={evaluation.statusMessage}
              type={
                evaluation.status === 'safe'
                  ? 'success'
                  : evaluation.status === 'moderate'
                  ? 'warning'
                  : 'error'
              }
              showIcon={false}
              style={{ marginBottom: 16 }}
            />

            {/* Key Stat Cards */}
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#8c9ba5' }}>Required Daily Deficit</span>}
                    value={evaluation.dailyDeficitKcal}
                    suffix="kcal"
                    valueStyle={{ color: '#fa8c16', fontSize: 20, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#8c9ba5' }}>Target Caloric Intake</span>}
                    value={evaluation.targetIntakeKcal}
                    suffix="kcal"
                    valueStyle={{ color: '#52c41a', fontSize: 20, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#8c9ba5' }}>Weekly Workout Burn</span>}
                    value={totalWeeklyBurn}
                    suffix="kcal"
                    valueStyle={{ color: '#1890ff', fontSize: 20, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small" style={{ background: '#1b2234', textAlign: 'center' }}>
                  <Statistic
                    title={<span style={{ fontSize: 12, color: '#8c9ba5' }}>Weekly Active Time</span>}
                    value={totalWeeklyMinutes}
                    suffix="min"
                    valueStyle={{ color: '#722ed1', fontSize: 20, fontWeight: 700 }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Trajectory Chart */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#d9d9d9', marginBottom: 8 }}>
                Target Weight Trajectory Over {timeframeWeeks} Weeks
              </div>
              <Line {...trajectoryChartConfig} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recommended Exercise Routine Section */}
      <Card
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <TrophyOutlined style={{ color: '#faad14' }} />
              <span>Recommended Weekly Exercise Routine</span>
              <Badge count={`${workoutDays} Days Active / ${7 - workoutDays} Days Rest`} style={{ backgroundColor: '#1890ff' }} />
            </Space>

            <Button icon={<DownloadOutlined />} onClick={handleExport}>
              Print / Save Routine
            </Button>
          </div>
        }
        bordered={false}
        style={{ borderRadius: 12, background: '#151a28' }}
      >
        <Paragraph style={{ color: '#8c9ba5' }}>
          This weekly schedule is customized to achieve your planned exercise deficit of <strong>{evaluation.exerciseDeficitKcal} kcal/day</strong> ({totalWeeklyBurn} kcal/week) while complementing your historical strength and walking stamina.
        </Paragraph>

        {/* Ant Design Table as required by docs/v1-spec.md */}
        <Table<RoutineExercise>
          columns={columns}
          dataSource={evaluation.routine}
          rowKey="day"
          pagination={false}
          style={{ background: 'transparent' }}
          expandable={{
            expandedRowRender: (record) => (
              <div style={{ padding: '8px 16px', background: '#1a2233', borderRadius: 8 }}>
                <Text strong style={{ color: '#1890ff' }}>
                  Detailed Exercise Circuit & Movements:
                </Text>
                <div style={{ marginTop: 8 }}>
                  {record.exercises.map((ex, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 0',
                        borderBottom: idx < record.exercises.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <div>
                        <Text strong style={{ color: '#fff' }}>{ex.name}</Text>
                        <span style={{ color: '#8c9ba5', marginLeft: 12, fontSize: 12 }}>{ex.notes}</span>
                      </div>
                      <div>
                        <Tag color="blue">{ex.sets} sets</Tag>
                        <Tag color="cyan">{ex.repsOrDuration}</Tag>
                      </div>
                    </div>
                  ))}
                </div>
                {record.equipment && (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#8c9ba5' }}>
                    <strong>Required Equipment:</strong> {record.equipment}
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>

      {/* Detail Modal when clicking "View Plan" */}
      <Modal
        title={
          <Space>
            <CalendarOutlined style={{ color: '#1890ff' }} />
            <span>{selectedSession?.day}: {selectedSession?.sessionTitle}</span>
          </Space>
        }
        open={!!selectedSession}
        onCancel={() => setSelectedSession(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedSession(null)}>
            Close
          </Button>,
        ]}
      >
        {selectedSession && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">{selectedSession.workoutType}</Tag>
              <Tag color="green">{selectedSession.targetDurationMin} Minutes</Tag>
              <Tag color="volcano">{selectedSession.estCaloriesBurned} kcal</Tag>
            </Space>

            <Divider style={{ margin: '12px 0' }} />

            <Paragraph>
              <strong>Target Intensity:</strong> {selectedSession.targetHeartRateZone}
            </Paragraph>
            <Paragraph>
              <strong>Target Volume:</strong> {selectedSession.volume}
            </Paragraph>
            <Paragraph>
              <strong>Equipment Needed:</strong> {selectedSession.equipment}
            </Paragraph>

            <Divider style={{ margin: '12px 0' }} />

            <Title level={5}>Exercises in this Workout:</Title>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, color: '#333' }}>
              {selectedSession.exercises.map((ex, idx) => (
                <div key={idx} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{idx + 1}. {ex.name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {ex.sets} Sets × {ex.repsOrDuration} | <em>{ex.notes}</em>
                  </div>
                </div>
              ))}
            </div>

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', padding: 12, borderRadius: 8, color: '#0050b3' }}>
              <strong>Coach's Tip:</strong> {selectedSession.coachingTips}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
