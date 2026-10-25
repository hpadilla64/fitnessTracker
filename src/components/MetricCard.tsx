import React from 'react';
import { Card, Statistic, Tag } from 'antd';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: React.ReactNode;
  icon?: React.ReactNode;
  tag?: string;
  tagColor?: string;
  description?: string;
  delay?: number;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  suffix,
  prefix,
  icon,
  tag,
  tagColor = 'blue',
  description,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
    >
      <Card
        bordered={false}
        style={{
          borderRadius: 12,
          background: 'linear-gradient(145deg, #1b2234 0%, #151a28 100%)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          position: 'relative',
          overflow: 'hidden',
        }}
        bodyStyle={{ padding: '20px 24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#8c9ba5', fontSize: 13, fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {title}
            </div>
            <Statistic
              value={value}
              suffix={suffix}
              prefix={prefix}
              valueStyle={{ color: '#fff', fontSize: 26, fontWeight: 700 }}
            />
          </div>
          {icon && (
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: 'rgba(24, 144, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                color: '#1890ff',
              }}
            >
              {icon}
            </div>
          )}
        </div>

        {(tag || description) && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            {tag && <Tag color={tagColor}>{tag}</Tag>}
            {description && <span style={{ color: '#8c9ba5', fontSize: 12 }}>{description}</span>}
          </div>
        )}
      </Card>
    </motion.div>
  );
};
