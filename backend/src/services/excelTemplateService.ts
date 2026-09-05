import dbConfig from '../config/dbConfig';
import { logAudit } from './auditService';

type ExcelTemplateRow = {
  id: string;
  name: string;
  fingerprint_hash: string | null;
  rules_json: string | null;
  example_data_json: string | null;
  created_at: string | null;
  updated_at: string | null;
  generation_config_json: string | null;
  directory_metadata_json: string | null;
  status: number | null;
  deleted_at: string | null;
  version: number | null;
};

type ExcelTemplateVersionRow = {
  id: string;
  template_id: string;
  version: number;
  rules_json: string;
  change_note: string | null;
  created_by: string | null;
  created_at: string;
};

type SaveTemplateInput = {
  id?: string;
  name: string;
  fingerprint?: unknown;
  rules: unknown;
  exampleData?: unknown;
  changeNote?: string;
  createdBy?: string;
  generationConfiguration?: unknown;
  directoryMetadata?: unknown;
};

type GenerationRecordInput = {
  templateId: string;
  templateVersion?: number;
  workbookName?: string;
  filePath?: string;
  generatedBy?: string;
  parameterSnapshot?: unknown;
};

type MatchFingerprint = {
  exactFingerprint?: string;
  fuzzyFingerprint?: string;
  summary?: string;
  sheetNames?: string[];
  title?: string;
  headerTexts?: string[];
};

type MatchedTemplateRow = ExcelTemplateRow & {
  matchScore: number;
  matchReason: string;
};

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_\-/:：,，。\.、\(\)\[\]（）]/g, '')
    .trim();
}

function levenshteinDistance(source: string, target: string): number {
  if (!source) {
    return target.length;
  }

  if (!target) {
    return source.length;
  }

  const costs = new Array(target.length + 1).fill(0).map((_, index) => index);
  for (let i = 1; i <= source.length; i += 1) {
    let previous = costs[0];
    costs[0] = i;

    for (let j = 1; j <= target.length; j += 1) {
      const current = costs[j];
      const substitution = source[i - 1] === target[j - 1] ? previous : previous + 1;
      costs[j] = Math.min(costs[j] + 1, costs[j - 1] + 1, substitution);
      previous = current;
    }
  }

  return costs[target.length];
}

function overlapRatio(left: string[], right: string[]): number {
  const leftSet = new Set(left.map(normalizeText).filter(Boolean));
  const rightSet = new Set(right.map(normalizeText).filter(Boolean));
  if (!leftSet.size || !rightSet.size) {
    return 0;
  }

  let matchCount = 0;
  leftSet.forEach((item) => {
    if (rightSet.has(item)) {
      matchCount += 1;
    }
  });

  return matchCount / Math.max(leftSet.size, rightSet.size);
}

function titleSimilarity(left: string, right: string): number {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 1;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return 0.92;
  }

  const distance = levenshteinDistance(normalizedLeft, normalizedRight);
  const maxLength = Math.max(normalizedLeft.length, normalizedRight.length);
  return Math.max(0, 1 - distance / Math.max(1, maxLength));
}

function extractRuleItemNames(rulesJson: string | null): string[] {
  const rules = safeJsonParse<any[]>(rulesJson, []);
  if (!Array.isArray(rules)) {
    return [];
  }

  return rules
    .map((rule) => String(rule?.item_name ?? rule?.fieldAlias ?? rule?.fieldName ?? '').trim())
    .filter(Boolean);
}

function buildMatchReason(sheetScore: number, titleScore: number, fieldScore: number): string {
  const parts: string[] = [];
  if (sheetScore > 0) {
    parts.push(`工作表匹配 ${(sheetScore * 100).toFixed(0)}%`);
  }

  if (titleScore > 0) {
    parts.push(`标题匹配 ${(titleScore * 100).toFixed(0)}%`);
  }

  if (fieldScore > 0) {
    parts.push(`字段匹配 ${(fieldScore * 100).toFixed(0)}%`);
  }

  return parts.join('，');
}

class ExcelTemplateService {
  private get db() {
    return dbConfig.getConnection();
  }

