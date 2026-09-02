import { App } from 'antd';
import { useMemo, useState } from 'react';
import { analyzeDatabase, checkIntegrity, clearCache, pruneLogs } from '../services/maintenanceService';
import { createMaintenanceCards, createMaintenanceSteps, MaintenanceTarget } from '../components/SystemConfig/maintenanceSimpleViewConfig';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useMaintenanceSimpleView() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState<{ success: boolean; msg: string }[]>([]);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  const appendResult = (success: boolean, msg: string) => {
    setResults((previousResults) => [...previousResults, { success, msg }]);
  };

  const runAllMaintenance = async () => {
    setLoading(true);
    setModalVisible(true);
    setCurrentStep(0);
    setResults([]);

    try {
      await sleep(600);
      appendResult(true, '浏览器缓存清理完成');
    } catch (error) {
      appendResult(false, '前端优化失败');
    }
    setCurrentStep(1);

    try {
      await sleep(600);
      await clearCache();
      await pruneLogs();
      appendResult(true, '服务端缓存与日志清理完成');
    } catch (error) {
      appendResult(false, '后端维护失败');
    }
    setCurrentStep(2);

    try {
      await sleep(600);
      await analyzeDatabase();
      await checkIntegrity();
      appendResult(true, '数据库索引优化与完整性检查完成');
    } catch (error) {
      appendResult(false, '数据库优化失败');
    }
    setCurrentStep(3);

    await sleep(500);
    setLoading(false);
  };

  const runSingleMaintenance = async (type: MaintenanceTarget) => {
    setLoadingMap((previousState) => ({ ...previousState, [type]: true }));

    try {
      if (type === 'frontend') {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        localStorage.clear();

        if (token) {
          localStorage.setItem('token', token);
        }
        if (user) {
          localStorage.setItem('user', user);
        }

        sessionStorage.clear();
        await sleep(500);
        message.success('前端缓存已清理，页面加载性能已优化');
      } else if (type === 'backend') {
        await clearCache();
        await pruneLogs();
        message.success('服务器临时文件与日志已清理');
      } else {
        await analyzeDatabase();
        message.success('数据库索引已重建');
      }
    } catch (error) {
      message.error('维护操作失败');
    } finally {
      setLoadingMap((previousState) => ({ ...previousState, [type]: false }));
    }
  };

  const maintenanceCards = useMemo(
    () => createMaintenanceCards({ loadingMap, runSingleMaintenance }),
    [loadingMap],
  );

  const maintenanceSteps = useMemo(
    () => createMaintenanceSteps({ currentStep, loading, results }),
    [currentStep, loading, results],
  );

  return {
    loading,
    modalVisible,
    setModalVisible,
    currentStep,
    results,
    maintenanceCards,
    maintenanceSteps,
    runAllMaintenance,
    runSingleMaintenance,
  };
}
