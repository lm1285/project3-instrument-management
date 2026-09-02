import { useMemo } from 'react';
import type { Instrument } from '../types';
import { buildMergeWorkbenchResult } from '../logic/mergeGroupQueries';

export const useMergeGroupWorkbench = ({
  dateFormat,
  instruments,
  revision = 0,
  viewType,
}: {
  dateFormat: string;
  instruments: Instrument[];
  revision?: number;
  viewType?: 'std' | 'mat' | 'aux';
}) =>
  useMemo(
    () =>
      buildMergeWorkbenchResult({
        dateFormat,
        instruments,
        viewType,
      }),
    [dateFormat, instruments, revision, viewType],
  );
