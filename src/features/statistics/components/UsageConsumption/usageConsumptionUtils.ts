import dayjs from 'dayjs';

export interface UsageFilters {
  range: [string, string];
  filterType: string;
  filterAction: string;
  filterDept: string;
  filterUser: string;
  keyword: string;
}

export function buildHistoryRequestParams(
  filters: UsageFilters,
  customParams: Record<string, string | undefined>,
  page: number,
  pageSize: number,
) {
  const params = new URLSearchParams();

  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.filterDept) params.set('dept', filters.filterDept);
  if (filters.filterUser) params.set('user', filters.filterUser);

  Object.entries(customParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.set(key, value);
    }
  });

  params.set('page', String(page));
  params.set('pageSize', String(pageSize));

  return Object.fromEntries(params.entries());
}

export function exportRowsToCSV(
  data: any[],
  columns: any[],
  filename: string,
  fullFormat: string,
  formatNumber: (value: any) => string,
) {
  const header = columns
    .filter((column) => column.key !== 'action')
    .map((column) => column.title)
    .join(',') + '\n';

  const rows = data
    .map((row) =>
      columns
        .filter((column) => column.key !== 'action')
        .map((column) => {
          let value = row[column.dataIndex];

          if (
            column.dataIndex === 'time' ||
            column.dataIndex === 'lastUsageTime' ||
            column.dataIndex === 'disableTime'
          ) {
            value = value && dayjs(value).isValid() ? dayjs(value).format(fullFormat) : '-';
          } else if (column.dataIndex === 'delta') {
            value = value ? `${formatNumber(value)} ${row.unit || ''}` : '-';
          } else if (column.dataIndex === 'initialCapacity') {
            value = value ? formatNumber(value) : '-';
          }

          if (value === null || value === undefined) {
            value = '';
          }

          const stringValue = String(value).replace(/"/g, '""');
          return `"${stringValue}"`;
        })
        .join(','),
    )
    .join('\n');

  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function buildExportConfig(
  activeTab: string,
  filters: UsageFilters,
  usageColumns: any[],
  materialColumns: any[],
  usedColumns: any[],
  disabledColumns: any[],
) {
  const params = new URLSearchParams();

  if (activeTab === 'usage') {
    params.set('start', filters.range[0]);
    params.set('end', filters.range[1]);
    params.set('actions', filters.filterAction !== '全部' ? filters.filterAction : 'out,in');
    if (filters.filterType !== '全部') {
      params.set('type', filters.filterType);
    } else {
      params.set('types', '标准器,辅助设备');
    }
    if (filters.filterDept) params.set('dept', filters.filterDept);
    if (filters.filterUser) params.set('user', filters.filterUser);
    if (filters.keyword) params.set('keyword', filters.keyword);
    return {
      endpoint: '/history/usage',
      filename: `使用记录_${dayjs().format('YYYYMMDD')}.csv`,
      columns: usageColumns,
      params,
    };
  }

  if (activeTab === 'materialUsage') {
    params.set('start', filters.range[0]);
    params.set('end', filters.range[1]);
    params.set('type', '标准物质');
    params.set('actions', 'in,out');
    if (filters.filterDept) params.set('dept', filters.filterDept);
    if (filters.filterUser) params.set('user', filters.filterUser);
    if (filters.keyword) params.set('keyword', filters.keyword);
    return {
      endpoint: '/history/usage',
      filename: `标准物质使用记录_${dayjs().format('YYYYMMDD')}.csv`,
      columns: materialColumns,
      params,
    };
  }

  if (activeTab === 'used') {
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.filterType !== '全部') params.set('type', filters.filterType);
    if (filters.filterDept) params.set('dept', filters.filterDept);
    return {
      endpoint: '/history/used',
      filename: `已使用记录_${dayjs().format('YYYYMMDD')}.csv`,
      columns: usedColumns,
      params,
    };
  }

  params.set('start', filters.range[0]);
  params.set('end', filters.range[1]);
  if (filters.keyword) params.set('keyword', filters.keyword);
  if (filters.filterType !== '全部') params.set('type', filters.filterType);
  if (filters.filterDept) params.set('dept', filters.filterDept);
  if (filters.filterUser) params.set('user', filters.filterUser);
  return {
    endpoint: '/history/disabled',
    filename: `停用记录_${dayjs().format('YYYYMMDD')}.csv`,
    columns: disabledColumns,
    params,
  };
}
