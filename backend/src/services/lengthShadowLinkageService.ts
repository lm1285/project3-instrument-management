import { v4 as uuidv4 } from 'uuid';
import dbConfig from '../config/dbConfig';

export interface LengthShadowRulePayload {
  department?: string;
  instrumentName?: string;
  modelSpec?: string;
  changeContent?: string;
  targetCell?: string;
  templateCode?: string;
  procedureCode?: string;
  specialRuleText?: string;
  enabled?: boolean;
  sortOrder?: number;
}

type ParsedChangePart =
  | { type: 'max'; label: string }
  | { type: 'min'; label: string }
  | { type: 'text'; label: string; value: string };

type QueryPayload = {
  department?: string;
  instrumentName?: string;
  modelSpec?: string;
  templateCode?: string;
  procedureCode?: string;
  elementText?: string;
};

type RuleRecord = {
  id: string;
  department: string | null;
  instrument_name: string;
  model_spec: string | null;
  change_content: string;
  target_cell: string;
  template_code: string | null;
  procedure_code: string | null;
  special_rule_text: string | null;
  parsed_change_content_json: string | null;
  enabled: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const CHANGE_PRESET_MAP: Record<string, ParsedChangePart> = {
  '量程上限': { type: 'max', label: '量程上限' },
  最大值: { type: 'max', label: '最大值' },
  max: { type: 'max', label: '最大值' },
  '量程下限': { type: 'min', label: '量程下限' },
  最小值: { type: 'min', label: '最小值' },
  min: { type: 'min', label: '最小值' },
  数显: { type: 'text', label: '数显', value: '数显' },
  游标: { type: 'text', label: '游标', value: '游标' },
  板厚: { type: 'text', label: '板厚', value: '板厚' },
  壁厚: { type: 'text', label: '壁厚', value: '壁厚' },
};

class LengthShadowLinkageService {
  private normalizeText(value?: string | null) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\s\-_/\\|,，。；:：()（）[\]【】]/g, '');
  }

  private cleanCellAddress(value?: string | null) {
    return String(value || '').trim().toUpperCase();
  }

  private parseChangeContent(changeContent?: string | null): ParsedChangePart[] {
    return String(changeContent || '')
      .split(/[+,\n，]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const preset = CHANGE_PRESET_MAP[item] || CHANGE_PRESET_MAP[item.toLowerCase()];
        if (preset) {
          return preset;
        }

        const textMatch = item.match(/^(?:文本|text)[:：]\s*(.+)$/i);
        if (textMatch) {
          return { type: 'text', label: item, value: textMatch[1].trim() };
        }

        return { type: 'text', label: item, value: item };
      });
  }

  private extractRangeValues(modelSpec?: string | null) {
    const text = String(modelSpec || '');
    const rangeMatch = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|~|至|到)\s*(-?\d+(?:\.\d+)?)/);
    const numbers = rangeMatch
      ? [Number(rangeMatch[1]), Number(rangeMatch[2])]
      : Array.from(text.matchAll(/\d+(?:\.\d+)?/g)).map((match) => Number(match[0]));

    if (!numbers.length) {
      return { minValue: '', maxValue: '' };
    }

    const unitMatch = text.match(/mm|cm|dm|nm|μm|um|m(?![a-zA-Z])|[%°a-zA-Z]+/g);
    const unit = unitMatch?.[unitMatch.length - 1] || '';
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);

    return {
      minValue: `${min}${unit}`.trim(),
      maxValue: `${max}${unit}`.trim(),
    };
  }

  private resolveChangeContent(
    parts: ParsedChangePart[],
    incomingModelSpec?: string | null,
    fallbackModelSpec?: string | null,
  ) {
    const sourceModelSpec = String(incomingModelSpec || '').trim() || String(fallbackModelSpec || '').trim();
    const { minValue, maxValue } = this.extractRangeValues(sourceModelSpec);

    const resolvedParts = parts
      .map((part) => {
        if (part.type === 'max') return maxValue || '';
        if (part.type === 'min') return minValue || '';
        return part.value;
      })
      .filter(Boolean);

    return {
      resolvedParts,
      resolvedContent: resolvedParts.join(' / '),
    };
  }

  private formatRule(record: RuleRecord) {
    return {
      id: record.id,
      department: record.department || '',
      instrumentName: record.instrument_name,
      modelSpec: record.model_spec || '',
      changeContent: record.change_content,
      targetCell: record.target_cell,
      templateCode: record.template_code || '',
      procedureCode: record.procedure_code || '',
      specialRuleText: record.special_rule_text || '',
      parsedChangeParts: this.parseChangeContent(record.change_content),
      enabled: Boolean(record.enabled),
      sortOrder: record.sort_order || 0,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  private sanitizePayload(payload: LengthShadowRulePayload, fallbackDepartment = '') {
    const department = String(payload.department || fallbackDepartment || '').trim();
    const instrumentName = String(payload.instrumentName || '').trim();
    const changeContent = String(payload.changeContent || '').trim();
    const targetCell = this.cleanCellAddress(payload.targetCell);

    if (!department) {
      throw new Error('所属科室不能为空');
    }
    if (!instrumentName) {
      throw new Error('仪器名称不能为空');
    }
    if (!changeContent) {
      throw new Error('需要修改的内容不能为空');
    }
    if (!targetCell) {
      throw new Error('对应单元格不能为空');
    }
    if (!/^[A-Z]+\d+$/.test(targetCell)) {
      throw new Error('对应单元格格式不正确，请使用 A1、B2 这类格式');
    }

    return {
      department,
      instrumentName,
      modelSpec: String(payload.modelSpec || '').trim(),
      changeContent,
      targetCell,
      templateCode: String(payload.templateCode || '').trim(),
      procedureCode: String(payload.procedureCode || '').trim(),
      specialRuleText: String(payload.specialRuleText || '').trim(),
      parsedChangeContentJson: JSON.stringify(this.parseChangeContent(changeContent)),
      enabled: payload.enabled === false ? 0 : 1,
      sortOrder: Number(payload.sortOrder || 0),
    };
  }

  async listRules(page = 1, pageSize = 20, search = '', department = '', includeAllDepartments = false) {
    const db = dbConfig.getConnection();
    const offset = (page - 1) * pageSize;
    const keyword = String(search || '').trim();
    let whereClause = 'WHERE 1 = 1';
    const params: any[] = [];

    if (!includeAllDepartments) {
      if (!department) {
        return { total: 0, rows: [] as ReturnType<typeof this.formatRule>[] };
      }
      whereClause += ' AND department = ?';
      params.push(department);
    } else if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }

    if (keyword) {
      whereClause += `
        AND (
          instrument_name LIKE ?
          OR IFNULL(department, '') LIKE ?
          OR IFNULL(model_spec, '') LIKE ?
          OR change_content LIKE ?
          OR target_cell LIKE ?
          OR IFNULL(template_code, '') LIKE ?
          OR IFNULL(procedure_code, '') LIKE ?
          OR IFNULL(special_rule_text, '') LIKE ?
        )
      `;
      const fuzzy = `%${keyword}%`;
      params.push(fuzzy, fuzzy, fuzzy, fuzzy, fuzzy, fuzzy, fuzzy, fuzzy);
    }

    const totalRow = await db.get<{ count: number }>(
      `SELECT COUNT(*) AS count FROM length_shadow_linkage_rules ${whereClause}`,
      params,
    );

    const rows = await db.all<RuleRecord[]>(
      `
        SELECT *
        FROM length_shadow_linkage_rules
        ${whereClause}
        ORDER BY sort_order ASC, updated_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, pageSize, offset],
    );

    return {
      total: totalRow?.count || 0,
      rows: (rows || []).map((row) => this.formatRule(row)),
    };
  }

  async createRule(payload: LengthShadowRulePayload, fallbackDepartment = '') {
    const db = dbConfig.getConnection();
    const sanitized = this.sanitizePayload(payload, fallbackDepartment);
    const id = uuidv4();
    const now = new Date().toISOString();

    await db.run(
      `
        INSERT INTO length_shadow_linkage_rules (
          id, department, instrument_name, model_spec, change_content, target_cell,
          template_code, procedure_code, special_rule_text, parsed_change_content_json,
          enabled, sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        sanitized.department,
        sanitized.instrumentName,
        sanitized.modelSpec,
        sanitized.changeContent,
        sanitized.targetCell,
        sanitized.templateCode || null,
        sanitized.procedureCode || null,
        sanitized.specialRuleText || null,
        sanitized.parsedChangeContentJson,
        sanitized.enabled,
        sanitized.sortOrder,
        now,
        now,
      ],
    );

    const record = await db.get<RuleRecord>('SELECT * FROM length_shadow_linkage_rules WHERE id = ?', [id]);
    return this.formatRule(record as RuleRecord);
  }

  async updateRule(id: string, payload: LengthShadowRulePayload, fallbackDepartment = '') {
    const db = dbConfig.getConnection();
    const existing = await db.get<RuleRecord>('SELECT * FROM length_shadow_linkage_rules WHERE id = ?', [id]);

    if (!existing) {
      throw new Error('未找到要更新的规则');
    }

    const scopedDepartment = String(fallbackDepartment || '').trim();
    if (scopedDepartment && (existing.department || '').trim() !== scopedDepartment) {
      throw new Error('无权编辑其他科室的规则');
    }

    const sanitized = this.sanitizePayload(
      {
        department: payload.department ?? existing.department ?? fallbackDepartment,
        instrumentName: payload.instrumentName ?? existing.instrument_name,
        modelSpec: payload.modelSpec ?? existing.model_spec ?? '',
        changeContent: payload.changeContent ?? existing.change_content,
        targetCell: payload.targetCell ?? existing.target_cell,
        templateCode: payload.templateCode ?? existing.template_code ?? '',
        procedureCode: payload.procedureCode ?? existing.procedure_code ?? '',
        specialRuleText: payload.specialRuleText ?? existing.special_rule_text ?? '',
        enabled: payload.enabled ?? Boolean(existing.enabled),
        sortOrder: payload.sortOrder ?? existing.sort_order,
      },
      fallbackDepartment,
    );

    const now = new Date().toISOString();

    await db.run(
      `
        UPDATE length_shadow_linkage_rules
        SET department = ?,
            instrument_name = ?,
            model_spec = ?,
            change_content = ?,
            target_cell = ?,
            template_code = ?,
            procedure_code = ?,
            special_rule_text = ?,
            parsed_change_content_json = ?,
            enabled = ?,
            sort_order = ?,
            updated_at = ?
        WHERE id = ?
      `,
      [
        sanitized.department,
        sanitized.instrumentName,
        sanitized.modelSpec,
        sanitized.changeContent,
        sanitized.targetCell,
        sanitized.templateCode || null,
        sanitized.procedureCode || null,
        sanitized.specialRuleText || null,
        sanitized.parsedChangeContentJson,
        sanitized.enabled,
        sanitized.sortOrder,
        now,
        id,
      ],
    );

    const record = await db.get<RuleRecord>('SELECT * FROM length_shadow_linkage_rules WHERE id = ?', [id]);
    return this.formatRule(record as RuleRecord);
  }

  async deleteRule(id: string, department = '', includeAllDepartments = false) {
    const db = dbConfig.getConnection();
    const existing = await db.get<RuleRecord>('SELECT * FROM length_shadow_linkage_rules WHERE id = ?', [id]);

    if (!existing) {
      throw new Error('未找到要删除的规则');
    }

    const scopedDepartment = String(department || '').trim();
    if (!includeAllDepartments && scopedDepartment && (existing.department || '').trim() !== scopedDepartment) {
      throw new Error('无权删除其他科室的规则');
    }

    await db.run('DELETE FROM length_shadow_linkage_rules WHERE id = ?', [id]);
    return { id };
  }

  async bulkDelete(ids: string[], department = '', includeAllDepartments = false) {
    const db = dbConfig.getConnection();
    const cleanedIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
    if (!cleanedIds.length) {
      return { count: 0 };
    }

    const scopedDepartment = String(department || '').trim();
    if (!includeAllDepartments && scopedDepartment) {
      const selectPlaceholders = cleanedIds.map(() => '?').join(', ');
      const rows = await db.all<Array<{ id: string; department: string | null }>>(
        `SELECT id, department FROM length_shadow_linkage_rules WHERE id IN (${selectPlaceholders})`,
        cleanedIds,
      );

      const hasForeignDepartment = (rows || []).some(
        (row) => String(row.department || '').trim() !== scopedDepartment,
      );
      if (hasForeignDepartment) {
        throw new Error('无权批量删除其他科室的规则');
      }
    }

    const placeholders = cleanedIds.map(() => '?').join(', ');
    await db.run(`DELETE FROM length_shadow_linkage_rules WHERE id IN (${placeholders})`, cleanedIds);
    return { count: cleanedIds.length };
  }

  async bulkImport(items: LengthShadowRulePayload[], fallbackDepartment = '') {
    const db = dbConfig.getConnection();
    const rows = Array.isArray(items) ? items : [];
    const now = new Date().toISOString();
    let successCount = 0;
    const errors: Array<{ index: number; message: string }> = [];

    await db.exec('BEGIN TRANSACTION');
    try {
      for (let index = 0; index < rows.length; index += 1) {
        try {
          const sanitized = this.sanitizePayload(rows[index], fallbackDepartment);
          await db.run(
            `
              INSERT INTO length_shadow_linkage_rules (
                id, department, instrument_name, model_spec, change_content, target_cell,
                template_code, procedure_code, special_rule_text, parsed_change_content_json,
                enabled, sort_order, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
              uuidv4(),
              sanitized.department,
              sanitized.instrumentName,
              sanitized.modelSpec,
              sanitized.changeContent,
              sanitized.targetCell,
              sanitized.templateCode || null,
              sanitized.procedureCode || null,
              sanitized.specialRuleText || null,
              sanitized.parsedChangeContentJson,
              sanitized.enabled,
              sanitized.sortOrder,
              now,
              now,
            ],
          );
          successCount += 1;
        } catch (error) {
          errors.push({
            index: index + 1,
            message: error instanceof Error ? error.message : '导入失败',
          });
        }
      }

      await db.exec('COMMIT');
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }

    return {
      successCount,
      failureCount: errors.length,
      errors,
    };
  }

  async queryRules(payload: QueryPayload, fallbackDepartment = '', includeAllDepartments = false) {
    const db = dbConfig.getConnection();
    const inputName = String(payload.instrumentName || payload.elementText || '').trim();
    const inputModelSpec = String(payload.modelSpec || '').trim();
    const normalizedInputName = this.normalizeText(inputName);
    const normalizedInputSpec = this.normalizeText(inputModelSpec);
    const templateCode = String(payload.templateCode || '').trim();
    const procedureCode = String(payload.procedureCode || '').trim();
    const department = String(payload.department || fallbackDepartment || '').trim();

    const rows = await db.all<RuleRecord[]>(
      `
        SELECT *
        FROM length_shadow_linkage_rules
        WHERE enabled = 1
          AND (? = 1 OR department = ?)
        ORDER BY sort_order ASC, updated_at DESC
      `,
      [includeAllDepartments ? 1 : 0, department],
    );

    const ranked = (rows || [])
      .map((row) => {
        const rule = this.formatRule(row);
        const normalizedRuleName = this.normalizeText(rule.instrumentName);
        const normalizedRuleSpec = this.normalizeText(rule.modelSpec);
        let score = 0;
        const reasons: string[] = [];

        if (!normalizedInputName || normalizedInputName !== normalizedRuleName) {
          return null;
        }

        score += 120;
        reasons.push('仪器名称精确匹配');

        if (normalizedInputSpec && normalizedRuleSpec) {
          if (normalizedInputSpec === normalizedRuleSpec) {
            score += 60;
            reasons.push('型号规格精确匹配');
          } else if (
            normalizedInputSpec.includes(normalizedRuleSpec) ||
            normalizedRuleSpec.includes(normalizedInputSpec)
          ) {
            score += 35;
            reasons.push('型号规格模糊匹配');
          }
        }

        if (templateCode && rule.templateCode && templateCode === rule.templateCode) {
          score += 30;
          reasons.push('模板编码匹配');
        }

        if (procedureCode && rule.procedureCode && procedureCode === rule.procedureCode) {
          score += 20;
          reasons.push('规程号匹配');
        }

        const resolved = this.resolveChangeContent(rule.parsedChangeParts, inputModelSpec, rule.modelSpec);

        return {
          ...rule,
          resolvedContent: resolved.resolvedContent,
          resolvedParts: resolved.resolvedParts,
          matchScore: score,
          matchReasons: reasons,
        };
      })
      .filter(Boolean)
      .sort((left, right) => right!.matchScore - left!.matchScore);

    const validRanked = ranked as Array<
      ReturnType<typeof this.formatRule> & {
        resolvedContent: string;
        resolvedParts: string[];
        matchScore: number;
        matchReasons: string[];
      }
    >;

    const bestScore = validRanked[0]?.matchScore || 0;
    const outputs = validRanked
      .filter((item) => item.matchScore === bestScore)
      .map((item) => ({
        ruleId: item.id,
        department: item.department,
        instrumentName: item.instrumentName,
        modelSpec: item.modelSpec,
        changeContent: item.changeContent,
        resolvedContent: item.resolvedContent,
        resolvedParts: item.resolvedParts,
        targetCell: item.targetCell,
        templateCode: item.templateCode,
        procedureCode: item.procedureCode,
        specialRuleText: item.specialRuleText,
        matchScore: item.matchScore,
        matchReasons: item.matchReasons,
      }));

    return {
      matched: outputs.length > 0,
      input: {
        department,
        instrumentName: inputName,
        modelSpec: inputModelSpec,
        templateCode,
        procedureCode,
      },
      matchStrategy: '先按仪器名称匹配，再按型号规格、模板编码、规程号提升优先级；同分时返回多条写入规则。',
      outputs,
      candidateCount: validRanked.length,
    };
  }
}

export default new LengthShadowLinkageService();
