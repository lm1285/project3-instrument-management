import { useEffect, useMemo, useState } from 'react';
import type { Instrument } from '../types';
import { saveMergeGroupDraft } from '../logic/mergeGroupCommands';

export const useMergeGroupEditor = ({
  availableInstruments = [],
  existingGroupId,
  initial,
  members,
  typeName,
  visible,
}: {
  availableInstruments?: Instrument[];
  existingGroupId?: string | null;
  initial: { name: string; model: string; measureRange: string };
  members: Instrument[];
  typeName: string;
  visible: boolean;
}) => {
  const [name, setName] = useState(initial.name);
  const [model, setModel] = useState(initial.model);
  const [measureRange, setMeasureRange] = useState(initial.measureRange || '');
  const [currentMembers, setCurrentMembers] = useState<Instrument[]>([]);

  useEffect(() => {
    if (!visible) return;
    setName(initial.name);
    setModel(initial.model);
    setMeasureRange(initial.measureRange || '');
    setCurrentMembers(members);
  }, [initial.measureRange, initial.model, initial.name, members, visible]);

  const disabledOk = useMemo(() => !name.trim() || !model.trim(), [model, name]);

  const removeMember = (memberId: string) => {
    setCurrentMembers((prev) => prev.filter((member) => String(member.id) !== memberId));
  };

  const addMember = (instrument: Instrument) => {
    setCurrentMembers((prev) => {
      if (prev.some((member) => String(member.id) === String(instrument.id))) {
        return prev;
      }
      return prev.concat(instrument);
    });
  };

  const candidateInstruments = useMemo(
    () =>
      availableInstruments.filter(
        (instrument) =>
          instrument.type === typeName &&
          !currentMembers.some((member) => String(member.id) === String(instrument.id)),
      ),
    [availableInstruments, currentMembers, typeName],
  );

  const save = async () =>
    saveMergeGroupDraft({
      existingGroupId,
      typeName,
      initial,
      members,
      nextMembers: currentMembers,
      nextValues: {
        name: name.trim(),
        model: model.trim(),
        measureRange: measureRange.trim(),
      },
    });

  return {
    addMember,
    candidateInstruments,
    currentMembers,
    disabledOk,
    measureRange,
    model,
    name,
    removeMember,
    save,
    setCurrentMembers,
    setMeasureRange,
    setModel,
    setName,
  };
};
