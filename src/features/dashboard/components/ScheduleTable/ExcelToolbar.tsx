import React from 'react';
import { Button } from 'antd';
import { PermissionGuard } from '../../../auth/components/PermissionGuard';

interface ExcelToolbarProps {
  onMerge: () => void;
  onSplit: () => void;
  onInsertRow: () => void;
  onDeleteRow: () => void;
  onClear: () => void;
  onUndo: () => void;
  canUndo: boolean;
  canEdit: boolean;
}

const ExcelToolbar: React.FC<ExcelToolbarProps> = ({
  onMerge,
  onSplit,
  onInsertRow,
  onDeleteRow,
  onClear,
  onUndo,
  canUndo,
  canEdit,
}) => {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
      <PermissionGuard permission="dashboard:schedule:insert_row">
        <Button style={{ height: '48px' }} onClick={onInsertRow}>
          {'\u63d2\u5165\u884c'}
        </Button>
      </PermissionGuard>
      <PermissionGuard permission="dashboard:schedule:delete_row">
        <Button style={{ height: '48px' }} onClick={onDeleteRow} danger>
          {'\u5220\u9664\u884c'}
        </Button>
      </PermissionGuard>
      <PermissionGuard permission="dashboard:schedule:merge">
        <Button style={{ height: '48px' }} onClick={onMerge}>
          {'\u5408\u5e76\u5355\u5143\u683c'}
        </Button>
      </PermissionGuard>
      <PermissionGuard permission="dashboard:schedule:split">
        <Button style={{ height: '48px' }} onClick={onSplit}>
          {'\u62c6\u5206\u5355\u5143\u683c'}
        </Button>
      </PermissionGuard>
      <PermissionGuard permission="dashboard:schedule:undo">
        <Button style={{ height: '48px' }} onClick={onUndo} disabled={!canUndo || !canEdit}>
          {'\u64a4\u56de'}
        </Button>
      </PermissionGuard>
      <PermissionGuard permission="dashboard:schedule:clear">
        <Button style={{ height: '48px' }} onClick={onClear}>
          {'\u6e05\u7a7a\u8868\u683c'}
        </Button>
      </PermissionGuard>
    </div>
  );
};

export default ExcelToolbar;
