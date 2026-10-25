'use client';

import React, { useState, useEffect } from 'react';
import {
  ConfigProvider,
  Layout,
  Tabs,
  Typography,
  Space,
  Tag,
  Spin,
  Alert,
  Result,
  theme,
} from 'antd';
import {
  DashboardOutlined,
  AimOutlined,
  CompassOutlined,
  ThunderboltFilled,
  UserOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchStatus,
  fetchProfile,
  fetchWorkouts,
  fetchPreferences,
  updatePreferences,
  TimeRangeKey,
} from '@/services/dataService';
import { UserProfile } from '@/types';
import type { StatusResponse, WorkoutSummary, TabKey, PreferencesUpdate } from '@/types/api';
import { HealthMetricsTab } from './tabs/HealthMetricsTab';
import { WeightGoalPlannerTab } from './tabs/WeightGoalPlannerTab';
import { WorkoutsRoutesTab } from './tabs/WorkoutsRoutesTab';

const { Header, Content, Footer } = Layout;
const { Title, Text } = Typography;

// Whole years between a YYYY-MM-DD birth date and today
function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
  return age;
}

// Fire-and-forget preference save
function savePreference(update: PreferencesUpdate) {
  updatePreferences(update).catch((err) => console.error('Failed to save preferences:', err));
}

export const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('metrics');
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('1y');

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const st = await fetchStatus();
        setStatus(st);
        if (st.hasData) {
          const [prof, wk, prefs] = await Promise.all([fetchProfile(), fetchWorkouts(), fetchPreferences()]);
          setProfile(prof);
          setWorkouts(wk);
          setActiveTab(prefs.activeTab);
          setTimeRange(prefs.timeRange);
        }
      } catch (err) {
        console.error('Failed to load health data:', err);
        setError('Failed to load health data from the API. Ensure the data has been imported.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    savePreference({ activeTab: key as TabKey });
  };

  const handleTimeRangeChange = (range: TimeRangeKey) => {
    setTimeRange(range);
    savePreference({ timeRange: range });
  };

  const tabItems = [
    {
      key: 'metrics',
      label: (
        <Space>
          <DashboardOutlined />
          <span>Health & Activity Metrics</span>
        </Space>
      ),
      children: profile ? <HealthMetricsTab profile={profile} timeRange={timeRange} onTimeRangeChange={handleTimeRangeChange} /> : null,
    },
    {
      key: 'planner',
      label: (
        <Space>
          <AimOutlined />
          <span>Weight Goals & Routine Recommendation</span>
        </Space>
      ),
      children: profile ? <WeightGoalPlannerTab profile={profile} /> : null,
    },
    {
      key: 'workouts',
      label: (
        <Space>
          <CompassOutlined />
          <span>Workouts & GPX Routes</span>
        </Space>
      ),
      children: <WorkoutsRoutesTab workouts={workouts} />,
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          colorBgBase: '#0c101c',
          colorBgContainer: '#151a28',
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh', background: '#0c101c' }}>
        {/* App Header */}
        <Header
          style={{
            background: 'rgba(21, 26, 40, 0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '0 32px',
            position: 'sticky',
            top: 0,
            zIndex: 1000,
            height: 64,
            lineHeight: 'normal',
          }}
        >
          <div
            style={{
              maxWidth: 1440,
              width: '100%',
              margin: '0 auto',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Logo & App Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 18,
                  boxShadow: '0 2px 10px rgba(24, 144, 255, 0.4)',
                }}
              >
                <ThunderboltFilled />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <Title level={4} style={{ margin: 0, color: '#fff', lineHeight: 1.2, fontWeight: 700 }}>
                  PulseFit Intelligence
                </Title>
                <Text style={{ color: '#8c9ba5', fontSize: 11, letterSpacing: 0.5 }}>
                  Apple Health & Biometrics Analytics
                </Text>
              </div>
            </div>

            {/* User Profile Pill */}
            {profile && (
              <Space wrap size={8}>
                {(profile.sex || profile.dob) && (
                  <Tag icon={<UserOutlined />} color="blue">
                    {[profile.sex, ageFromDob(profile.dob) !== null && `Age ${ageFromDob(profile.dob)}`]
                      .filter(Boolean)
                      .join(', ')}
                  </Tag>
                )}
                {profile.currentWeight !== null && <Tag color="cyan">Weight: {profile.currentWeight} kg</Tag>}
                {profile.recentVO2Max ? <Tag color="purple">VO2 Max: {profile.recentVO2Max}</Tag> : null}
                {profile.bloodType && <Tag color="gold">Blood: {profile.bloodType}</Tag>}
              </Space>
            )}
          </div>
        </Header>

        {/* Content Area */}
        <Content style={{ padding: '24px 32px', maxWidth: 1440, width: '100%', margin: '0 auto' }}>
          {loading ? (
            <div
              style={{
                minHeight: '60vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              <Spin size="large" />
              <Text style={{ color: '#8c9ba5' }}>Loading 10-year Apple Health dataset & GPS routes...</Text>
            </div>
          ) : error ? (
            <Alert title="Error Loading Health Data" description={error} type="error" showIcon />
          ) : status && !status.hasData ? (
            <Result
              status="info"
              title="No health data imported yet"
              subTitle={
                <>
                  Import your Apple Health data by running <Text code>npm run db:import-json</Text> in the project
                  folder, then reload this page.
                </>
              }
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={handleTabChange}
                  items={tabItems}
                  size="large"
                  tabBarStyle={{
                    marginBottom: 24,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  }}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </Content>

        {/* Footer */}
        <Footer
          style={{
            textAlign: 'center',
            background: '#0c101c',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            color: '#8c9ba5',
            fontSize: 12,
            padding: '20px 24px',
          }}
        >
          PulseFit Intelligence Dashboard &copy; {new Date().getFullYear()} &bull; {(status?.counts.days ?? 0).toLocaleString()} days of
          Apple Health data &bull; {(status?.counts.workouts ?? 0).toLocaleString()} Workouts &bull;{' '}
          {(status?.counts.routes ?? 0).toLocaleString()} GPX Routes
        </Footer>
      </Layout>
    </ConfigProvider>
  );
};
