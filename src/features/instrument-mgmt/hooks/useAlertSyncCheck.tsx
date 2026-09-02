import { App } from 'antd';
import { Instrument } from '../types';

type AlertSyncSettings = {
  alertMode?: string;
  alertLevel?: string;
};

export const useAlertSyncCheck = () => {
  const { modal } = App.useApp();

  const checkAndSync = (
    targetSettings: AlertSyncSettings,
    instruments: Instrument[],
    onSync: (syncSettings?: AlertSyncSettings) => Promise<void>
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const groupMode = targetSettings.alertMode;
      const groupLevel = targetSettings.alertLevel;

      if (!groupMode && !groupLevel) {
        onSync().then(resolve).catch(reject);
        return;
      }

      const mismatchingInstruments = instruments.filter((inst) => {
        const modeMismatch = groupMode ? inst.alertMode !== groupMode : false;
        const levelMismatch = groupLevel ? inst.alertLevel !== groupLevel : false;
        return modeMismatch || levelMismatch;
      });

      if (mismatchingInstruments.length === 0) {
        onSync().then(resolve).catch(reject);
        return;
      }

      const syncSettings: AlertSyncSettings = {};
      if (groupMode) syncSettings.alertMode = groupMode;
      if (groupLevel) syncSettings.alertLevel = groupLevel;

      modal.confirm({
        title: '预警设置不一致',
        content: (
          <div>
            <p>检测到以下 {mismatchingInstruments.length} 台仪器的预警设置与合并组不一致：</p>
            <ul style={{ maxHeight: '100px', overflowY: 'auto', paddingLeft: '20px', margin: '10px 0' }}>
              {mismatchingInstruments.slice(0, 5).map((instrument) => (
                <li key={instrument.id}>
                  {instrument.name} ({instrument.managementNumber})
                </li>
              ))}
              {mismatchingInstruments.length > 5 && <li>...等 {mismatchingInstruments.length} 台</li>}
            </ul>
            <p>是否将这些仪器的预警设置同步为与合并组一致？</p>
            <p style={{ marginTop: 8, color: '#666' }}>
              确认：同步设置并继续（如果之前有设置，将被覆盖；移出组时可恢复）。
              <br />
              拒绝：保留仪器原有设置并继续。
            </p>
          </div>
        ),
        okText: '确认同步',
        cancelText: '拒绝 (保留原设置)',
        width: 500,
        onOk: async () => {
          try {
            await onSync(syncSettings);
            resolve();
          } catch (error) {
            reject(error);
            throw error;
          }
        },
        onCancel: async () => {
          try {
            await onSync();
            resolve();
          } catch (error) {
            reject(error);
            throw error;
          }
        },
      });
    });
  };

  return { checkAndSync };
};
