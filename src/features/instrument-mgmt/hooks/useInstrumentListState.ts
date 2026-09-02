import { useState, useEffect } from 'react';
import { mergeGroupService, MergeGroup } from '../services/mergeGroupService';

// Hook for managing instrument list view state
export const useInstrumentListState = () => {
  const [viewType, setViewType] = useState<string>('all');
  const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
  const [isMergeGroupModalVisible, setIsMergeGroupModalVisible] = useState(false);

  const fetchMergeGroups = async () => {
    try {
      const res = await mergeGroupService.getGroups();
      if (res.success) {
        setMergeGroups(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch merge groups', error);
    }
  };

  useEffect(() => {
    fetchMergeGroups();
  }, []);

  // Refresh merge groups when modal closes
  useEffect(() => {
    if (!isMergeGroupModalVisible) {
      fetchMergeGroups();
    }
  }, [isMergeGroupModalVisible]);

  return {
    viewType,
    setViewType,
    mergeGroups,
    isMergeGroupModalVisible,
    setIsMergeGroupModalVisible,
    fetchMergeGroups
  };
};
