export function buildAlertQueryParams(options: {
  viewMode: 'single' | 'group';
  singleLevelFilter: string;
  singleTypeFilter: string;
  singleStatusFilter: string;
  groupLevelFilter: string;
  groupTypeFilter: string;
  groupStatusFilter: string;
  page: number;
  pageSize: number;
}) {
  const isSingleView = options.viewMode === 'single';

  return {
    level: isSingleView
      ? options.singleLevelFilter === '全部'
        ? undefined
        : options.singleLevelFilter
      : options.groupLevelFilter === '全部'
        ? undefined
        : options.groupLevelFilter,
    type: isSingleView
      ? options.singleTypeFilter === '全部'
        ? undefined
        : options.singleTypeFilter
      : options.groupTypeFilter === '全部'
        ? undefined
        : options.groupTypeFilter,
    status: isSingleView
      ? options.singleStatusFilter === '全部'
        ? undefined
        : options.singleStatusFilter
      : options.groupStatusFilter === '全部'
        ? undefined
        : options.groupStatusFilter,
    page: options.page,
    pageSize: options.pageSize,
    sort: 'generatedTime',
    direction: 'desc',
  };
}

function dismissedKey(alert: any) {
  return `${alert.managementNumber || ''}|${alert.recalibrationDate || ''}`;
}

export function buildProcessedAlerts(instruments: any[]) {
  const dismissed = {};
  const list: any[] = [];

  instruments.forEach((alert) => {
    const key = dismissedKey(alert);
    if ((dismissed as any)[key]) {
      return;
    }

    list.push({
      key: alert.id,
      level: alert.alertType,
      type: alert.type,
      name: alert.name,
      model: alert.model,
      serialNumber: alert.serialNumber,
      managementNumber: alert.managementNumber,
      measureRange: alert.measureRange,
      nextCalibrationDate: alert.recalibrationDate,
      remainingDays: alert.remainingDays,
      currentCapacity: alert.currentCapacity,
      initialCapacity: alert.initialCapacity,
      unit: alert.unit,
      status: alert.processedStatus || '预警',
      raw: alert,
    });
  });

  return list;
}

export function buildGroupAlerts(processedAlerts: any[], viewMode: 'single' | 'group') {
  if (viewMode !== 'group') {
    return [];
  }

  const groups: Record<string, any> = {};
  const groupItems = processedAlerts.filter((item) => item.raw.mergeGroupId);

  groupItems.forEach((item) => {
    const key = item.raw.mergeGroupId;
    if (!groups[key]) {
      groups[key] = {
        key,
        name: item.name,
        model: item.model,
        measureRange: item.measureRange,
        list: [],
        levels: new Set(),
        totalCurrent: 0,
        totalInitial: 0,
        unit: item.unit,
      };
    }

    groups[key].list.push(item);
    groups[key].levels.add(item.level);
    groups[key].totalCurrent += Number(item.currentCapacity || 0);
    groups[key].totalInitial += Number(item.initialCapacity || 0);
  });

  return Object.values(groups).map((group: any) => {
    const levels = Array.from(group.levels as Set<string>);
    let level = '';

    if (levels.includes('超期')) level = '超期';
    else if (levels.includes('库存不足')) level = '库存不足';
    else if (levels.includes('预到期')) level = '预到期';
    else if (levels.includes('紧急')) level = '紧急';
    else if (levels.includes('重要')) level = '重要';
    else level = levels[0] || '';

    return {
      ...group,
      level,
      count: group.list.length,
    };
  });
}
