import fs from 'fs';
import path from 'path';
import { SqliteAdapter } from './dbAdapter';
import type { DatabaseAdapter } from './dbAdapter';

class DatabaseConfig {
  private db: DatabaseAdapter | null = null;
  private dbPath: string | null = null;

  private getLegacyDbPath(): string {
    return path.join(__dirname, '../../database.sqlite');
  }

  private getPreferredDbPath(): string {
    // There is one authoritative database for the installation.  Resolving
    // from the backend directory prevents PM2/CLI working-directory changes
    // from silently creating a second SQLite database.
    return path.join(__dirname, '../../data/database.sqlite');
  }

  private ensureParentDirectory(targetPath: string): void {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  private prepareDbPath(): string {
    const preferredPath = this.getPreferredDbPath();
    const legacyPath = this.getLegacyDbPath();

    this.ensureParentDirectory(preferredPath);

    if (preferredPath !== legacyPath && fs.existsSync(legacyPath) && !fs.existsSync(preferredPath)) {
      fs.copyFileSync(legacyPath, preferredPath);
      console.log(`Migrated legacy SQLite database from ${legacyPath} to ${preferredPath}`);
    }

    return preferredPath;
  }

  async init(): Promise<void> {
    if (this.db) {
      try { await this.db.get('SELECT 1'); return; } catch { this.db = null; }
    }
    console.log(`Initializing SQLite database...`);
    try {
        const dbPath = this.prepareDbPath();
        this.dbPath = dbPath;
        this.db = new SqliteAdapter({ filename: dbPath });
        await this.db.init();
        console.log(`SQLite database connected: ${dbPath}`);
        await this.createTables();
    } catch (error) {
        console.error('SQLite init failed:', error);
        throw error;
    }
  }

  getConnection(): DatabaseAdapter {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  getDbPath(): string {
      return this.dbPath || this.getPreferredDbPath();
  }

  private async checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
      if (!this.db) return false;
      const result = await this.db.all(`PRAGMA table_info(${tableName})`);
      return result.some((col: any) => col.name === columnName);
  }

  private getCreateTableSql(tableName: string, definitions: string): string {
      return `CREATE TABLE IF NOT EXISTS ${tableName} (${definitions})`;
  }

  private async createIndex(tableName: string, indexName: string, columns: string) {
      if (!this.db) return;
      await this.db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columns})`);
  }

  private async addColumnIfNotExists(tableName: string, columnName: string, columnType: string) {
      if (!this.db) return;
      const exists = await this.checkColumnExists(tableName, columnName);
      if (!exists) {
          // SQLite ALTER TABLE ADD COLUMN is supported
          await this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
      }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // 1. Instruments
    await this.db.exec(this.getCreateTableSql('instruments', `
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        model TEXT,
        factoryNumber TEXT,
        managementNumber TEXT UNIQUE,
        manufacturer TEXT,
        measurementRange TEXT,
        measurementUncertainty TEXT,
        traceabilityMethod TEXT,
        calibrationDate TEXT,
        recalibrationDate TEXT,
        cycle TEXT,
        traceabilityAgency TEXT,
        traceabilityCertificate TEXT,
        department TEXT,
        storageLocation TEXT,
        instrumentStatus TEXT,
        storageStatus TEXT,
        remarks TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        serialNumber TEXT,
        measureRange TEXT,
        uncertainty TEXT,
        nextCalibrationDate TEXT,
        calibrationCycle TEXT,
        calibrationInstitution TEXT,
        location TEXT,
        status TEXT,
        inOutStatus TEXT,
        certificateNumber TEXT,
        attachment TEXT,
        enableDate TEXT,
        groupName TEXT,
        groupModel TEXT,
        groupMeasurementRange TEXT,
        excludeFromAutoGroup INTEGER DEFAULT 0,
        alertLevel TEXT
    `));
    
    // Instrument Columns Migration
    await this.addColumnIfNotExists('instruments', 'currentCapacity', 'REAL');
    await this.addColumnIfNotExists('instruments', 'unit', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'initialCapacity', 'REAL');
    await this.addColumnIfNotExists('instruments', 'groupName', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'groupModel', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'groupMeasurementRange', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'excludeFromAutoGroup', 'INTEGER DEFAULT 0');
    await this.addColumnIfNotExists('instruments', 'alertLevel', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'alertMode', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'certificateNumber', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'attachment', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'enableDate', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'disableReason', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'disabler', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'disableTime', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'metrologicalParameterRange', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'acceptanceDate', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'purchaseDate', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'purchasePerson', 'TEXT');
    await this.addColumnIfNotExists('instruments', 'quantity', 'INTEGER DEFAULT 1');
    await this.addColumnIfNotExists('instruments', 'mergeGroupId', 'TEXT');

    // Instrument Indexes (Created AFTER columns exist)
    await this.createIndex('instruments', 'idx_instruments_management_number', 'managementNumber');
    await this.createIndex('instruments', 'idx_instruments_name', 'name');
    await this.createIndex('instruments', 'idx_instruments_status', 'instrumentStatus');
    await this.createIndex('instruments', 'idx_instruments_type', 'type');
    await this.createIndex('instruments', 'idx_instruments_updated_at', 'updatedAt');
    await this.createIndex('instruments', 'idx_instruments_merge_group_id', 'mergeGroupId');

    // 2. Flow Records
    await this.db.exec(this.getCreateTableSql('flow_records', `
        id TEXT PRIMARY KEY,
        instrumentId TEXT NOT NULL,
        instrumentName TEXT NOT NULL,
        instrumentManagementNumber TEXT,
        action TEXT NOT NULL,
        operator TEXT NOT NULL,
        details TEXT,
        timestamp TEXT NOT NULL,
        usageAmount REAL,
        FOREIGN KEY (instrumentId) REFERENCES instruments(id)
    `));
    await this.createIndex('flow_records', 'idx_flow_records_instrument_id', 'instrumentId');
    await this.createIndex('flow_records', 'idx_flow_records_action', 'action');
    await this.createIndex('flow_records', 'idx_flow_records_timestamp', 'timestamp');
    await this.createIndex('flow_records', 'idx_flow_records_management_number', 'instrumentManagementNumber');
    await this.addColumnIfNotExists('flow_records', 'usageAmount', 'REAL');

    // 3. Reservations
    await this.db.exec(this.getCreateTableSql('reservations', `
        id TEXT PRIMARY KEY,
        instrumentId TEXT NOT NULL,
        instrumentName TEXT NOT NULL,
        userId TEXT NOT NULL,
        startTime TEXT NOT NULL,
        endTime TEXT NOT NULL,
        purpose TEXT,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (instrumentId) REFERENCES instruments(id)
    `));
    await this.createIndex('reservations', 'idx_reservations_instrument_id', 'instrumentId');
    await this.createIndex('reservations', 'idx_reservations_user_id', 'userId');
    await this.createIndex('reservations', 'idx_reservations_start_time', 'startTime');
    await this.createIndex('reservations', 'idx_reservations_end_time', 'endTime');
    await this.createIndex('reservations', 'idx_reservations_status', 'status');

    // 4. System Settings (User Preferences)
    await this.db.exec(this.getCreateTableSql('system_settings', `
        userId TEXT PRIMARY KEY,
        settings TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    `));

    // 7. Global System Settings (App Config)
    await this.db.exec(this.getCreateTableSql('global_system_settings', `
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT
    `));

    // 5. Site Messages
    await this.db.exec(this.getCreateTableSql('site_messages', `
        id TEXT PRIMARY KEY,
        sender_id TEXT,
        receiver_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        status TEXT DEFAULT 'unread',
        created_at TEXT NOT NULL,
        related_id TEXT
    `));
    await this.createIndex('site_messages', 'idx_site_messages_receiver_id', 'receiver_id');
    await this.createIndex('site_messages', 'idx_site_messages_status', 'status');

    // 6. Merge Groups
    await this.db.exec(this.getCreateTableSql('merge_groups', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model TEXT,
        measurementRange TEXT,
        description TEXT,
        type TEXT,
        alertLevel TEXT,
        alertMode TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    `));
    await this.createIndex('merge_groups', 'idx_merge_groups_name', 'name');
    await this.addColumnIfNotExists('merge_groups', 'type', 'TEXT');
    await this.addColumnIfNotExists('merge_groups', 'measurementRange', 'TEXT');
    await this.addColumnIfNotExists('merge_groups', 'alertLevel', 'TEXT');
    await this.addColumnIfNotExists('merge_groups', 'alertMode', 'TEXT');

    // 7. Alerts
    await this.db.exec(this.getCreateTableSql('alerts', `
        id TEXT PRIMARY KEY,
        instrumentId TEXT NOT NULL,
        alertType TEXT NOT NULL,
        generatedTime TEXT NOT NULL,
        processedStatus TEXT,
        processedBy TEXT,
        processedTime TEXT,
        recalibrationDate TEXT,
        remainingDays INTEGER,
        CONSTRAINT UQ_Alerts UNIQUE(instrumentId, alertType, recalibrationDate)
    `));
    await this.createIndex('alerts', 'idx_alerts_instrument', 'instrumentId');
    await this.createIndex('alerts', 'idx_alerts_type', 'alertType');
    await this.createIndex('alerts', 'idx_alerts_status', 'processedStatus');

    // 8. Merge Group Member Backups
    await this.db.exec(this.getCreateTableSql('merge_group_member_backups', `
        id TEXT PRIMARY KEY,
        groupId TEXT NOT NULL,
        instrumentId TEXT NOT NULL,
        originalStatus TEXT,
        backupDate TEXT NOT NULL
    `));
    await this.addColumnIfNotExists('merge_group_member_backups', 'mergeGroupId', 'TEXT');
    await this.addColumnIfNotExists('merge_group_member_backups', 'originalAlertLevel', 'TEXT');
    await this.addColumnIfNotExists('merge_group_member_backups', 'originalAlertMode', 'TEXT');
    await this.addColumnIfNotExists('merge_group_member_backups', 'updatedAt', 'TEXT');
    await this.createIndex('merge_group_member_backups', 'idx_merge_group_member_backups_instrument_group', 'instrumentId, mergeGroupId');

    // 9. Merge Suggestions
    await this.db.exec(this.getCreateTableSql('merge_suggestions', `
        id TEXT PRIMARY KEY,
        groupKey TEXT,
        overlap REAL,
        status TEXT DEFAULT 'pending',
        members_json TEXT,
        thresholds_mode TEXT,
        pointLower REAL,
        pointUpper REAL,
        intervalLower1 REAL,
        intervalUpper1 REAL,
        intervalLower2 REAL,
        intervalUpper2 REAL,
        promptPercent REAL,
        importantPercent REAL,
        emergencyPercent REAL,
        createdAt TEXT
    `));
    await this.createIndex('merge_suggestions', 'idx_merge_suggestions_status', 'status');
    await this.createIndex('merge_suggestions', 'idx_merge_suggestions_group', 'groupKey');

    // 10. Name Usage Settings
    await this.db.exec(this.getCreateTableSql('name_usage_settings', `
        name TEXT PRIMARY KEY,
        status TEXT DEFAULT 'pending',
        usageCategory TEXT,
        thresholdPercent REAL,
        promptPercent REAL,
        importantPercent REAL,
        emergencyPercent REAL,
        updatedAt TEXT
    `));
    await this.createIndex('name_usage_settings', 'idx_name_usage_settings_status', 'status');

    // 11. Schedule Table
    await this.db.exec(this.getCreateTableSql('schedule_table', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT 'default',
        data TEXT NOT NULL,
        updatedBy TEXT,
        updatedAt TEXT NOT NULL
    `));
    await this.createIndex('schedule_table', 'idx_schedule_table_name', 'name');

    // 12. Template Library
    await this.db.exec(this.getCreateTableSql('template_library', `
        id TEXT PRIMARY KEY,
        basis TEXT,
        template_code TEXT NOT NULL,
        template_name TEXT NOT NULL,
        data_region TEXT,
        file_path TEXT,
        version TEXT,
        variable_mapping TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.createIndex('template_library', 'idx_template_library_template_code', 'template_code');
    await this.addColumnIfNotExists('template_library', 'template_code', 'TEXT');
    await this.addColumnIfNotExists('template_library', 'template_name', 'TEXT');
    await this.addColumnIfNotExists('template_library', 'data_region', 'TEXT');
    await this.addColumnIfNotExists('template_library', 'basis', 'TEXT');

    // 13. Instrument Knowledge
    await this.db.exec(this.getCreateTableSql('instrument_knowledge', `
        id TEXT PRIMARY KEY,
        standard_name TEXT NOT NULL,
        model_spec TEXT,
        keywords TEXT,
        [range] TEXT,
        range_min REAL,
        range_max REAL,
        unit TEXT,
        template_id TEXT,
        selection_rule TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES template_library(id)
    `));
    await this.createIndex('instrument_knowledge', 'idx_instrument_knowledge_standard_name', 'standard_name');
    await this.addColumnIfNotExists('instrument_knowledge', 'model_spec', 'TEXT');
    await this.addColumnIfNotExists('instrument_knowledge', 'range', 'TEXT');

    // 14. Master Equipment
    await this.db.exec(this.getCreateTableSql('master_equipment', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        management_number TEXT UNIQUE,
        measurement_min REAL,
        measurement_max REAL,
        unit TEXT,
        accuracy TEXT,
        priority INTEGER DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        status TEXT,
        valid_until TEXT,
        applicable_instrument_name TEXT,
        basis TEXT,
        model_spec TEXT,
        factory_number TEXT,
        measurement_range TEXT,
        uncertainty TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));

    // 15. Sync Log
    await this.db.exec(this.getCreateTableSql('sync_log', `
        id TEXT PRIMARY KEY,
        sync_type TEXT NOT NULL,
        operation_detail TEXT,
        sync_time TEXT NOT NULL,
        is_success INTEGER DEFAULT 1
    `));

    // 16. Standard Basis
    await this.db.exec(this.getCreateTableSql('standard_basis', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT,
        status TEXT,
        publish_date TEXT,
        implement_date TEXT,
        file_path TEXT,
        category TEXT,
        capability_data TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.createIndex('standard_basis', 'idx_standard_basis_code', 'code');
    await this.createIndex('standard_basis', 'idx_standard_basis_name', 'name');
    await this.addColumnIfNotExists('standard_basis', 'capability_data', 'TEXT');

    // 17. Excel Fingerprints (NEW)
    await this.db.exec(this.getCreateTableSql('excel_fingerprints', `
        fingerprint TEXT PRIMARY KEY,
        content TEXT,
        created_at TEXT
    `));

    // 18. Excel Templates (For Plugin)
    await this.db.exec(this.getCreateTableSql('excel_templates', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        fingerprint_hash TEXT,
        rules_json TEXT,
        example_data_json TEXT,
        created_at TEXT,
        updated_at TEXT
    `));
    await this.addColumnIfNotExists('excel_templates', 'updated_at', 'TEXT');
    await this.addColumnIfNotExists('excel_templates', 'generation_config_json', 'TEXT');
    await this.addColumnIfNotExists('excel_templates', 'directory_metadata_json', 'TEXT');
    await this.addColumnIfNotExists('excel_templates', 'status', 'INTEGER DEFAULT 0');
    await this.addColumnIfNotExists('excel_templates', 'deleted_at', 'TEXT');
    await this.createIndex('excel_templates', 'idx_excel_templates_fingerprint', 'fingerprint_hash');

    // 19. Excel Template Versions (For Plugin collaboration)
    await this.db.exec(this.getCreateTableSql('excel_template_versions', `
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        rules_json TEXT NOT NULL,
        change_note TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(template_id) REFERENCES excel_templates(id),
        UNIQUE(template_id, version)
    `));
    await this.createIndex('excel_template_versions', 'idx_excel_template_versions_template_id', 'template_id');
    await this.createIndex('excel_template_versions', 'idx_excel_template_versions_created_at', 'created_at');

    // 20. Excel Generation Records (For Plugin audit trail)
    await this.db.exec(this.getCreateTableSql('excel_generation_records', `
        id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL,
        template_version INTEGER,
        workbook_name TEXT,
        file_path TEXT,
        generated_by TEXT,
        parameter_snapshot_json TEXT,
        generated_at TEXT NOT NULL,
        FOREIGN KEY(template_id) REFERENCES excel_templates(id)
    `));
    await this.createIndex('excel_generation_records', 'idx_excel_generation_records_template_id', 'template_id');
    await this.createIndex('excel_generation_records', 'idx_excel_generation_records_generated_at', 'generated_at');
    // 26. Length Shadow Linkage Rules
    await this.db.exec(this.getCreateTableSql('length_shadow_linkage_rules', `
        id TEXT PRIMARY KEY,
        instrument_name TEXT NOT NULL,
        department TEXT,
        model_spec TEXT,
        change_content TEXT NOT NULL,
        target_cell TEXT NOT NULL,
        template_code TEXT,
        procedure_code TEXT,
        special_rule_text TEXT,
        parsed_change_content_json TEXT,
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.addColumnIfNotExists('length_shadow_linkage_rules', 'department', 'TEXT');
    await this.addColumnIfNotExists('length_shadow_linkage_rules', 'special_rule_text', 'TEXT');
    await this.addColumnIfNotExists('length_shadow_linkage_rules', 'parsed_change_content_json', 'TEXT');
    await this.addColumnIfNotExists('length_shadow_linkage_rules', 'enabled', 'INTEGER DEFAULT 1');
    await this.addColumnIfNotExists('length_shadow_linkage_rules', 'sort_order', 'INTEGER DEFAULT 0');
    await this.createIndex('length_shadow_linkage_rules', 'idx_length_shadow_department', 'department');
    await this.createIndex('length_shadow_linkage_rules', 'idx_length_shadow_name', 'instrument_name');
    await this.createIndex('length_shadow_linkage_rules', 'idx_length_shadow_template_code', 'template_code');
    await this.createIndex('length_shadow_linkage_rules', 'idx_length_shadow_procedure_code', 'procedure_code');
    await this.createIndex('length_shadow_linkage_rules', 'idx_length_shadow_updated_at', 'updated_at');

    // 27. Shadow Knife linkage tasks
    await this.db.exec(this.getCreateTableSql('shadow_knife_tasks', `
        id TEXT PRIMARY KEY,
        department TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        order_no TEXT NOT NULL,
        start_quantity REAL,
        end_quantity REAL,
        status TEXT NOT NULL DEFAULT 'pending',
        current_running_count INTEGER NOT NULL DEFAULT 0,
        completed_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        skipped_count INTEGER NOT NULL DEFAULT 0,
        log_status TEXT NOT NULL DEFAULT 'pending_development',
        log_note TEXT,
        created_by TEXT,
        updated_by TEXT,
        last_synced_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.addColumnIfNotExists('shadow_knife_tasks', 'department', 'TEXT NOT NULL DEFAULT ""');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'customer_name', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'order_no', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'start_quantity', 'REAL');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'end_quantity', 'REAL');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'status', 'TEXT NOT NULL DEFAULT "pending"');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'certificate_no', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'current_running_count', 'INTEGER NOT NULL DEFAULT 0');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'completed_count', 'INTEGER NOT NULL DEFAULT 0');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'failed_count', 'INTEGER NOT NULL DEFAULT 0');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'skipped_count', 'INTEGER NOT NULL DEFAULT 0');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'log_status', 'TEXT NOT NULL DEFAULT "pending_development"');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'log_note', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'created_by', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'updated_by', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'last_synced_at', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'created_at', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_tasks', 'updated_at', 'TEXT');
    await this.createIndex('shadow_knife_tasks', 'idx_shadow_knife_tasks_department', 'department');
    await this.createIndex('shadow_knife_tasks', 'idx_shadow_knife_tasks_status', 'status');
    await this.createIndex('shadow_knife_tasks', 'idx_shadow_knife_tasks_updated_at', 'updated_at');

    await this.db.exec(this.getCreateTableSql('shadow_knife_task_details', `
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        order_no TEXT NOT NULL,
        certificate_no TEXT,
        current_index INTEGER NOT NULL DEFAULT 0,
        item_status TEXT NOT NULL DEFAULT 'processing',
        task_status TEXT NOT NULL DEFAULT 'in_progress',
        created_by TEXT,
        updated_by TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES shadow_knife_tasks(id)
    `));
    await this.addColumnIfNotExists('shadow_knife_task_details', 'task_id', 'TEXT NOT NULL DEFAULT ""');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'order_no', 'TEXT NOT NULL DEFAULT ""');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'certificate_no', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'current_index', 'INTEGER NOT NULL DEFAULT 0');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'item_status', 'TEXT NOT NULL DEFAULT "processing"');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'task_status', 'TEXT NOT NULL DEFAULT "in_progress"');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'created_by', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'updated_by', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'created_at', 'TEXT');
    await this.addColumnIfNotExists('shadow_knife_task_details', 'updated_at', 'TEXT');
    await this.createIndex('shadow_knife_task_details', 'idx_shadow_knife_task_details_task_id', 'task_id');
    await this.createIndex('shadow_knife_task_details', 'idx_shadow_knife_task_details_order_no', 'order_no');

    // Remove legacy smart scheduling data and schema after the module removal.
    await this.db.exec('DROP TABLE IF EXISTS field_task_items');
    await this.db.exec('DROP TABLE IF EXISTS field_tasks');
    await this.db.exec('DROP TABLE IF EXISTS instrument_time_rules');
    await this.db.exec('DROP TABLE IF EXISTS instrument_mappings');
    await this.db.exec('DROP TABLE IF EXISTS standard_instruments');

    // 28. One-click transfer
    await this.db.exec(this.getCreateTableSql('transfer_upload_templates', `
        id TEXT PRIMARY KEY,
        type_name TEXT NOT NULL UNIQUE,
        template_name TEXT,
        file_path TEXT,
        file_name TEXT,
        match_column TEXT,
        header_row INTEGER NOT NULL DEFAULT 1,
        data_start_row INTEGER NOT NULL DEFAULT 2,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.db.exec(this.getCreateTableSql('transfer_import_templates', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        match_column TEXT,
        header_row INTEGER NOT NULL DEFAULT 1,
        data_start_row INTEGER NOT NULL DEFAULT 2,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.db.exec(this.getCreateTableSql('transfer_quote_templates', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        header_row INTEGER NOT NULL DEFAULT 1,
        data_start_row INTEGER NOT NULL DEFAULT 2,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.addColumnIfNotExists('transfer_import_templates', 'match_column', 'TEXT');
    await this.db.exec(this.getCreateTableSql('transfer_target_templates', `
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        match_keyword TEXT NOT NULL UNIQUE,
        file_path TEXT NOT NULL,
        header_row INTEGER NOT NULL DEFAULT 1,
        data_start_row INTEGER NOT NULL DEFAULT 2,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    `));
    await this.addColumnIfNotExists('transfer_upload_templates', 'file_path', 'TEXT');
    await this.addColumnIfNotExists('transfer_upload_templates', 'file_name', 'TEXT');
    await this.addColumnIfNotExists('transfer_upload_templates', 'match_column', 'TEXT');
    await this.addColumnIfNotExists('transfer_upload_templates', 'template_name', 'TEXT');
    await this.db.exec(this.getCreateTableSql('transfer_mappings', `
        id TEXT PRIMARY KEY,
        target_template_id TEXT NOT NULL,
        upload_template_id TEXT,
        source_column TEXT,
        target_column TEXT,
        forced_key TEXT,
        target_cell TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(target_template_id) REFERENCES transfer_target_templates(id) ON DELETE CASCADE
    `));
    await this.addColumnIfNotExists('transfer_mappings', 'upload_template_id', 'TEXT');
    await this.db.exec(this.getCreateTableSql('transfer_import_mappings', `
        id TEXT PRIMARY KEY,
        import_template_id TEXT NOT NULL,
        order_template_id TEXT NOT NULL,
        source_column TEXT,
        target_column TEXT,
        forced_key TEXT,
        target_cell TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(import_template_id) REFERENCES transfer_import_templates(id) ON DELETE CASCADE,
        FOREIGN KEY(order_template_id) REFERENCES transfer_upload_templates(id) ON DELETE CASCADE
    `));
    await this.db.exec(this.getCreateTableSql('transfer_quote_mappings', `
        id TEXT PRIMARY KEY,
        quote_template_id TEXT NOT NULL,
        import_template_id TEXT NOT NULL,
        source_column TEXT,
        target_column TEXT,
        forced_key TEXT,
        target_cell TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(quote_template_id) REFERENCES transfer_quote_templates(id) ON DELETE CASCADE,
        FOREIGN KEY(import_template_id) REFERENCES transfer_import_templates(id) ON DELETE CASCADE
    `));
    await this.db.exec(this.getCreateTableSql('transfer_quote_order_mappings', `
        id TEXT PRIMARY KEY,
        quote_template_id TEXT NOT NULL,
        order_template_id TEXT NOT NULL,
        source_column TEXT,
        target_column TEXT,
        forced_key TEXT,
        target_cell TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(quote_template_id) REFERENCES transfer_quote_templates(id) ON DELETE CASCADE,
        FOREIGN KEY(order_template_id) REFERENCES transfer_upload_templates(id) ON DELETE CASCADE
    `));
    await this.db.exec(this.getCreateTableSql('transfer_tasks', `
        id TEXT PRIMARY KEY,
        user_name TEXT,
        certificate_unit TEXT NOT NULL,
        certificate_address TEXT NOT NULL,
        calibration_date TEXT NOT NULL,
        source_filename TEXT NOT NULL,
        business_type TEXT NOT NULL,
        match_column TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'processing',
        total_rows INTEGER NOT NULL DEFAULT 0,
        matched_rows INTEGER NOT NULL DEFAULT 0,
        skipped_rows INTEGER NOT NULL DEFAULT 0,
        folder_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        completed_at TEXT
    `));
    await this.db.exec(this.getCreateTableSql('transfer_files', `
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        target_template_id TEXT,
        template_name TEXT NOT NULL,
        match_keyword TEXT NOT NULL,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        row_count INTEGER NOT NULL DEFAULT 0,
        file_size INTEGER NOT NULL DEFAULT 0,
        preview_data_json TEXT,
        downloaded INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY(task_id) REFERENCES transfer_tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(target_template_id) REFERENCES transfer_target_templates(id) ON DELETE SET NULL
    `));
    await this.addColumnIfNotExists('transfer_files', 'preview_data_json', 'TEXT');
    await this.db.exec(this.getCreateTableSql('transfer_settings', `
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT NOT NULL
    `));
    await this.createIndex('transfer_files', 'idx_transfer_files_task_id', 'task_id');
    await this.createIndex('transfer_tasks', 'idx_transfer_tasks_status', 'status');
    await this.createIndex('transfer_import_mappings', 'idx_transfer_import_mappings_pair', 'import_template_id,order_template_id');
    await this.createIndex('transfer_quote_mappings', 'idx_transfer_quote_mappings_pair', 'quote_template_id,import_template_id');
    await this.createIndex('transfer_quote_order_mappings', 'idx_transfer_quote_order_mappings_pair', 'quote_template_id,order_template_id');
  }
}

export default new DatabaseConfig();
