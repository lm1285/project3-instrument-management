import dbConfig from '../config/dbConfig';
import { v4 as uuidv4 } from 'uuid';
import { checkMeasurementMatch, checkRangeMatch, calculateAverageRange } from '../utils/rangeUtils';

export interface MergeGroup {
  id: string;
  name: string;
  model?: string;
  measurementRange?: string;
  description?: string;
  type?: string;
  alertLevel?: string;
  alertMode?: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

// Helper to normalize strings for comparison (处理全角/半角，移除所有空格，统一标点)
const normalize = (s: string) => {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // Fullwidth to Halfwidth
    .replace(/[\u3000]/g, '') // Fullwidth space
    .replace(/：/g, ':').replace(/；/g, ';')
    .replace(/（/g, '(').replace(/）/g, ')');
};

// Levenshtein Distance
const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  
  const d = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[n][m];
};

// Calculate Similarity (0.0 - 1.0)
const calculateSimilarity = (s1: string, s2: string): number => {
  const n1 = normalize(s1);
  const n2 = normalize(s2);
  if (n1 === n2) return 1.0;
  if (!n1 || !n2) return 0.0; // One is empty, other is not -> 0 (unless both empty, handled above)
  
  const dist = levenshtein(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1.0;
  return 1.0 - (dist / maxLen);
};

// Helper: Check if fields are compatible (Empty = Wildcard, otherwise strict match > 99%)
const isFieldCompatible = (s1?: string, s2?: string): boolean => {
  if (!s1 || !s2) return true; // One is empty -> Match
  return calculateSimilarity(s1, s2) > 0.99;
};

// Helper: Check if ranges are compatible
const isRangeCompatible = (r1?: string, r2?: string, type?: string): boolean => {
  if (!r1 || !r2) return true; // One is empty -> Match

  // Check parsed numeric/point compatibility first
  if (checkMeasurementMatch(r1, r2, { type })) return true;
  
  // Check string similarity
  return calculateSimilarity(r1, r2) > 0.99;
};

export default {
  /**
   * 获取合并组列表
   */
  async getGroups(search?: string): Promise<MergeGroup[]> {
    const db = dbConfig.getConnection();
    let sql = `
      SELECT g.*, 
             (SELECT COUNT(*) FROM instruments WHERE mergeGroupId = g.id) as memberCount,
             (SELECT MAX(type) FROM instruments WHERE mergeGroupId = g.id) as inferredType
      FROM merge_groups g
    `;
    
    const params: any[] = [];
    
    if (search) {
      sql += ` WHERE g.name LIKE ? OR g.model LIKE ?`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ` ORDER BY g.updatedAt DESC`;
    
    const rows = await db.all(sql, params);
    return rows.map((row: any) => ({
      ...row,
      type: row.type || row.inferredType // 优先使用显式类型，否则使用推断类型
    }));
  },

  /**
   * 获取单个合并组详情（包含成员）
   */
  async getGroupById(id: string) {
    const db = dbConfig.getConnection();
    const group = await db.get('SELECT * FROM merge_groups WHERE id = ?', [id]);
    if (!group) return null;
    
    const members = await db.all('SELECT * FROM instruments WHERE mergeGroupId = ?', [id]);
    // 如果 group.type 为空，尝试从成员推断
    if (!group.type && members.length > 0) {
      group.type = members[0].type;
    }
    return { ...group, members };
  },

  /**
   * 创建合并组
   */
  async createGroup(data: { name: string; model?: string; measurementRange?: string; description?: string; type?: string; alertLevel?: string; alertMode?: string }, dbOverride?: any): Promise<MergeGroup> {
    const db = dbOverride || dbConfig.getConnection();
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await db.run(
      `INSERT INTO merge_groups (id, name, model, measurementRange, description, type, alertLevel, alertMode, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, data.name, data.model || '', data.measurementRange || '', data.description || '', data.type || null, data.alertLevel || null, data.alertMode || null, now, now]
    );
    
    return {
      id,
      name: data.name,
      model: data.model,
      measurementRange: data.measurementRange,
      description: data.description,
      type: data.type,
      alertLevel: data.alertLevel,
      alertMode: data.alertMode,
      createdAt: now,
      updatedAt: now,
      memberCount: 0
    };
  },

  /**
   * 更新合并组
   */
  async updateGroup(id: string, data: { name?: string; model?: string; measurementRange?: string; description?: string; type?: string; alertLevel?: string; alertMode?: string }, dbOverride?: any): Promise<boolean> {
    const db = dbOverride || dbConfig.getConnection();
    const now = new Date().toISOString();
    
    const sets: string[] = [];
    const params: any[] = [];
    
    if (data.name !== undefined) {
      sets.push('name = ?');
      params.push(data.name);
    }
    if (data.model !== undefined) {
      sets.push('model = ?');
      params.push(data.model);
    }
    if (data.measurementRange !== undefined) {
      sets.push('measurementRange = ?');
      params.push(data.measurementRange);
    }
    if (data.description !== undefined) {
      sets.push('description = ?');
      params.push(data.description);
    }
    if (data.type !== undefined) {
      sets.push('type = ?');
      params.push(data.type);
    }
    if (data.alertLevel !== undefined) {
      sets.push('alertLevel = ?');
      params.push(data.alertLevel);
    }
    if (data.alertMode !== undefined) {
      sets.push('alertMode = ?');
      params.push(data.alertMode);
    }
    
    if (sets.length === 0) return true;
    
    sets.push('updatedAt = ?');
    params.push(now);
    params.push(id);
    
    // Start transaction if not provided
    const action = async (txDb: any) => {
      try {
        const result = await txDb.run(`UPDATE merge_groups SET ${sets.join(', ')} WHERE id = ?`, params);
        
        // Check for member range mismatch if measurementRange is updated
        if (data.measurementRange !== undefined || data.type !== undefined) {
            // Check if new range is empty/null -> if so, maybe keep all members? or remove all?
            // Usually empty range means no constraint, so keep all.
            // If it has value, check match.
            const nextGroup = await txDb.get('SELECT type, measurementRange FROM merge_groups WHERE id = ?', [id]);
            if (nextGroup?.measurementRange) {
                const members = await txDb.all('SELECT id, measurementRange FROM instruments WHERE mergeGroupId = ?', [id]);
                const removedIds: string[] = [];
                
                for (const member of members) {
                    if (!checkRangeMatch(member.measurementRange, nextGroup.measurementRange, { type: nextGroup?.type })) {
                        removedIds.push(member.id);
                    }
                }
                
                if (removedIds.length > 0) {
                    const placeholders = removedIds.map(() => '?').join(',');
                    await txDb.run(
                        `UPDATE instruments SET mergeGroupId = NULL, groupName = NULL WHERE id IN (${placeholders})`,
                        removedIds
                    );
                }
            }
        }
        
        return (result.changes || 0) > 0;
      } catch (error) {
        throw error;
      }
    };

    if (dbOverride) {
      return action(dbOverride);
    } else {
      return db.transaction(action);
    }
  },

  /**
   * 删除合并组
   * 删除组时，将组成员的 mergeGroupId 置为 NULL
   */
  async deleteGroup(id: string, dbOverride?: any): Promise<boolean> {
    const db = dbOverride || dbConfig.getConnection();
    
    const action = async (txDb: any) => {
      try {
        console.log(`[MergeService] Deleting group ${id}...`);
        
        // 1. 检查组是否存在
        const group = await txDb.get('SELECT id FROM merge_groups WHERE id = ?', [id]);
        if (!group) {
            console.warn(`[MergeService] Group ${id} not found, skipping delete.`);
            return false;
        }

        // 2. 清除成员关联 (同时清除 groupName 以防止回退到显式分组)
        const updateResult = await txDb.run('UPDATE instruments SET mergeGroupId = NULL, groupName = NULL WHERE mergeGroupId = ?', [id]);
        console.log(`[MergeService] Removed ${updateResult.changes} members from group ${id}.`);
        
        // 3. 删除组
        const deleteResult = await txDb.run('DELETE FROM merge_groups WHERE id = ?', [id]);
        console.log(`[MergeService] Deleted group ${id}. Changes: ${deleteResult.changes}`);
        
        if ((deleteResult.changes || 0) === 0) {
            console.error(`[MergeService] Failed to delete group ${id} (0 changes).`);
            throw new Error(`Failed to delete group ${id}`);
        }

        return true;
      } catch (error) {
        console.error(`[MergeService] Error deleting group ${id}:`, error);
        throw error;
      }
    };

    if (dbOverride) {
      return action(dbOverride);
    } else {
      return db.transaction(action);
    }
  },

  /**
   * 添加成员到合并组 (Move In)
   */
  async addMember(groupId: string, instrumentId: string, syncAlerts?: { alertLevel: string, alertMode: string }, dbOverride?: any): Promise<boolean> {
    const db = dbOverride || dbConfig.getConnection();
    const now = new Date().toISOString();

    const action = async (txDb: any) => {
      try {
        // 检查组是否存在
        const group = await txDb.get('SELECT id FROM merge_groups WHERE id = ?', [groupId]);
        if (!group) throw new Error('合并组不存在');

        // 如果需要同步，先备份当前设置
        if (syncAlerts) {
            const currentInstrument = await txDb.get('SELECT alertLevel, alertMode FROM instruments WHERE id = ?', [instrumentId]);
            if (currentInstrument) {
                // 检查是否已有备份（避免重复备份覆盖原始值）
                const existingBackup = await txDb.get(
                    'SELECT * FROM merge_group_member_backups WHERE instrumentId = ? AND mergeGroupId = ?',
                    [instrumentId, groupId]
                );

                if (!existingBackup) {
                    const backupId = uuidv4();
                    await txDb.run(
                        `INSERT INTO merge_group_member_backups 
                         (id, instrumentId, mergeGroupId, groupId, originalAlertLevel, originalAlertMode, updatedAt, backupDate, originalStatus)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                          backupId,
                          instrumentId,
                          groupId,
                          groupId,
                          currentInstrument.alertLevel,
                          currentInstrument.alertMode,
                          now,
                          now,
                          null,
                        ]
                    );
                }
            }
            
            // 更新仪器设置
            await txDb.run(
                'UPDATE instruments SET alertLevel = ?, alertMode = ? WHERE id = ?',
                [syncAlerts.alertLevel, syncAlerts.alertMode, instrumentId]
            );
        }

        // 加入组
        const result = await txDb.run(
            'UPDATE instruments SET mergeGroupId = ? WHERE id = ?',
            [groupId, instrumentId]
        );
        
        return (result.changes || 0) > 0;
      } catch (error) {
        throw error;
      }
    };

    if (dbOverride) {
      return action(dbOverride);
    } else {
      return db.transaction(action);
    }
  },

  /**
   * 从合并组移除成员 (Move Out)
   */
  async removeMember(instrumentId: string, targetGroupId?: string, dbOverride?: any): Promise<boolean> {
    const db = dbOverride || dbConfig.getConnection();
    
    const action = async (txDb: any) => {
      try {
        console.log(`[MergeService] Removing member ${instrumentId} from group...`);

        // 获取当前组ID（如果未提供 targetGroupId，尝试从仪器获取）
        const instrument = await txDb.get('SELECT mergeGroupId, alertLevel, alertMode FROM instruments WHERE id = ?', [instrumentId]);
        const groupId = targetGroupId || instrument?.mergeGroupId;
        
        console.log(`[MergeService] Target Group ID: ${groupId}, Current Alert: ${instrument?.alertLevel}`);

        // 移出组
        const result = await txDb.run(
            'UPDATE instruments SET mergeGroupId = NULL, groupName = NULL WHERE id = ?',
            [instrumentId]
        );
        console.log(`[MergeService] Removed from group. Changes: ${result.changes}`);

        if (groupId) {
            // 尝试恢复备份
            const backup = await txDb.get(
                'SELECT * FROM merge_group_member_backups WHERE instrumentId = ? AND mergeGroupId = ?',
                [instrumentId, groupId]
            );

            if (backup) {
                console.log(`[MergeService] Found backup: ${JSON.stringify(backup)}`);
                // 只有当备份中有有效值时才恢复
                // 如果备份是空的（说明入组前没设置），但现在有值（说明入组时同步了），则保留现在的值（"采用更新后的"）
                if (backup.originalAlertLevel || backup.originalAlertMode) {
                    console.log(`[MergeService] Restoring original alert settings...`);
                    await txDb.run(
                        'UPDATE instruments SET alertLevel = ?, alertMode = ? WHERE id = ?',
                        [backup.originalAlertLevel, backup.originalAlertMode, instrumentId]
                    );
                } else {
                    console.log(`[MergeService] Backup is empty. Keeping current settings (updated value).`);
                }
                
                // 删除备份
                await txDb.run(
                    'DELETE FROM merge_group_member_backups WHERE instrumentId = ? AND mergeGroupId = ?',
                    [instrumentId, groupId]
                );
            } else {
                console.log(`[MergeService] No backup found for instrument ${instrumentId} in group ${groupId}.`);
            }
        } else {
             console.warn(`[MergeService] No group ID found for instrument ${instrumentId}, cannot check for backups.`);
        }
        
        return (result.changes || 0) > 0;
      } catch (error) {
        console.error(`[MergeService] Error removing member ${instrumentId}:`, error);
        throw error;
      }
    };

    if (dbOverride) {
      return action(dbOverride);
    } else {
      return db.transaction(action);
    }
  },
  
  /**
   * 同步旧版 groupName 数据到 merge_groups 表
   */
  async syncLegacyGroups(dbOverride?: any): Promise<number> {
    const db = dbOverride || dbConfig.getConnection();
    
    // 1. 查找所有有 groupName 但没有 mergeGroupId 的仪器
    const rows = await db.all(
      'SELECT id, groupName, groupModel FROM instruments WHERE groupName IS NOT NULL AND groupName != \'\' AND mergeGroupId IS NULL'
    );
    
    if (rows.length === 0) return 0;
    
    const groups = new Map<string, { name: string, model: string, ids: string[] }>();
    
    for (const row of rows) {
      const key = row.groupName; // Group by name
      if (!groups.has(key)) {
        groups.set(key, { name: row.groupName, model: row.groupModel || '', ids: [] });
      }
      groups.get(key)!.ids.push(row.id);
    }
    
    let createdCount = 0;
    
    const action = async (txDb: any) => {
      try {
        for (const [name, data] of groups.entries()) {
          // 检查组是否已存在 (by name)
          const existing = await txDb.get('SELECT id FROM merge_groups WHERE name = ?', [name]);
          let groupId = existing?.id;
          
          if (!groupId) {
              // 创建新组 - Reuse createGroup logic by calling it directly?
              // createGroup supports dbOverride now.
              // But here we are already inside a transaction (potentially).
              // Let's use this.createGroup if possible, but 'this' context might be tricky if not careful.
              // Or just inline as before but clean up.
              
              const id = uuidv4();
              const now = new Date().toISOString();
              await txDb.run(
                `INSERT INTO merge_groups (id, name, model, measurementRange, description, type, alertLevel, alertMode, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, data.name, data.model, '', '', null, null, null, now, now]
              );
              groupId = id;
              createdCount++;
          }
          
          // 更新仪器
          for (const instrumentId of data.ids) {
              await txDb.run('UPDATE instruments SET mergeGroupId = ? WHERE id = ?', [groupId, instrumentId]);
          }
        }
      } catch (error) {
        throw error;
      }
    };

    if (dbOverride) {
      await action(dbOverride);
    } else {
      await db.transaction(action);
    }
    
    return createdCount;
  },

  // 保留旧接口兼容性
  async resyncByName(_name: string): Promise<void> { return; },
  invalidateLiveCache(): void { return; },

  /**
   * 获取智能合并建议
   */
  async getSuggestions(filterType?: string): Promise<{
    addToExisting: Array<{
      targetGroup: { id: string; name: string; model: string; measurementRange: string; type: string };
      candidates: Array<{ id: string; name: string; model: string; managementNumber: string; measurementRange: string; type: string }>;
    }>;
    createNew: Array<{
      suggestedName: string;
      suggestedModel: string;
      suggestedRange: string;
      suggestedType: string;
      candidates: Array<{ id: string; name: string; model: string; managementNumber: string; measurementRange: string; type: string }>;
    }>;
  }> {
    const db = dbConfig.getConnection();

    // 1. 获取所有现有合并组 (包含推断类型)
    let groupsQuery = `
      SELECT g.id, g.name, g.model, g.measurementRange, g.type,
             (SELECT type FROM instruments WHERE mergeGroupId = g.id AND type IS NOT NULL LIMIT 1) as inferredType,
             (SELECT COUNT(*) FROM instruments WHERE mergeGroupId = g.id) as memberCount
      FROM merge_groups g
    `;

    const groups = await db.all(groupsQuery);
    
    // 2. 获取所有未分组的仪器
    let orphansQuery = `
      SELECT id, name, model, managementNumber, measurementRange, type 
      FROM instruments 
      WHERE (mergeGroupId IS NULL OR mergeGroupId = '')
    `;
    const orphansParams: any[] = [];
    if (filterType) {
        orphansQuery += ` AND type = ?`;
        orphansParams.push(filterType);
    }

    const orphans = await db.all(orphansQuery, orphansParams);

    const addToExisting = [];
    const createNew = [];
    const assignedOrphanIds = new Set<string>();

    // A. Orphan Adoption Strategy (归巢)
    for (const group of groups) {
      const groupType = group.type || group.inferredType;

      if (filterType && groupType && groupType !== filterType) continue;
      
      // Note: We allow groups with empty fields to match via wildcard

      const candidates = orphans.filter(orphan => {
        if (assignedOrphanIds.has(orphan.id)) return false;

        // 1. Check Type match (必须一致)
        if (groupType && orphan.type && groupType !== orphan.type) return false;

        // 2. Check Name Compatibility
        if (!isFieldCompatible(group.name, orphan.name)) return false;

        // 3. Check Model Compatibility
        if (!isFieldCompatible(group.model, orphan.model)) return false;

        // 4. Check Range Compatibility
        if (!isRangeCompatible(group.measurementRange, orphan.measurementRange, groupType || orphan.type)) return false;

        return true;
      });

      if (candidates.length > 0) {
        addToExisting.push({
          targetGroup: { ...group, type: groupType },
          candidates: candidates
        });
        candidates.forEach(c => assignedOrphanIds.add(c.id));
      }
    }

    // B. Cluster Discovery Strategy (聚类)
    const remainingOrphans = orphans.filter(o => !assignedOrphanIds.has(o.id));
    
    // Clusters: Array of Array of instruments
    const clusters: typeof orphans[] = [];

    for (const orphan of remainingOrphans) {
        let foundCluster = false;

        // Try to fit into an existing cluster
        for (const cluster of clusters) {
            // Compare with the first element of the cluster (representative)
            const rep = cluster[0];

            // 1. Check Type match
            if (rep.type && orphan.type && rep.type !== orphan.type) continue;
            
            // 2. Check Name Compatibility
            if (!isFieldCompatible(rep.name, orphan.name)) continue;

            // 3. Check Model Compatibility
            if (!isFieldCompatible(rep.model, orphan.model)) continue;

            // 4. Check Range Compatibility
            if (!isRangeCompatible(rep.measurementRange, orphan.measurementRange, rep.type || orphan.type)) continue;

            // Match found
            cluster.push(orphan);
            foundCluster = true;
            break;
        }

        // If no cluster found, create a new one
        if (!foundCluster) {
            clusters.push([orphan]);
        }
    }

    // Filter clusters with > 1 members
    for (const cluster of clusters) {
        if (cluster.length < 2) continue;

        const representative = cluster[0];
        
        // Calculate Average Range for the new group
        const avgRange = calculateAverageRange(cluster.map(c => c.measurementRange));
        createNew.push({
          suggestedName: representative.name,
          suggestedModel: representative.model,
          suggestedRange: avgRange || representative.measurementRange,
          suggestedType: representative.type,
          candidates: cluster
        });
    }

    return { addToExisting, createNew };
  }
};
