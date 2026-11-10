'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Progress, Space, Tooltip, Typography } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import { fetchIngestJob, startProcessData } from '@/services/dataService';
import type { IngestJob } from '@/types/api';

const { Text } = Typography;

const POLL_MS = 1500;
const PHASE_LABEL = { records: 'Reading records…', routes: 'Reading routes…', writing: 'Saving…' } as const;

interface Props {
  lastProcessedAt: string | null;
  onImported: () => void;
  /** 'header' = compact, 'primary' = large call-to-action for the empty state */
  variant?: 'header' | 'primary';
  label?: string;
}

function formatCounts(counts: Record<string, number> | null): string {
  if (!counts) return '';
  return Object.entries(counts)
    .map(([k, v]) => `${v.toLocaleString()} ${k}`)
    .join(', ');
}

export const ImportDataControl: React.FC<Props> = ({
  lastProcessedAt,
  onImported,
  variant = 'header',
  label = 'Import / re-process data',
}) => {
  const [job, setJob] = useState<IngestJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onImportedRef = useRef(onImported);
  onImportedRef.current = onImported;
  // Only a job we watched running should trigger a reload when it finishes
  const watchedRunning = useRef(false);

  const poll = useCallback(async () => {
    try {
      const j = await fetchIngestJob();
      setJob(j);
      if (j?.state === 'running') {
        watchedRunning.current = true;
        timer.current = setTimeout(poll, POLL_MS);
      } else if (watchedRunning.current) {
        watchedRunning.current = false;
        if (j?.state === 'succeeded') onImportedRef.current();
      }
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : String(err));
      watchedRunning.current = false;
    }
  }, []);

  // Pick up a job already running (e.g. started in another tab)
  useEffect(() => {
    poll();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poll]);

  const start = async () => {
    setStarting(true);
    setRequestError(null);
    try {
      setJob(await startProcessData());
      watchedRunning.current = true;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(poll, POLL_MS);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  };

  const running = job?.state === 'running';
  const big = variant === 'primary';

  let status: React.ReactNode = null;
  if (running) {
    status = (
      <div style={{ minWidth: big ? 260 : 150 }}>
        <Text style={{ color: '#8c9ba5', fontSize: 11 }}>{job.phase ? PHASE_LABEL[job.phase] : 'Starting…'}</Text>
        <Progress
          percent={Math.round((job.progress ?? 0) * 100)}
          size="small"
          status="active"
          showInfo={!!job.progress}
        />
      </div>
    );
  } else if (requestError) {
    status = <Text type="danger" style={{ fontSize: 12 }}>{requestError}</Text>;
  } else if (job?.state === 'failed') {
    status = <Text type="danger" style={{ fontSize: 12 }}>Import failed: {job.error ?? 'unknown error'}</Text>;
  } else if (job?.state === 'succeeded' && big) {
    status = <Text type="success" style={{ fontSize: 12 }}>Import complete. {formatCounts(job.counts)}</Text>;
  }

  const lastImport = lastProcessedAt ? `Last import: ${new Date(lastProcessedAt).toLocaleString()}` : null;
  const successTip = job?.state === 'succeeded' ? `Imported ${formatCounts(job.counts)}` : null;

  const button = (
    <Button
      type={big ? 'primary' : 'default'}
      size={big ? 'large' : 'small'}
      icon={<CloudUploadOutlined />}
      loading={running || starting}
      disabled={running || starting}
      onClick={start}
    >
      {running ? 'Importing…' : label}
    </Button>
  );

  return (
    <Space orientation={big ? 'vertical' : 'horizontal'} size={8} align="center">
      {status}
      <Tooltip title={[lastImport, successTip].filter(Boolean).join(' · ') || undefined}>{button}</Tooltip>
      {!big && lastImport && !running && (
        <Text style={{ color: '#8c9ba5', fontSize: 11 }}>{lastImport}</Text>
      )}
    </Space>
  );
};
