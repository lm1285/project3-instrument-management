# 仪器管理系统公共组件文档

## FilterPanel 组件

独立筛选面板组件，提供多种筛选条件：类型、溯源方式、科室、仪器状态、出入库状态、时间范围。

### 基本用法

```tsx
import FilterPanel, { FilterValues } from './FilterPanel';

// 定义选项数据
const typeOptions = [
  { label: '设备', value: 'device' },
  { label: '工具', value: 'tool' },
  { label: '耗材', value: 'consumable' },
];

// 组件使用
<FilterPanel
  typeOptions={typeOptions}
  traceabilityMethodOptions={traceabilityOptions}
  departmentOptions={departmentOptions}
  instrumentStatusOptions={statusOptions}
  storageStatusOptions={storageOptions}
  onFilterChange={(values: FilterValues) => {
    console.log('筛选条件变化:', values);
    // 执行筛选逻辑
  }}
/>
```

### 属性说明

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| typeOptions | `SelectProps['options']` | `[]` | 类型选项列表 |
| traceabilityMethodOptions | `SelectProps['options']` | `[]` | 溯源方式选项列表 |
| departmentOptions | `SelectProps['options']` | `[]` | 科室选项列表 |
| instrumentStatusOptions | `SelectProps['options']` | `[]` | 仪器状态选项列表 |
| storageStatusOptions | `SelectProps['options']` | `[]` | 出入库状态选项列表 |
| defaultValues | `FilterValues` | `{}` | 默认筛选值 |
| onFilterChange | `(values: FilterValues) => void` | 必填 | 筛选条件变化时的回调函数 |
| onReset | `() => void` | - | 重置按钮点击时的回调函数 |
| onApply | `(values: FilterValues) => void` | - | 应用按钮点击时的回调函数 |
| showResetButton | `boolean` | `true` | 是否显示重置按钮 |
| showApplyButton | `boolean` | `true` | 是否显示应用按钮 |
| className | `string` | `''` | 自定义类名 |

### FilterValues 接口

```typescript
interface FilterValues {
  type?: string;           // 类型
  traceabilityMethod?: string; // 溯源方式
  department?: string;     // 科室
  instrumentStatus?: string; // 仪器状态
  storageStatus?: string;  // 出入库状态
  dateRange?: [dayjs.Dayjs | null, dayjs.Dayjs | null]; // 时间范围
}
```

本文档介绍了仪器管理系统中常用的公共组件，包括表格相关组件和筛选面板组件的使用方法。

## 1. 仪器表格列配置

### 1.1 基本用法

`InstrumentTableColumns.tsx` 提供了标准的仪器信息列配置，包含了所有必需的标题列。可以直接导入使用：

```tsx
import INSTRUMENT_TABLE_COLUMNS from './InstrumentTableColumns';

// 在DataTable组件中使用
<DataTable 
  dataSource={instruments}
  columns={INSTRUMENT_TABLE_COLUMNS}
/>
```

### 1.2 自定义列选择

如果只需要部分列，可以使用工具函数 `getInstrumentColumns`：

```tsx
import { getInstrumentColumns } from './InstrumentTableColumns';

// 只使用部分列
const customColumns = getInstrumentColumns([
  'selection', 'name', 'model', 'managementNumber', 'instrumentStatus'
]);

<DataTable 
  dataSource={instruments}
  columns={customColumns}
/>
```

### 1.3 排除特定列

如果需要排除某些列，可以使用 `getInstrumentColumnsExcept` 函数：

```tsx
import { getInstrumentColumnsExcept } from './InstrumentTableColumns';

// 排除不需要的列
const customColumns = getInstrumentColumnsExcept(['attachment', 'remarks']);

<DataTable 
  dataSource={instruments}
  columns={customColumns}
/>
```

### 1.4 增强功能配置

列配置支持排序、筛选、列位置调整和手动列宽调整等高级功能：

```typescript
import { getInstrumentColumns } from './InstrumentTableColumns';

// 增强特定列的功能
const enhancedColumns = getInstrumentColumns(['name', 'instrumentStatus']).map(column => {
  if (column.key === 'name') {
    return {
      ...column,
      sorter: true,
      filterable: true,
      filters: [
        { text: '光学仪器', value: 'optical' },
        { text: '电子仪器', value: 'electronic' },
        { text: '力学仪器', value: 'mechanical' }
      ]
    };
  }
  if (column.key === 'instrumentStatus') {
    return {
      ...column,
      filterable: true,
      filters: [
        { text: '正常', value: '正常' },
        { text: '校准中', value: '校准中' },
        { text: '停用', value: '停用' }
      ],
      filterMultiple: false // 单选筛选
    };
  }
  return column;
});
```

## 2. 数据表格组件

### 2.1 基本用法

`DataTable` 组件是一个功能强大的数据表格组件，支持展示、选择、分页、排序、筛选、列位置调整和手动列宽调整等功能：

