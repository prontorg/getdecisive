export function IntervalsConnectPanel({ error }: { error?: string }) {
  return (
    <section className="card">
      <div className="kicker">Mandatory in v1</div>
      <h2>Connect Intervals with guided credentials</h2>
      <p>
        Intervals is mandatory in v1. Paste your athlete ID and current credential payload here to start
        a real sync for this account.
      </p>
      {error ? <p className="notice error">{error}</p> : null}
      <form className="form-grid" action="/api/onboarding/intervals-connect" method="post" style={{ marginTop: 16 }}>
        <label>
          <span>Athlete ID</span>
          <input name="athleteId" type="text" placeholder="17634020" required />
        </label>
        <label>
          <span>Credential / API key</span>
          <textarea name="credentialPayload" placeholder="Paste guided credential info here" rows={5} required />
        </label>
        <label>
          <span>Connection label</span>
          <input name="connectionLabel" type="text" placeholder="Primary Intervals account" defaultValue="Primary account" />
        </label>
        <div className="button-row">
          <button type="submit">Validate and start sync</button>
        </div>
      </form>
    </section>
  );
}
