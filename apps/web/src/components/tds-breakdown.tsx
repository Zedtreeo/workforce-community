'use client';
const fmt = (v: any) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

export function TdsBreakdown({ data }: { data: any }) {
  if (!data) return null;
  const Row = ({ l, v, cls = '' }: { l: any; v: any; cls?: string }) => (
    <div className={`flex justify-between ${cls}`}><span>{l}</span><span>{v}</span></div>
  );

  if (data.method === 'FLAT') {
    return (
      <div className="mt-4 pt-3 border-t border-surface-200">
        <h4 className="text-xs font-semibold text-content-tertiary uppercase mb-2">TDS Computation</h4>
        <div className="space-y-1 text-sm bg-surface-50 rounded-lg p-3">
          <Row l={`Consultant TDS (Sec ${data.section})`} v={`${data.ratePct}%`} />
          <Row l="Monthly gross" v={fmt(data.monthlyGross)} />
          <Row l="Monthly TDS" v={fmt(data.monthlyTds)} cls="font-semibold border-t border-surface-200 pt-1 mt-1" />
        </div>
      </div>
    );
  }

  if (data.note) {
    return <div className="mt-4 pt-3 border-t border-surface-200 text-xs text-content-tertiary">TDS: {data.note}</div>;
  }

  return (
    <div className="mt-4 pt-3 border-t border-surface-200">
      <h4 className="text-xs font-semibold text-content-tertiary uppercase mb-2">TDS Computation — {data.regime} Regime, FY {data.financialYear}</h4>
      <div className="space-y-1 text-sm bg-surface-50 rounded-lg p-3">
        <Row l="Annual gross" v={fmt(data.annualGross)} />
        <Row l="Standard deduction" v={`− ${fmt(data.standardDeduction)}`} />
        {(data.deductions || []).map((d: any, i: number) => (
          <div key={i} className="flex justify-between text-content-secondary"><span className="pl-3">{d.label}</span><span>− {fmt(d.amount)}</span></div>
        ))}
        {data.deductions?.length > 0 && <Row l="Total declared deductions" v={`− ${fmt(data.totalDeductions)}`} cls="text-content-secondary" />}
        <Row l="Taxable income" v={fmt(data.taxableIncome)} cls="font-medium border-t border-surface-200 pt-1 mt-1" />
        {data.slabs?.length > 0 && (
          <table className="w-full text-xs mt-2">
            <thead><tr className="text-content-tertiary"><th className="text-left font-normal">Slab</th><th className="text-right font-normal">Rate</th><th className="text-right font-normal">Tax</th></tr></thead>
            <tbody>{data.slabs.map((s: any, i: number) => (
              <tr key={i}><td>{fmt(s.from)} – {s.to == null ? '∞' : fmt(s.to)}</td><td className="text-right">{s.rate}%</td><td className="text-right">{fmt(s.tax)}</td></tr>
            ))}</tbody>
          </table>
        )}
        <Row l="Tax on slabs" v={fmt(data.grossTax)} cls="pt-1" />
        {data.rebateApplied && <div className="flex justify-between text-success-dark"><span>§87A rebate (taxable ≤ {fmt(data.rebateMaxTaxable)})</span><span>− {fmt(data.grossTax)}</span></div>}
        <Row l={`Health & education cess (${data.cessPct}%)`} v={`+ ${fmt(data.cessAmount)}`} />
        <Row l="Annual tax" v={fmt(data.annualTax)} cls="font-medium border-t border-surface-200 pt-1 mt-1" />
        <Row l="Monthly TDS" v={fmt(data.monthlyTds)} cls="font-semibold text-danger-dark" />
      </div>
    </div>
  );
}
