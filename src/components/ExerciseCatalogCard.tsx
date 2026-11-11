'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Empty, Input, Progress, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BookOutlined, SyncOutlined } from '@ant-design/icons';
import {
  fetchCatalogExercises,
  fetchCatalogSummary,
  fetchCatalogSync,
  startCatalogSync,
} from '@/services/dataService';
import type { CatalogExercise, CatalogSummary, CatalogSyncJob } from '@/types/api';

const { Text, Paragraph } = Typography;

const POLL_MS = 1500;
const PAGE_SIZE = 20;
const NO_EQUIPMENT = 'none';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

const ExerciseCatalogCard: React.FC = () => {
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [items, setItems] = useState<CatalogExercise[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<string | undefined>();
  const [equipment, setEquipment] = useState<string | undefined>();
  const [muscle, setMuscle] = useState<string | undefined>();
  const [page, setPage] = useState(1);

  const [job, setJob] = useState<CatalogSyncJob | null>(null);
  const [starting, setStarting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  // Only a job we watched running should trigger a reload when it finishes
  const watchedRunning = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchCatalogSummary();
      if (mounted.current) setSummary(s);
    } catch (err) {
      if (mounted.current) setError(errMsg(err));
    } finally {
      if (mounted.current) setSummaryLoaded(true);
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const j = await fetchCatalogSync();
      if (!mounted.current) return;
      setJob(j);
      if (j?.state === 'running') {
        watchedRunning.current = true;
        timer.current = setTimeout(poll, POLL_MS);
      } else if (watchedRunning.current) {
        watchedRunning.current = false;
        if (j?.state === 'succeeded') {
          loadSummary();
          setReloadKey((k) => k + 1);
        }
      }
    } catch (err) {
      if (!mounted.current) return;
      setError(errMsg(err));
      watchedRunning.current = false;
    }
  }, [loadSummary]);

  // Initial load; also picks up a sync already running (e.g. started in another tab)
  useEffect(() => {
    mounted.current = true;
    loadSummary();
    poll();
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loadSummary, poll]);

  // Debounce the search box
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const hasData = (summary?.exerciseCount ?? 0) > 0;

  // Server-side filtering + pagination
  useEffect(() => {
    if (!hasData) return;
    let cancelled = false;
    setListLoading(true);
    fetchCatalogExercises({ q, category, equipment, muscle, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((r) => {
        if (cancelled) return;
        setItems(r.items);
        setTotal(r.total);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errMsg(err)))
      .finally(() => !cancelled && setListLoading(false));
    return () => {
      cancelled = true;
    };
  }, [hasData, q, category, equipment, muscle, page, reloadKey]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      setJob(await startCatalogSync());
    } catch (err) {
      // 409 CONFLICT: a sync is already running; the poll below picks it up
      if (!/CONFLICT|409/.test(errMsg(err))) {
        setError(errMsg(err));
        setStarting(false);
        return;
      }
    }
    watchedRunning.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(poll, POLL_MS);
    setStarting(false);
  };

  const running = job?.state === 'running';

  const syncButton = (primary?: boolean) => (
    <Button
      type={primary ? 'primary' : 'default'}
      size={primary ? 'large' : 'small'}
      icon={<SyncOutlined spin={running} />}
      loading={starting}
      disabled={running || starting}
      onClick={start}
    >
      {running ? 'Syncing…' : primary ? 'Sync catalog' : 'Sync'}
    </Button>
  );

  const progress = running && (
    <div style={{ minWidth: 150 }}>
      <Progress percent={Math.round((job.progress ?? 0) * 100)} size="small" status="active" showInfo={!!job.progress} />
    </div>
  );

  const failure = !running && job?.state === 'failed' && (
    <Text type="danger" style={{ fontSize: 12 }}>Sync failed: {job.error ?? 'unknown error'}</Text>
  );

  const columns: ColumnsType<CatalogExercise> = [
    { title: 'Exercise', dataIndex: 'name', key: 'name', render: (n: string) => <Text strong>{n}</Text> },
    { title: 'Category', dataIndex: 'category', key: 'category', render: (c: string | null) => c ?? '—' },
    {
      title: 'Muscles',
      key: 'muscles',
      render: (_, r) =>
        r.muscles.length + r.musclesSecondary.length === 0 ? (
          '—'
        ) : (
          <>
            {r.muscles.map((m) => (
              <Tag key={m} color="blue">{m}</Tag>
            ))}
            {r.musclesSecondary.map((m) => (
              <Tag key={m} style={{ opacity: 0.6 }}>{m}</Tag>
            ))}
          </>
        ),
    },
    {
      title: 'Equipment',
      dataIndex: 'equipment',
      key: 'equipment',
      render: (e: string[]) => (e.length ? e.join(', ') : <Text type="secondary">None</Text>),
    },
  ];

  const reset = () => setPage(1);
  const filters = (
    <Space wrap style={{ marginBottom: 16 }}>
      <Input.Search
        allowClear
        placeholder="Search exercises"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: 220 }}
      />
      <Select
        allowClear
        placeholder="Category"
        value={category}
        onChange={(v) => { setCategory(v); reset(); }}
        style={{ width: 170 }}
        options={summary?.categories.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))}
      />
      <Select
        allowClear
        placeholder="Equipment"
        value={equipment}
        onChange={(v) => { setEquipment(v); reset(); }}
        style={{ width: 170 }}
        options={[
          { value: NO_EQUIPMENT, label: 'No equipment' },
          ...(summary?.equipment.map((e) => ({ value: e, label: e })) ?? []),
        ]}
      />
      <Select
        allowClear
        showSearch
        placeholder="Muscle"
        value={muscle}
        onChange={(v) => { setMuscle(v); reset(); }}
        style={{ width: 170 }}
        options={summary?.muscles.map((m) => ({ value: m, label: m }))}
      />
    </Space>
  );

  const extra = (
    <Space size={12} wrap>
      {progress}
      {failure}
      {hasData && summary && (
        <Text style={{ color: '#8c9ba5', fontSize: 12 }}>
          {summary.exerciseCount.toLocaleString()} exercises
          {summary.lastSyncedAt && ` · synced ${new Date(summary.lastSyncedAt).toLocaleDateString()}`}
        </Text>
      )}
      {hasData && syncButton()}
    </Space>
  );

  let body: React.ReactNode;
  if (!summaryLoaded) {
    body = <Table size="small" loading columns={columns} dataSource={[]} pagination={false} />;
  } else if (!hasData) {
    body = (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="The exercise catalog has not been synced yet. Sync it to download the exercise library from wger.de and store it locally."
      >
        <Space orientation="vertical" align="center">
          {progress}
          {failure}
          {syncButton(true)}
        </Space>
      </Empty>
    );
  } else {
    body = (
      <>
        {filters}
        <Table<CatalogExercise>
          size="small"
          rowKey="id"
          loading={listLoading}
          columns={columns}
          dataSource={items}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No exercises match the filters" /> }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            onChange: setPage,
          }}
          expandable={{
            expandedRowRender: (r) => (
              <div>
                <Paragraph style={{ color: '#c0c8d0', marginBottom: 8 }}>
                  {r.description || 'No description available.'}
                </Paragraph>
                <Text style={{ color: '#8c9ba5', fontSize: 11 }}>
                  {[r.license, r.author && `by ${r.author}`].filter(Boolean).join(' · ') || 'License not listed'}
                </Text>
              </div>
            ),
          }}
        />
        <div style={{ marginTop: 12 }}>
          <Text style={{ color: '#8c9ba5', fontSize: 11 }}>
            Exercise data from{' '}
            <a href={summary?.source.url ?? 'https://wger.de'} target="_blank" rel="noopener noreferrer">wger.de</a>
            , licensed{' '}
            <a href={LICENSE_URL} target="_blank" rel="noopener noreferrer">CC-BY-SA 4.0</a>.
          </Text>
        </div>
      </>
    );
  }

  return (
    <Card
      variant="borderless"
      style={{ borderRadius: 12, background: '#151a28', marginTop: 24 }}
      title={
        <Space>
          <BookOutlined style={{ color: '#4dabf7' }} />
          <span>Exercise catalog</span>
        </Space>
      }
      extra={extra}
    >
      {error && !failure && (
        <Text type="danger" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>{error}</Text>
      )}
      {body}
    </Card>
  );
};

export default ExerciseCatalogCard;
