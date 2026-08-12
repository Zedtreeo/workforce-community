// apps/api/src/modules/letters/services/carbone.adapter.ts
//
// Thin client for the Carbone Cloud Render API (carbone.io).
//
// Carbone uses `{d.path.to.field}` syntax inside .docx templates. We upload
// the template once (returns a hash), then render with JSON data, then
// download the rendered file in the requested format (DOCX or PDF).
//
// Workflow:
//   1. addTemplate(buffer)        →  templateId (cached for reuse)
//   2. render(templateId, data, convertTo)   →  renderId
//   3. getRendered(renderId)      →  Buffer
//
// Env: CARBONE_API_KEY (production JWT)
// Docs: https://carbone.io/api-reference.html#cloud-api
//
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import FormData = require('form-data');

@Injectable()
export class CarboneAdapter {
  private readonly logger = new Logger(CarboneAdapter.name);
  private readonly client: AxiosInstance;
  readonly enabled: boolean;
  // In-memory cache: contentHash → carboneTemplateId
  private templateCache = new Map<string, string>();

  constructor() {
    const apiKey = process.env.CARBONE_API_KEY;
    this.enabled = Boolean(apiKey);
    this.client = axios.create({
      baseURL: 'https://api.carbone.io',
      timeout: 30_000,
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        'carbone-version': '4',
      },
    });
    if (!this.enabled) {
      this.logger.warn('CARBONE_API_KEY not set — PDF conversion disabled');
    } else {
      this.logger.log('Carbone Cloud API enabled');
    }
  }

  /** Upload template (idempotent via content hash). */
  async addTemplate(buffer: Buffer): Promise<string> {
    if (!this.enabled) throw new ServiceUnavailableException('Carbone not configured');

    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (this.templateCache.has(contentHash)) return this.templateCache.get(contentHash)!;

    const fd = new FormData();
    fd.append('template', buffer, { filename: `${contentHash}.docx` });

    const res = await this.client.post('/template', fd, {
      headers: { ...fd.getHeaders() },
      maxContentLength: 20 * 1024 * 1024,
      maxBodyLength: 20 * 1024 * 1024,
    });
    if (!res.data?.success) throw new Error(`Carbone addTemplate failed: ${JSON.stringify(res.data)}`);
    const templateId = res.data.data.templateId;
    this.templateCache.set(contentHash, templateId);
    this.logger.debug(`Carbone template uploaded: ${templateId}`);
    return templateId;
  }

  /** Render a template with data; returns a Buffer of the chosen format. */
  async render(
    templateBuffer: Buffer,
    data: Record<string, any>,
    convertTo: 'docx' | 'pdf' = 'docx',
  ): Promise<{ buffer: Buffer; reportName: string }> {
    if (!this.enabled) throw new ServiceUnavailableException('Carbone not configured');
    const templateId = await this.addTemplate(templateBuffer);

    const renderRes = await this.client.post(`/render/${templateId}`, {
      data,
      convertTo,
      // reportName can include date placeholders; we set explicit name on save
    });
    if (!renderRes.data?.success) throw new Error(`Carbone render failed: ${JSON.stringify(renderRes.data)}`);
    const renderId = renderRes.data.data.renderId;
    const reportName = renderRes.data.data.inputFileExtension ?? convertTo;

    const fileRes = await this.client.get(`/render/${renderId}`, {
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    return { buffer: Buffer.from(fileRes.data), reportName };
  }
}
