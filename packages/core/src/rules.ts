import type { ComplianceRule } from './types.js';

export const rules: ComplianceRule[] = [
  {
    id: 'eu-ai-act-human-oversight-high-risk',
    framework: 'eu_ai_act',
    title: 'High-risk systems require documented human oversight',
    description: 'AI systems used in employment, education, critical infrastructure, biometric or safety-critical contexts should have effective human oversight.',
    severity: 'critical',
    controlRefs: ['EU AI Act: high-risk obligations', 'ISO 42001: AI lifecycle controls'],
    evidenceRequired: ['human-oversight-policy', 'operator-training-records', 'escalation-procedure'],
    test: s => !(s.employmentOrEducationUse || s.criticalInfrastructureUse || s.biometricUse || s.safetyCritical) || s.humanOversight,
    remediation: 'Define accountable human review, override, escalation and monitoring procedures before production use.'
  },
  {
    id: 'gdpr-dpia-automated-decisioning',
    framework: 'gdpr',
    title: 'DPIA required for high-risk personal-data processing',
    description: 'Systems processing personal data with automated decisions or special category data should have a documented DPIA.',
    severity: 'critical',
    controlRefs: ['GDPR Art. 35', 'UK ICO DPIA guidance'],
    evidenceRequired: ['dpia', 'lawful-basis-assessment', 'data-flow-map'],
    test: s => !(s.personalData && (s.automatedDecisions || s.specialCategoryData)) || Boolean(s.evidence.dpia),
    remediation: 'Complete and approve a DPIA including necessity, proportionality, risks, mitigations and residual risk owner.'
  },
  {
    id: 'gdpr-data-minimisation',
    framework: 'gdpr',
    title: 'Data minimisation must be evidenced',
    description: 'Personal data use should be limited to what is necessary for the stated AI system purpose.',
    severity: 'high',
    controlRefs: ['GDPR Art. 5(1)(c)'],
    evidenceRequired: ['data-minimisation-review', 'retention-schedule'],
    test: s => !s.personalData || Boolean(s.evidence['data-minimisation-review']),
    remediation: 'Document data categories, necessity, retention and deletion controls.'
  },
  {
    id: 'iso-42001-ai-policy',
    framework: 'iso_42001',
    title: 'AI policy and accountability must exist',
    description: 'An AI management system needs policy, ownership, objectives and clear accountability.',
    severity: 'high',
    controlRefs: ['ISO/IEC 42001: clauses 5-6'],
    evidenceRequired: ['ai-policy', 'ai-governance-roles', 'risk-appetite'],
    test: s => Boolean(s.owner && s.evidence['ai-policy']),
    remediation: 'Approve an AI policy, appoint system owner and define governance responsibilities.'
  },
  {
    id: 'iso-27001-access-control',
    framework: 'iso_27001',
    title: 'Access control evidence is required',
    description: 'AI systems and their datasets should have role-based access controls and periodic access review.',
    severity: 'high',
    controlRefs: ['ISO/IEC 27001 Annex A access control'],
    evidenceRequired: ['rbac-matrix', 'access-review', 'audit-logging'],
    test: s => Boolean(s.evidence['rbac-matrix'] && s.evidence['audit-logging']),
    remediation: 'Implement RBAC, audit logs and access review cadence for AI assets and data stores.'
  },
  {
    id: 'uk-ai-transparency',
    framework: 'uk_ai_guidance',
    title: 'Users should be told when they are interacting with AI',
    description: 'Public-facing AI should include appropriate transparency notices and escalation routes.',
    severity: 'medium',
    controlRefs: ['UK AI regulation principles: transparency and explainability'],
    evidenceRequired: ['ai-user-notice', 'explainability-summary', 'appeal-route'],
    test: s => !s.publicFacing || Boolean(s.evidence['ai-user-notice']),
    remediation: 'Add clear AI usage notices, explanations and routes to contact a human.'
  }
];
