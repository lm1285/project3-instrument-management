import OperationButtons from './buttons/OperationButtons';

interface InstrumentData {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  managementNumber: string;
  type: string;
  measureRange: string;
  inOutStatus: string;
  notes?: string;
  checkoutTime?: string;
  checkinOrUseTime?: string;
  operator?: string;
}

interface TableColumnsProps {
  onCheckOut: (id: string) => void;
  onCheckIn: (id: string) => void;
  onUse: (id: string) => void;
  onBorrow: (id: string) => void;
  onClearRecord: (id: string) => void;
  onDetail: (id: string) => void;
  onReservation: (id: string) => void;
  settings: any;
}

const TableColumns = ({ onCheckOut, onCheckIn, onUse, onBorrow, onClearRecord, onDetail, onReservation, settings }: TableColumnsProps) => {
  const fmt = settings.table?.dateFormat || 'YYYY-MM-DD';
  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    if (fmt === 'YYYY/MM/DD') return `${y}/${m}/${day}`;
    if (fmt === 'YYYY.MM.DD') return `${y}.${m}.${day}`;
    return `${y}-${m}-${day}`;
  };
  const columns = [
    {
      title: '仪器类型',
      dataIndex: 'type',
      key: 'type',
      ellipsis: true,
      align: 'center',
    },
    {
      title: '仪器名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      align: 'center',
    },
    {
      title: '型号规格',
      dataIndex: 'model',
      key: 'model',
      ellipsis: true,
      align: 'center',
    },
    {
      title: '出厂编号',
      dataIndex: 'serialNumber',
      key: 'serialNumber',
      ellipsis: true,
      align: 'center',
      render: (text: string) => (text || '-')
    },
    {
      title: '管理编号',
      dataIndex: 'managementNumber',
      key: 'managementNumber',
      ellipsis: true,
      align: 'center',
      render: (text: string) => (text || '-')
    },
    {
      title: '测量范围',
      dataIndex: 'measureRange',
      key: 'measureRange',
      ellipsis: true,
      align: 'center',
    },
    {
      title: '操作人',
      dataIndex: 'operator',
      key: 'operator',
      ellipsis: true,
      align: 'center',
      render: (text: string) => text || '-',
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      align: 'center',
      render: (notes?: string) => notes || '-',
    },
    {
      title: '出入库状态',
      dataIndex: 'inOutStatus',
      key: 'inOutStatus',
      ellipsis: true,
      align: 'center',
      render: (status: string) => {
        let color = '';
        switch (status) {
          case '在库中':
            color = '#52c41a';
            break;
          case '已出库':
            color = '#fa8c16';
            break;
        }
        return <span style={{ color }}>{status}</span>;
      },
    },
    {
      title: '出库时间',
      dataIndex: 'checkoutTime',
      key: 'checkoutTime',
      ellipsis: true,
      align: 'center',
      render: (time?: string) => {
        if (!time) return '-';
        const base = String(time).replace(/（.*?）$/, '');
        const d = new Date(base);
        if (isNaN(d.getTime())) return time;
        const pad = (n: number) => String(n).padStart(2, '0');
        const dateLine = format(d);
        const timeLine = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        return <div><div>{dateLine}</div><div>{timeLine}</div></div>;
      },
    },
    {
      title: '入库/使用时间',
      dataIndex: 'checkinOrUseTime',
      key: 'checkinOrUseTime',
      ellipsis: true,
      align: 'center',
      render: (time?: string) => {
        if (!time) return '-';
        const isUse = /（使用）$/.test(time);
        const base = String(time).replace(/（使用）$/, '');
        const d = new Date(base);
        if (isNaN(d.getTime())) return time;
        const pad = (n: number) => String(n).padStart(2, '0');
        const dateLine = format(d);
        const timeLine = `${pad(d.getHours())}:${pad(d.getMinutes())}${isUse ? '（使用）' : ''}`;
        return <div><div>{dateLine}</div><div>{timeLine}</div></div>;
      },
    },
  {
    title: '操作',
    key: 'action',
    width: 180,
    fixed: 'right',
    align: 'center',
    resizable: false,
    draggable: false,
    render: (_: any, record: InstrumentData) => (
      <OperationButtons
        instrumentId={record.id}
        flowStatus={record.inOutStatus}
        onCheckOut={onCheckOut}
        onCheckIn={onCheckIn}
        onUse={onUse}
        onBorrow={onBorrow}
        onDelete={onClearRecord}
        onDetail={onDetail}
        onReservation={onReservation}
      />
    ),
  },
  ];

  return columns;
};

export default TableColumns;
