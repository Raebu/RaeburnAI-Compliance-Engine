export default function Page() {
  const frameworks = ['EU AI Act', 'GDPR', 'ISO 42001', 'ISO 27001', 'UK AI guidance'];
  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">RaeburnAI Governance</div>
          <h1>AI compliance that is actually operational.</h1>
          <p>Register AI systems, classify risk, map obligations, collect evidence and generate audit-ready remediation.</p>
        </div>
        <div className="panel">
          <h2>Compliance dashboard</h2>
          <p>Risk classification, evidence gaps, controls and remediation in one place.</p>
          <div className="bar"><div className="fill" /></div>
          <p>Sample readiness score: 78/100</p>
          {frameworks.map(item => <span className="tag" key={item}>{item}</span>)}
        </div>
      </section>
      <section className="grid">
        <div className="card"><div className="metric">5</div><p>Frameworks mapped into one control language.</p></div>
        <div className="card"><div className="metric">6</div><p>Policy-as-code checks in the starter rule pack.</p></div>
        <div className="card"><div className="metric">API</div><p>Open integration layer for enterprise governance workflows.</p></div>
      </section>
    </main>
  );
}
