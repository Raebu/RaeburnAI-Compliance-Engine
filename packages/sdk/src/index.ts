export interface ComplianceClientOptions {
  baseUrl: string;
  token?: string;
}

export class ComplianceClient {
  private readonly baseUrl: string;
  private readonly token?: string;

  constructor(options: ComplianceClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.token = options.token;
  }

  async health() {
    return this.request('/health');
  }

  async listRules() {
    return this.request('/v1/rules');
  }

  async runAssessment(system: unknown) {
    return this.request('/v1/assessments/run', {
      method: 'POST',
      body: JSON.stringify(system)
    });
  }

  private async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (this.token) headers.set('authorization', `Bearer ${this.token}`);

    const response = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(`Compliance API request failed: ${response.status}`);
    }
    return response.json();
  }
}
