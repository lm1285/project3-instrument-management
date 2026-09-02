export interface LengthShadowRule {
  id: string;
  department: string;
  instrumentName: string;
  modelSpec: string;
  changeContent: string;
  targetCell: string;
  templateCode: string;
  procedureCode: string;
  specialRuleText: string;
  parsedChangeParts: Array<
    | { type: 'max'; label: string }
    | { type: 'min'; label: string }
    | { type: 'text'; label: string; value: string }
  >;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface LengthShadowRulePayload {
  department?: string;
  instrumentName: string;
  modelSpec?: string;
  changeContent: string;
  targetCell: string;
  templateCode?: string;
  procedureCode?: string;
  specialRuleText?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export interface LengthShadowQueryResult {
  matched: boolean;
  input: {
    department?: string;
    instrumentName: string;
    modelSpec: string;
    templateCode: string;
    procedureCode: string;
  };
  matchStrategy: string;
  candidateCount: number;
  outputs: Array<{
    ruleId: string;
    department?: string;
    instrumentName: string;
    modelSpec: string;
    changeContent: string;
    resolvedContent: string;
    resolvedParts: string[];
    targetCell: string;
    templateCode: string;
    procedureCode: string;
    specialRuleText: string;
    matchScore: number;
    matchReasons: string[];
  }>;
}