  async listTemplates(): Promise<ExcelTemplateRow[]> {
    return this.db.all<ExcelTemplateRow[]>(
      `SELECT t.*, COALESCE((SELECT MAX(v.version) FROM excel_template_versions v WHERE v.template_id = t.id), 1) AS version
       FROM excel_templates t ORDER BY COALESCE(t.updated_at, t.created_at) DESC`
    );
  }

  async getTemplateVersions(templateId: string): Promise<ExcelTemplateVersionRow[]> {
    return this.db.all<ExcelTemplateVersionRow[]>(
      `SELECT * FROM excel_template_versions WHERE template_id = ? ORDER BY version DESC`,
      [templateId]
    );
  }

  async getTemplateById(templateId: string): Promise<ExcelTemplateRow | null> {
    return (await this.db.get<ExcelTemplateRow>(
      `SELECT t.*, COALESCE((SELECT MAX(v.version) FROM excel_template_versions v WHERE v.template_id = t.id), 1) AS version
       FROM excel_templates t WHERE t.id = ?`,
      [templateId]
    )) ?? null;
  }

  async matchTemplatesByFingerprint(fingerprint: unknown): Promise<MatchedTemplateRow[]> {
    const incoming = (fingerprint ?? {}) as MatchFingerprint;
    const exactJson = toJson(fingerprint);
    const exactTemplates = await this.db.all<ExcelTemplateRow[]>(
      `SELECT t.*, COALESCE((SELECT MAX(v.version) FROM excel_template_versions v WHERE v.template_id = t.id), 1) AS version
       FROM excel_templates t WHERE t.fingerprint_hash = ? ORDER BY t.created_at ASC`,
      [exactJson]
    );

    if (exactTemplates.length > 0) {
      return exactTemplates.map((template) => ({
        ...template,
        matchScore: 100,
        matchReason: '指纹完全匹配',
      }));
    }

    const templates = await this.db.all<ExcelTemplateRow[]>(
      `SELECT t.*, COALESCE((SELECT MAX(v.version) FROM excel_template_versions v WHERE v.template_id = t.id), 1) AS version
       FROM excel_templates t ORDER BY COALESCE(t.updated_at, t.created_at) DESC`
    );

    const scored = templates
      .map((template) => this.scoreTemplate(template, incoming))
      .filter((template): template is MatchedTemplateRow => template !== null)
      .sort((left, right) => right.matchScore - left.matchScore);

    if (!scored.length) {
      return [];
    }

    const topScore = scored[0].matchScore;
    return scored.filter((item) => item.matchScore >= Math.max(60, topScore - 12)).slice(0, 3);
  }

  async saveTemplate(input: SaveTemplateInput): Promise<{ id: string; version: number; merged: boolean }> {
    const existing = input.id
      ? await this.db.get<ExcelTemplateRow>(`SELECT * FROM excel_templates WHERE id = ?`, [input.id])
      : await this.db.get<ExcelTemplateRow>(
          `SELECT * FROM excel_templates WHERE fingerprint_hash = ? AND name = ?`,
          [toJson(input.fingerprint), input.name]
        );

    if (!existing) {
      return this.createTemplate(input);
    }

    return this.updateTemplate({
      id: existing.id,
      name: input.name,
      fingerprint: input.fingerprint,
      rules: input.rules,
      generationConfiguration: input.generationConfiguration,
      directoryMetadata: input.directoryMetadata,
      changeNote: input.changeNote,
      createdBy: input.createdBy,
    });
  }