```tsx
import DataTable from './DataTable';
import { getInstrumentColumns } from './InstrumentTableColumns';
import { SortDirection } from './InstrumentTableColumns';

function InstrumentList() {
  const columns = getInstrumentColumns(['selection', 'name', 'model', 'instrumentStatus']);
  
  return (
    <DataTable
      dataSource={instrumentData}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={true}
      currentPage={currentPage}
      pageSize={20}
      onPageChange={handlePageChange}
      onSelectChange={handleSelectChange}
      onRowClick={handleRowClick}
      onSortChange={(columnKey, direction) => {
        console.log('排序变化:', columnKey, direction);
        // 处理排序逻辑
      }}
      onFilterChange={(columnKey, values) => {
        console.log('筛选变化:', columnKey, values);
        // 处理筛选逻辑
      }}
      onColumnsChange={(newColumns) => {
        console.log('列配置变化:', newColumns);
        // 保存用户的列顺序偏好
      }}
    />
  );
}
```

### 2.2 组件属性

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| dataSource | T[] | [] | 数据源数组 |
| columns | InstrumentTableColumn[] | INSTRUMENT_TABLE_COLUMNS | 列配置数组 |
| columnKeys | string[] | undefined | 列key数组，如果提供则从标准列中过滤 |
| rowKey | keyof T | 'id' | 行的唯一标识符 |
| loading | boolean | false | 加载状态 |
| pagination | boolean | false | 是否显示分页 |
| pageSize | number | 20 | 每页显示条数 |
| currentPage | number | 1 | 当前页码 |
| onPageChange | (page: number, pageSize: number) => void | undefined | 页码变化回调 |
| onSelectChange | (selectedRowKeys: React.Key[], selectedRows: T[]) => void | undefined | 选择变化回调 |
| onRowClick | (record: T, index: number) => void | undefined | 行点击回调 |
| rowClassName | (record: T, index: number) => string | undefined | 行类名回调 |
| onSortChange | (columnKey: string, direction: SortDirection) => void | undefined | 排序变化回调 |
| onFilterChange | (columnKey: string, values: string[] \| string) => void | undefined | 筛选变化回调 |
| onColumnsChange | (columns: InstrumentTableColumn[]) => void | undefined | 列配置变化回调（用于列位置调整） |
| defaultSorted | { columnKey: string; direction: SortDirection } | undefined | 默认排序配置 |
| defaultFiltered | Record<string, string[] \| string> | undefined | 默认筛选配置 |

### 2.3 使用示例

#### 2.3.1 完整表格

使用全部仪器信息列，包含分页和选择功能：

```tsx
import DataTable from './DataTable';
import INSTRUMENT_TABLE_COLUMNS from './InstrumentTableColumns';

function CompleteInstrumentTable() {
  const [selectedRows, setSelectedRows] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  const handleSelectChange = (selectedRowKeys, rows) => {
    setSelectedRows(rows);
  };
  
  const handlePageChange = (page, pageSize) => {
    setCurrentPage(page);
    // 这里可以调用API获取对应页的数据
  };
  
  return (
    <DataTable
      dataSource={instrumentData}
      columns={INSTRUMENT_TABLE_COLUMNS}
      rowKey="id"
      pagination={true}
      currentPage={currentPage}
      pageSize={20}
      onPageChange={handlePageChange}
      onSelectChange={handleSelectChange}
    />
  );
}
```

#### 2.3.2 简化表格

只显示部分列，不使用分页：

```tsx
import DataTable from './DataTable';
import { getInstrumentColumns } from './InstrumentTableColumns';

function SimpleInstrumentTable() {
  const columns = getInstrumentColumns([
    'name', 'model', 'managementNumber', 'instrumentStatus'
  ]);
  
  return (
    <DataTable
      dataSource={instrumentData}
      columns={columns}
      rowKey="id"
      pagination={false}
    />
  );
}
```

#### 2.3.3 启用高级功能

使用排序、筛选和列调整功能的表格：

