import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import dbConfig from '../config/dbConfig';
import excelTemplateService from '../services/excelTemplateService';

const execPromise = util.promisify(exec);

export class TemplateController {
  async getExtractedTemplate(req: Request, res: Response) {
    try {
      const filenameRaw = String(req.query.filename || '').trim();
      if (!filenameRaw) {
        return res.status(400).json({ success: false, error: 'filename is required' });
      }

      const safeName = path.basename(filenameRaw);
      const baseName = path.parse(safeName).name;
      const templatesDir = path.resolve(__dirname, '../../../templates_to_process');
      const extractedPath = path.join(templatesDir, `${baseName}.extracted.json`);

      if (!fs.existsSync(extractedPath)) {
        return res.status(404).json({ success: false, error: 'extracted json not found', filename: safeName });
      }

      const raw = fs.readFileSync(extractedPath, 'utf-8');
      const data = JSON.parse(raw);
      return res.json({ success: true, filename: safeName, data });
    } catch (error) {
      console.error('Extracted template read error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async analyzeTemplate(req: Request, res: Response) {
    try {
      const { base64, filename } = req.body;
      if (!base64) {
        return res.status(400).json({ success: false, error: 'base64 data is required' });
      }

      const tempDir = path.resolve(__dirname, '../../../templates_to_process');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempId = `temp_${Date.now()}`;
      const tempFile = path.join(tempDir, `${tempId}.xlsx`);

      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(tempFile, buffer);

      const scriptPath = path.resolve(__dirname, '../../scripts/extract_header_positions.py');
      const cmd = `py "${scriptPath}" "${tempFile}"`;

      try {
        await execPromise(cmd);
      } catch (execError) {
        console.error('Python execution error:', execError);
      }

      const extractedPath = path.join(tempDir, `${tempId}.extracted.json`);
      if (!fs.existsSync(extractedPath)) {
        return res.status(500).json({ success: false, error: 'Failed to extract template structure' });
      }

      const raw = fs.readFileSync(extractedPath, 'utf-8');
      const data = JSON.parse(raw);

      if (filename) {
        const safeName = path.basename(filename);
        const baseName = path.parse(safeName).name;
        const persistentPath = path.join(tempDir, `${baseName}.extracted.json`);
        try {
          fs.writeFileSync(persistentPath, raw, 'utf-8');
        } catch (saveError) {
          console.error('Failed to save persistent extracted file:', saveError);
        }
      }

      try {
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        if (fs.existsSync(extractedPath)) {
          fs.unlinkSync(extractedPath);
        }
        const csvPath = path.join(tempDir, `${tempId}.extracted.csv`);
        if (fs.existsSync(csvPath)) {
          fs.unlinkSync(csvPath);
        }
      } catch (cleanupError) {
        console.error('Failed to clean up temp files:', cleanupError);
      }

      return res.json({ success: true, data });
    } catch (error) {
      console.error('Template analyze error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async matchTemplate(req: Request, res: Response) {
    try {
      const { fingerprint } = req.body;
      const templates = await excelTemplateService.matchTemplatesByFingerprint(fingerprint);

      if (templates.length > 0) {
        return res.json({ success: true, found: true, templates });
      }

      return res.json({ success: true, found: false });
    } catch (error) {
      console.error('Template match error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async saveTemplate(req: Request, res: Response) {
    try {
      const {
        name: requestName, templateName, fingerprint, rules, exampleData, changeNote, createdBy: requestCreatedBy,
        generationConfiguration, directoryMetadata, templateId, createNew,
      } = req.body;
      const name = String(requestName || templateName || '').trim();
      if (!name || !fingerprint || !rules) {
        return res.status(400).json({ success: false, error: 'name, fingerprint and rules are required' });
      }
      const result = await excelTemplateService.saveTemplate({
        id: createNew ? undefined : templateId,
        name,
        fingerprint,
        rules,
        exampleData,
        changeNote,
        createdBy: (req as any).user?.username || requestCreatedBy,
        generationConfiguration,
        directoryMetadata,
      });
      const template = await excelTemplateService.getTemplateById(result.id);

      return res.json({ success: true, data: buildTemplateResponse(template), ...result });
    } catch (error) {
      console.error('Template save error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async updateTemplate(req: Request, res: Response) {
    try {
      const {
        id, name: requestName, templateName, rules, fingerprint, changeNote, createdBy: requestCreatedBy,
        generationConfiguration, directoryMetadata,
      } = req.body;
      const result = await excelTemplateService.updateTemplate({
        id,
        name: String(requestName || templateName || '').trim(),
        rules,
        fingerprint,
        changeNote,
        createdBy: (req as any).user?.username || requestCreatedBy,
        generationConfiguration,
        directoryMetadata,
      });
      const template = await excelTemplateService.getTemplateById(result.id);

      return res.json({ success: true, data: buildTemplateResponse(template), ...result });
    } catch (error) {
      console.error('Template update error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async listTemplates(_req: Request, res: Response) {
    try {
      const list = await excelTemplateService.listTemplates();
      return res.json({ success: true, data: list });
    } catch (error) {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async getTemplateVersions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const versions = await excelTemplateService.getTemplateVersions(id);
      return res.json({ success: true, data: versions });
    } catch (error) {
      console.error('Template versions error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async createGenerationRecord(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { templateVersion, workbookName, filePath, generatedBy: requestGeneratedBy, parameterSnapshot } = req.body;
      const result = await excelTemplateService.createGenerationRecord({
        templateId: id,
        templateVersion,
        workbookName,
        filePath,
        generatedBy: (req as any).user?.username || requestGeneratedBy,
        parameterSnapshot,
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('Template generation record error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.body;
      const db = dbConfig.getConnection();
      await db.run(`DELETE FROM excel_templates WHERE id = ?`, [id]);
      return res.json({ success: true });
    } catch (error) {
      console.error('Template delete error:', error);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

function buildTemplateResponse(template: any) {
  if (!template) return null;
  return {
    id: template.id,
    template_id: template.id,
    name: template.name,
    template_name: template.name,
    version: Number(template.version || 1),
    status: Number(template.status || 0),
    updated_at: template.updated_at || template.created_at || null,
    deleted_at: template.deleted_at || '',
    fingerprint_hash: template.fingerprint_hash || '{}',
    rules_json: template.rules_json || '[]',
    generation_config_json: template.generation_config_json || '',
    directory_metadata: template.directory_metadata_json || '',
  };
}

export default new TemplateController();