  async updateTemplate(input: SaveTemplateInput & { id: string }): Promise<{ id: string; version: number; merged: boolean }> {
    const template = await this.db.get<ExcelTemplateRow>(`SELECT * FROM excel_templates WHERE id = ?`, [input.id]);

    if (!template) {
      throw new Error('Template not found');
    }

    const currentVersion = await this.db.get<{ maxVersion: number | null }>(
      `SELECT MAX(version) AS maxVersion FROM excel_template_versions WHERE template_id = ?`,
      [input.id]
    );
    const nextVersion = (currentVersion?.maxVersion ?? 0) + 1;
    const fingerprintHash = input.fingerprint === undefined ? template.fingerprint_hash : toJson(input.fingerprint);
    const generationConfigJson = input.generationConfiguration === undefined
      ? template.generation_config_json
      : toJson(input.generationConfiguration);
    const directoryMetadataJson = input.directoryMetadata === undefined
      ? template.directory_metadata_json
      : toJson(input.directoryMetadata);

    await this.db.transaction(async (adapter) => {
      await adapter.run(
        `UPDATE excel_templates
         SET name = ?, rules_json = ?, fingerprint_hash = ?, generation_config_json = ?, directory_metadata_json = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [input.name, toJson(input.rules), fingerprintHash, generationConfigJson, directoryMetadataJson, input.id]
      );

      await adapter.run(
        `INSERT INTO excel_template_versions (id, template_id, version, rules_json, change_note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          genId('TPLVER'),
          input.id,
          nextVersion,
          toJson(input.rules),
          input.changeNote ?? null,
          input.createdBy ?? null,
        ]
      );
    });

    void logAudit({
      action: 'excel_template_updated',
      module: 'excel_template',
      target_id: input.id,
      username: input.createdBy,
      payload_json: {
        version: nextVersion,
        name: input.name,
        changeNote: input.changeNote ?? null,
      },
    });

    return { id: input.id, version: nextVersion, merged: true };
  }

  async createGenerationRecord(input: GenerationRecordInput): Promise<{ id: string }> {
    const id = genId('GEN');
    await this.db.run(
      `INSERT INTO excel_generation_records
       (id, template_id, template_version, workbook_name, file_path, generated_by, parameter_snapshot_json, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        id,
        input.templateId,
        input.templateVersion ?? null,
        input.workbookName ?? null,
        input.filePath ?? null,
        input.generatedBy ?? null,
        toJson(input.parameterSnapshot),
      ]
    );

    void logAudit({
      action: 'excel_generation_created',
      module: 'excel_template',
      target_id: input.templateId,
      username: input.generatedBy,
      payload_json: {
        generationRecordId: id,
        workbookName: input.workbookName ?? null,
        templateVersion: input.templateVersion ?? null,
      },
    });

    return { id };
  }

  private scoreTemplate(template: ExcelTemplateRow, fingerprint: MatchFingerprint): MatchedTemplateRow | null {
    const storedFingerprint = safeJsonParse<MatchFingerprint>(template.fingerprint_hash, {});
    const currentSheetNames = fingerprint.sheetNames ?? [];
    const storedSheetNames = storedFingerprint.sheetNames ?? [];
    const currentTitle = fingerprint.title ?? '';
    const storedTitle = storedFingerprint.title ?? template.name ?? '';
    const currentHeaders = fingerprint.headerTexts ?? [];
    const storedHeaders = [
      ...(storedFingerprint.headerTexts ?? []),
      ...extractRuleItemNames(template.rules_json),
    ];

    const sheetScore = overlapRatio(currentSheetNames, storedSheetNames);
    const headerScore = overlapRatio(currentHeaders, storedHeaders);
    const titleScore = titleSimilarity(currentTitle, storedTitle);

    const weightedScore = Math.round(sheetScore * 35 + titleScore * 35 + headerScore * 30);
    if (weightedScore < 45) {
      return null;
    }

    return {
      ...template,
      matchScore: weightedScore,
      matchReason: buildMatchReason(sheetScore, titleScore, headerScore),
    };
  }

  private async createTemplate(input: SaveTemplateInput): Promise<{ id: string; version: number; merged: boolean }> {
    const id = genId('TPL');
    const version = 1;

    await this.db.transaction(async (adapter) => {
      await adapter.run(
        `INSERT INTO excel_templates
         (id, name, fingerprint_hash, rules_json, example_data_json, generation_config_json, directory_metadata_json, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [id, input.name, toJson(input.fingerprint), toJson(input.rules), toJson(input.exampleData),
          toJson(input.generationConfiguration), toJson(input.directoryMetadata)]
      );

      await adapter.run(
        `INSERT INTO excel_template_versions (id, template_id, version, rules_json, change_note, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [
          genId('TPLVER'),
          id,
          version,
          toJson(input.rules),
          input.changeNote ?? 'initial version',
          input.createdBy ?? null,
        ]
      );
    });

    void logAudit({
      action: 'excel_template_created',
      module: 'excel_template',
      target_id: id,
      username: input.createdBy,
      payload_json: {
        version,
        name: input.name,
      },
    });

    return { id, version, merged: false };
  }
}

export default new ExcelTemplateService();
