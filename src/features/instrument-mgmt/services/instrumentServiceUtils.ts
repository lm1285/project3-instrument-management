import type { Instrument } from '../types';
import { mapApiResponseToInstrument } from '../../../utils/instrumentMapping';

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function mapInstrumentListResponse(result: any): Instrument[] {
  const instrumentsData = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
  return instrumentsData.map((instrument: any) => mapApiResponseToInstrument(instrument));
}

export function mapSeedInstrumentResponse(raw: any) {
  const payload = raw || {};
  const list = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
  const mapped = list.map((item: any) => mapApiResponseToInstrument(item));
  const count = Array.isArray(payload.data) ? payload.count : mapped.length;
  return { mapped, count };
}

export function buildFailureResult(message: string) {
  return { success: false as const, message };
}