```tsx
import DataTable from './DataTable';
import { getInstrumentColumns } from './InstrumentTableColumns';
import { SortDirection } from './InstrumentTableColumns';

function AdvancedInstrumentTable() {
  // 自定义列配置，增强特定列的功能
  const customColumns = getInstrumentColumns([
    'selection', 'name', 'model', 'instrumentStatus', 'calibrationDate'
  ]).map(column => {
    if (column.key === 'name') {
      return {
        ...column,
        sorter: true,
        filterable: true,
        filters: [
          { text: '光学仪器', value: 'optical' },
          { text: '电子仪器', value: 'electronic' },
          { text: '力学仪器', value: 'mechanical' }
        ]
      };
    }
    if (column.key === 'instrumentStatus') {
      return {
        ...column,
        filterable: true,
        filters: [
          { text: '正常', value: '正常' },
          { text: '校准中', value: '校准中' },
          { text: '停用', value: '停用' }
        ],
        filterMultiple: false, // 单选筛选
        render: (text) => {
          const colorMap = { '正常': 'green', '校准中': 'orange', '停用': 'red' };
          return <span style={{ color: colorMap[text] }}>{text}</span>;
        }
      };
    }
    if (column.key === 'calibrationDate') {
      return {
        ...column,
        sorter: true,
        render: (text) => text ? new Date(text).toLocaleDateString() : '-' 
      };
    }
    if (column.key === 'selection') {
      return {
        ...column,
        resizable: false,
        draggable: false
      };
    }
    return column;
  });

  const handleSortChange = (columnKey, direction) => {
    console.log('排序变化:', columnKey, direction);
    // 处理排序逻辑
  };

  const handleFilterChange = (columnKey, values) => {
    console.log('筛选变化:', columnKey, values);
    // 处理筛选逻辑
  };

  const handleColumnsChange = (newColumns) => {
    console.log('列配置变化:', newColumns);
    // 保存用户的列顺序偏好
  };

  return (
    <DataTable
      dataSource={instrumentData}
      columns={customColumns}
      rowKey="id"
      pagination={true}
      pageSize={10}
      onSortChange={handleSortChange}
      onFilterChange={handleFilterChange}
      onColumnsChange={handleColumnsChange}
      defaultSorted={{ columnKey: 'name', direction: 'ascend' }}
      defaultFiltered={{ instrumentStatus: '正常' }}
    />
  );
}

## 3. 列配置项说明

### 3.1 基本列配置

仪器表格标准列配置包含以下字段：

| 列名 | 键名 | 说明 |
|------|------|------|
| 选择框 | selection | 用于选择行数据 |
| 类型 | type | 仪器类型 |
| 数量 | quantity | 仪器数量 |
| 名称 | name | 仪器名称 |
| 型号 | model | 仪器型号 |
| 出厂编号 | factoryNumber | 出厂编号 |
| 管理编号 | managementNumber | 管理编号 |
| 生产厂家 | manufacturer | 生产厂家 |
| 测量范围 | measurementRange | 测量范围 |
| 测量不确定度 | measurementUncertainty | 测量不确定度 |
| 溯源方式 | traceabilityMethod | 溯源方式 |
| 校准日期 | calibrationDate | 校准日期 |
| 复校日期 | reCalibrationDate | 复校日期 |
| 周期 | cycle | 校准周期 |
| 溯源机构 | traceabilityInstitution | 溯源机构 |
| 科室 | department | 所属科室 |
| 存放位置 | storageLocation | 存放位置 |
| 仪器状态 | instrumentStatus | 仪器状态 |
| 出入库状态 | inOutStatus | 出入库状态 |
| 备注 | remarks | 备注信息 |
| 附件 | attachment | 相关附件 |
| 操作 | actions | 操作按钮 |

### 3.2 高级配置选项

列配置支持以下高级功能选项：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| sorter | boolean | false | 是否可排序 |
| sortDirections | SortDirection[] | ['ascend', 'descend', null] | 可选的排序方向数组 |
| filterable | boolean | false | 是否可筛选 |
| filters | { text: string; value: string }[] | [] | 筛选选项数组 |
| filterMultiple | boolean | true | 是否支持多选筛选 |
| resizable | boolean | true | 是否可调整列宽 |
| draggable | boolean | true | 是否可拖拽调整位置 |

### 3.3 列配置接口定义

```typescript
interface InstrumentTableColumn {
  key: string;
  title: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
  render?: (text: any, record: any, index: number) => React.ReactNode;
  // 排序相关
  sorter?: boolean;
  sortDirections?: SortDirection[];
  // 筛选相关
  filterable?: boolean;
  filters?: { text: string; value: string }[];
  filterMultiple?: boolean;
  // 列操作相关
  resizable?: boolean;
  draggable?: boolean;
}

type SortDirection = 'ascend' | 'descend' | null;
```

## 4. 注意事项

1. 使用 `columnKeys` 属性时，请确保提供的key与 `INSTRUMENT_TABLE_COLUMNS` 中的键名一致。
2. 当数据量较大时，建议开启分页功能以提高性能。
3. 如需自定义操作列，建议自行定义列配置而不是使用 `getInstrumentColumns` 函数。
4. 日期类型的数据会自动格式化为本地日期字符串。
5. 排序和筛选操作会触发相应的回调函数，需要在父组件中处理实际的数据排序和筛选逻辑。
6. 列宽调整和列位置调整功能默认启用，可通过在列配置中设置 `resizable: false` 或 `draggable: false` 来禁用特定列的调整功能。
7. 对于复杂的列配置，建议预先定义好配置数组，然后再传递给 `DataTable` 组件。
8. 使用筛选功能时，请注意设置正确的 `filterMultiple` 值，以决定是否允许多选。