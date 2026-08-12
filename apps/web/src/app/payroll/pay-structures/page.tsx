'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '../../../lib/auth-client';
import { apiFetch } from '../../../lib/api';
import { DashboardLayout } from '../../../components/dashboard-layout';
import { Button, Card, Badge, Modal, PageSkeleton, EmptyState, PageHeader } from '../../../components/ui';
import {
  FileStack, Plus, Pencil, Trash2, Users, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Calculator, Eye, EyeOff, AlertTriangle, Copy, UserPlus,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────

interface PayHead {
  id: string;
  name: string;
  code: string;
  type: 'EARNING' | 'DEDUCTION';
  category: 'FIXED' | 'VARIABLE' | 'STATUTORY';
  isStatutory: boolean;
  statutoryType: string | null;
  isActive: boolean;
}

interface PayComponent {
  id: string;
  headId: string;
  formula: string | null;
  formulaDisplay: string | null;
  isVariable: boolean;
  showOnPayslip: boolean;
  hasArrear: boolean;
  affectsPf: boolean;
  affectsEsi: boolean;
  affectsPt: boolean;
  affectsGratuity: boolean;
  roundingMode: string;
  roundingPrecision: number;
  sortOrder: number;
  head: { name: string; code: string; type: string; category?: string };
}

interface PayStructureTemplate {
  id: string;
  name: string;
  description: string | null;
  effectiveFrom: string | null;
  isDefault: boolean;
  isActive: boolean;
  components: PayComponent[];
  _count?: { assignments: number };
  assignments?: Assignment[];
}

interface Assignment {
  id: string;
  employeeId: string;
  ctcMonthly: number | null;
  ctcAnnual: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  employee: { firstName: string; lastName: string; employeeCode: string; designation: string | null };
  template?: { name: string };
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  designation: string | null;
}

interface ComponentRow {
  headId: string;
  formula: string;
  formulaDisplay: string;
  isVariable: boolean;
  showOnPayslip: boolean;
  hasArrear: boolean;
  affectsPf: boolean;
  affectsEsi: boolean;
  affectsPt: boolean;
  affectsGratuity: boolean;
  roundingMode: string;
  roundingPrecision: number;
  sortOrder: number;
  _formulaError?: string | null;
}

interface PreviewLine {
  headCode: string;
  headName: string;
  headType: string;
  rate: number;
  totalAmount: number;
  showOnPayslip: boolean;
}

interface PreviewResult {
  lines: PreviewLine[];
  summary: {
    totalEarnings: number;
    totalDeductions: number;
    netPay: number;
    pfBase: number;
    esiBase: number;
    ptBase: number;
    gratuityBase: number;
  };
  templateName?: string;
}

// ── Constants ────────────────────────────────────────

const inputCls = 'w-full border border-surface-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none';
const selectCls = inputCls;
const chipCls = (on: boolean) =>
  `px-2 py-0.5 rounded text-xs font-medium cursor-pointer select-none transition-colors ${
    on ? 'bg-brand-100 text-brand-700 border border-brand-300' : 'bg-surface-100 text-content-tertiary border border-surface-200'
  }`;
const fmt = (v: number) => `₹${Math.round(v).toLocaleString('en-IN')}`;

const EMPTY_COMPONENT: ComponentRow = {
  headId: '',
  formula: '',
  formulaDisplay: '',
  isVariable: false,
  showOnPayslip: true,
  hasArrear: false,
  affectsPf: false,
  affectsEsi: false,
  affectsPt: false,
  affectsGratuity: false,
  roundingMode: 'NORMAL',
  roundingPrecision: 0,
  sortOrder: 0,
  _formulaError: null,
};

// ── Main Page ────────────────────────────────────────

export default function PayStructuresPage() {
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<PayStructureTemplate[]>([]);
  const [heads, setHeads] = useState<PayHead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Template create/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PayStructureTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    effectiveFrom: '',
    isDefault: false,
  });
  const [components, setComponents] = useState<ComponentRow[]>([]);

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState('');
  const [assignForm, setAssignForm] = useState({
    employeeId: '',
    ctcMonthly: '',
    effectiveFrom: new Date().toISOString().split('T')[0],
  });
  const [assigning, setAssigning] = useState(false);

  // Preview modal
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplateId, setPreviewTemplateId] = useState('');
  const [previewCtc, setPreviewCtc] = useState('50000');
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // ── Fetchers ──

  const fetchAll = useCallback(async () => {
    try {
      const [t, h, empRes] = await Promise.all([
        apiFetch<PayStructureTemplate[]>('/pay-structure/templates'),
        apiFetch<PayHead[]>('/pay-structure/heads'),
        apiFetch<{ data: Employee[] }>('/employees?limit=500'),
      ]);
      setTemplates(t);
      setHeads(h);
      setEmployees(empRes.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Template CRUD ──

  const openCreate = () => {
    setEditingTemplate(null);
    setTemplateForm({ name: '', description: '', effectiveFrom: '', isDefault: false });
    setComponents([{ ...EMPTY_COMPONENT, sortOrder: 0 }]);
    setShowModal(true);
    setError('');
  };

  const openEdit = (tmpl: PayStructureTemplate) => {
    setEditingTemplate(tmpl);
    setTemplateForm({
      name: tmpl.name,
      description: tmpl.description || '',
      effectiveFrom: tmpl.effectiveFrom ? tmpl.effectiveFrom.split('T')[0] : '',
      isDefault: tmpl.isDefault,
    });
    setComponents(
      tmpl.components.map((c) => ({
        headId: c.headId,
        formula: c.formula || '',
        formulaDisplay: c.formulaDisplay || '',
        isVariable: c.isVariable,
        showOnPayslip: c.showOnPayslip,
        hasArrear: c.hasArrear,
        affectsPf: c.affectsPf,
        affectsEsi: c.affectsEsi,
        affectsPt: c.affectsPt,
        affectsGratuity: c.affectsGratuity,
        roundingMode: c.roundingMode,
        roundingPrecision: c.roundingPrecision,
        sortOrder: c.sortOrder,
        _formulaError: null,
      })),
    );
    setShowModal(true);
    setError('');
  };

  const addComponent = () => {
    setComponents((prev) => [...prev, { ...EMPTY_COMPONENT, sortOrder: prev.length }]);
  };

  const removeComponent = (idx: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sortOrder: i })));
  };

  const updateComponent = (idx: number, patch: Partial<ComponentRow>) => {
    setComponents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const moveComponent = (idx: number, dir: -1 | 1) => {
    setComponents((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr.map((c, i) => ({ ...c, sortOrder: i }));
    });
  };

  const validateFormula = async (idx: number) => {
    const comp = components[idx];
    if (!comp.formula.trim()) {
      updateComponent(idx, { _formulaError: null });
      return;
    }
    try {
      const allCodes = heads.filter((h) => h.isActive).map((h) => h.code);
      const result = await apiFetch<{ valid: boolean; error?: string }>('/pay-structure/validate-formula', {
        method: 'POST',
        body: JSON.stringify({ formula: comp.formula, availableHeadCodes: allCodes }),
      });
      updateComponent(idx, { _formulaError: result.valid ? null : (result.error || 'Invalid formula') });
    } catch (err: any) {
      updateComponent(idx, { _formulaError: err.message });
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validComponents = components.filter((c) => c.headId);
    if (validComponents.length === 0) {
      setError('Add at least one pay component');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...templateForm,
        effectiveFrom: templateForm.effectiveFrom || undefined,
        components: validComponents.map(({ _formulaError, ...rest }) => ({
          ...rest,
          formula: rest.formula || undefined,
          formulaDisplay: rest.formulaDisplay || undefined,
        })),
      };

      if (editingTemplate) {
        await apiFetch(`/pay-structure/templates/${editingTemplate.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/pay-structure/templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowModal(false);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this pay structure? This cannot be undone.')) return;
    try {
      await apiFetch(`/pay-structure/templates/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const duplicateTemplate = async (tmpl: PayStructureTemplate) => {
    try {
      await apiFetch('/pay-structure/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: `${tmpl.name} (Copy)`,
          description: tmpl.description,
          components: tmpl.components.map((c) => ({
            headId: c.headId,
            formula: c.formula,
            formulaDisplay: c.formulaDisplay,
            isVariable: c.isVariable,
            showOnPayslip: c.showOnPayslip,
            hasArrear: c.hasArrear,
            affectsPf: c.affectsPf,
            affectsEsi: c.affectsEsi,
            affectsPt: c.affectsPt,
            affectsGratuity: c.affectsGratuity,
            roundingMode: c.roundingMode,
            roundingPrecision: c.roundingPrecision,
            sortOrder: c.sortOrder,
          })),
        }),
      });
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ── Assignment ──

  const openAssign = (templateId: string) => {
    setAssignTemplateId(templateId);
    setAssignForm({ employeeId: '', ctcMonthly: '', effectiveFrom: new Date().toISOString().split('T')[0] });
    setShowAssign(true);
    setError('');
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssigning(true);
    setError('');
    try {
      await apiFetch('/pay-structure/assignments', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: assignForm.employeeId,
          templateId: assignTemplateId,
          ctcMonthly: assignForm.ctcMonthly ? +assignForm.ctcMonthly : undefined,
          ctcAnnual: assignForm.ctcMonthly ? +assignForm.ctcMonthly * 12 : undefined,
          effectiveFrom: assignForm.effectiveFrom,
        }),
      });
      setShowAssign(false);
      fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  };

  // ── Preview ──

  const openPreview = (templateId: string) => {
    setPreviewTemplateId(templateId);
    setPreviewCtc('50000');
    setPreviewResult(null);
    setShowPreview(true);
  };

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const result = await apiFetch<PreviewResult>('/pay-structure/preview', {
        method: 'POST',
        body: JSON.stringify({ templateId: previewTemplateId, ctcMonthly: +previewCtc }),
      });
      setPreviewResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  // ── Helpers ──

  const activeHeads = heads.filter((h) => h.isActive);
  const getHeadName = (headId: string) => heads.find((h) => h.id === headId)?.name || '(unknown)';
  const getHeadCode = (headId: string) => heads.find((h) => h.id === headId)?.code || '??';

  // ── Render ──

  if (loading) return <DashboardLayout><div className="p-4 md:p-6"><PageSkeleton /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Pay Structures"
        description="Create reusable pay structure templates with formula-based calculations"
      />

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> New Pay Structure</Button>
        {heads.length === 0 && (
          <Button variant="secondary" onClick={async () => {
            try {
              await apiFetch('/pay-structure/seed-india', { method: 'POST' });
              fetchAll();
            } catch (err: any) {
              setError(err.message);
            }
          }}>
            Seed India Defaults
          </Button>
        )}
      </div>

      {templates.length === 0 ? (
        <EmptyState
          icon={<FileStack />}
          title="No pay structures yet"
          description="Create a pay structure template to define how salary components are calculated from CTC."
        />
      ) : (
        <div className="space-y-4">
          {templates.map((tmpl) => {
            const isExpanded = expandedId === tmpl.id;
            const earnings = tmpl.components.filter((c) => c.head.type === 'EARNING');
            const deductions = tmpl.components.filter((c) => c.head.type === 'DEDUCTION');

            return (
              <Card key={tmpl.id} className="overflow-hidden">
                {/* Header */}
                <div
                  className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-surface-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : tmpl.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-content-primary">{tmpl.name}</h3>
                      {tmpl.isDefault && <Badge variant="brand">Default</Badge>}
                      {!tmpl.isActive && <Badge variant="danger">Inactive</Badge>}
                      <Badge variant="info">{tmpl.components.length} components</Badge>
                      {(tmpl._count?.assignments ?? 0) > 0 && (
                        <Badge variant="success">
                          <Users className="w-3 h-3 mr-1 inline" />
                          {tmpl._count?.assignments} assigned
                        </Badge>
                      )}
                    </div>
                    {tmpl.description && (
                      <p className="text-sm text-content-tertiary mt-0.5 truncate">{tmpl.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openPreview(tmpl.id); }}
                      className="p-2 text-content-tertiary hover:text-brand-600 rounded-lg hover:bg-brand-50"
                      title="Preview Calculation"
                    >
                      <Calculator className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openAssign(tmpl.id); }}
                      className="p-2 text-content-tertiary hover:text-green-600 rounded-lg hover:bg-green-50"
                      title="Assign to Employee"
                    >
                      <UserPlus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateTemplate(tmpl); }}
                      className="p-2 text-content-tertiary hover:text-blue-600 rounded-lg hover:bg-blue-50"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(tmpl); }}
                      className="p-2 text-content-tertiary hover:text-blue-600 rounded-lg hover:bg-blue-50"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(tmpl.id); }}
                      className="p-2 text-content-tertiary hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-5 h-5 text-content-tertiary" /> : <ChevronDown className="w-5 h-5 text-content-tertiary" />}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t">
                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x">
                      {/* Earnings */}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold text-green-700 mb-3">Earnings ({earnings.length})</h4>
                        <div className="space-y-2">
                          {earnings.map((c) => (
                            <ComponentCard key={c.id} component={c} />
                          ))}
                          {earnings.length === 0 && (
                            <p className="text-sm text-content-tertiary italic">No earning components</p>
                          )}
                        </div>
                      </div>

                      {/* Deductions */}
                      <div className="p-4">
                        <h4 className="text-sm font-semibold text-red-700 mb-3">Deductions ({deductions.length})</h4>
                        <div className="space-y-2">
                          {deductions.map((c) => (
                            <ComponentCard key={c.id} component={c} />
                          ))}
                          {deductions.length === 0 && (
                            <p className="text-sm text-content-tertiary italic">No deduction components</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════════ Create / Edit Template Modal ══════════ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editingTemplate ? `Edit: ${editingTemplate.name}` : 'New Pay Structure'}
        size="xl"
      >
        <form onSubmit={handleSaveTemplate}>
          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input
                type="text"
                required
                className={inputCls}
                value={templateForm.name}
                onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Standard India CTC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Effective From</label>
              <input
                type="date"
                className={inputCls}
                value={templateForm.effectiveFrom}
                onChange={(e) => setTemplateForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              className={inputCls}
              value={templateForm.description}
              onChange={(e) => setTemplateForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Optional description of this pay structure"
            />
          </div>
          <label className="flex items-center gap-2 text-sm mb-4">
            <input
              type="checkbox"
              checked={templateForm.isDefault}
              onChange={(e) => setTemplateForm((p) => ({ ...p, isDefault: e.target.checked }))}
            />
            Set as default pay structure
          </label>

          {/* Components */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Pay Components</h3>
              <Button type="button" variant="secondary" size="sm" onClick={addComponent}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Component
              </Button>
            </div>

            {components.length === 0 ? (
              <p className="text-sm text-content-tertiary text-center py-4">No components added. Click &quot;Add Component&quot; to start.</p>
            ) : (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
                {components.map((comp, idx) => (
                  <div key={idx} className="border rounded-lg p-3 bg-surface-50 relative group">
                    {/* Row 1: Head + Formula */}
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-1 flex flex-col items-center gap-0.5 pt-1">
                        <span className="text-xs text-content-tertiary font-mono">#{idx + 1}</span>
                        <button type="button" onClick={() => moveComponent(idx, -1)} className="text-content-tertiary hover:text-content-primary" disabled={idx === 0}>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => moveComponent(idx, 1)} className="text-content-tertiary hover:text-content-primary" disabled={idx === components.length - 1}>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="col-span-4">
                        <label className="block text-xs font-medium text-content-secondary mb-1">Pay Head *</label>
                        <select
                          className={selectCls}
                          value={comp.headId}
                          onChange={(e) => updateComponent(idx, { headId: e.target.value })}
                          required
                        >
                          <option value="">Select head...</option>
                          <optgroup label="Earnings">
                            {activeHeads.filter((h) => h.type === 'EARNING').map((h) => (
                              <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                            ))}
                          </optgroup>
                          <optgroup label="Deductions">
                            {activeHeads.filter((h) => h.type === 'DEDUCTION').map((h) => (
                              <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      <div className="col-span-6">
                        <label className="block text-xs font-medium text-content-secondary mb-1">
                          Formula
                          {comp._formulaError && (
                            <span className="text-red-500 ml-1">— {comp._formulaError}</span>
                          )}
                          {comp._formulaError === null && comp.formula.trim() && (
                            <span className="text-green-600 ml-1">✓ valid</span>
                          )}
                        </label>
                        <input
                          type="text"
                          className={`${inputCls} font-mono text-xs ${comp._formulaError ? 'border-red-400 bg-red-50' : ''}`}
                          value={comp.formula}
                          onChange={(e) => updateComponent(idx, { formula: e.target.value, _formulaError: undefined })}
                          onBlur={() => validateFormula(idx)}
                          placeholder="e.g. CTC * 0.5  or  BASIC_DA[Derived] * 0.5  or  IF(GROSS > 21000, 0, GROSS * 0.0075)"
                        />
                        <p className="text-[10px] text-content-tertiary mt-0.5">
                          Use head codes (e.g. BASIC_DA), [Derived] for calculated amounts, functions: IF, MIN, MAX, ROUND. Variables: CTC, TDC, PDC
                        </p>
                      </div>

                      <div className="col-span-1 flex items-start justify-end pt-5">
                        <button
                          type="button"
                          onClick={() => removeComponent(idx)}
                          className="p-1 text-content-tertiary hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Row 2: Flags */}
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-[8.33%]">
                      <span className={chipCls(comp.showOnPayslip)} onClick={() => updateComponent(idx, { showOnPayslip: !comp.showOnPayslip })}>
                        {comp.showOnPayslip ? <Eye className="w-3 h-3 inline mr-0.5" /> : <EyeOff className="w-3 h-3 inline mr-0.5" />}
                        Payslip
                      </span>
                      <span className={chipCls(comp.isVariable)} onClick={() => updateComponent(idx, { isVariable: !comp.isVariable })}>
                        Variable
                      </span>
                      <span className={chipCls(comp.hasArrear)} onClick={() => updateComponent(idx, { hasArrear: !comp.hasArrear })}>
                        Arrear
                      </span>
                      <span className={chipCls(comp.affectsPf)} onClick={() => updateComponent(idx, { affectsPf: !comp.affectsPf })}>
                        PF
                      </span>
                      <span className={chipCls(comp.affectsEsi)} onClick={() => updateComponent(idx, { affectsEsi: !comp.affectsEsi })}>
                        ESI
                      </span>
                      <span className={chipCls(comp.affectsPt)} onClick={() => updateComponent(idx, { affectsPt: !comp.affectsPt })}>
                        PT
                      </span>
                      <span className={chipCls(comp.affectsGratuity)} onClick={() => updateComponent(idx, { affectsGratuity: !comp.affectsGratuity })}>
                        Gratuity
                      </span>
                      <select
                        className="text-xs border rounded px-1.5 py-0.5 text-content-secondary"
                        value={comp.roundingMode}
                        onChange={(e) => updateComponent(idx, { roundingMode: e.target.value })}
                      >
                        <option value="NORMAL">Round</option>
                        <option value="FLOOR">Floor</option>
                        <option value="CEILING">Ceiling</option>
                        <option value="NONE">No rounding</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="text-red-600 text-sm mt-3">{error}</div>}

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" loading={saving} disabled={saving}>
              {editingTemplate ? 'Update Structure' : 'Create Structure'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════ Assign Modal ══════════ */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Pay Structure to Employee">
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Employee *</label>
            <select
              className={selectCls}
              required
              value={assignForm.employeeId}
              onChange={(e) => setAssignForm((p) => ({ ...p, employeeId: e.target.value }))}
            >
              <option value="">Select employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Monthly CTC (₹)</label>
              <input
                type="number"
                className={inputCls}
                value={assignForm.ctcMonthly}
                onChange={(e) => setAssignForm((p) => ({ ...p, ctcMonthly: e.target.value }))}
                placeholder="e.g. 50000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Effective From *</label>
              <input
                type="date"
                className={inputCls}
                required
                value={assignForm.effectiveFrom}
                onChange={(e) => setAssignForm((p) => ({ ...p, effectiveFrom: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-xs text-content-tertiary">
            If this employee already has an active assignment, it will be automatically deactivated.
          </p>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button type="submit" loading={assigning} disabled={!assignForm.employeeId}>
              Assign
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══════════ Preview Modal ══════════ */}
      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Preview Salary Calculation" size="lg">
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Monthly CTC (₹)</label>
              <input
                type="number"
                className={inputCls}
                value={previewCtc}
                onChange={(e) => setPreviewCtc(e.target.value)}
                placeholder="Enter monthly CTC"
              />
            </div>
            <Button onClick={runPreview} loading={previewing} disabled={!previewCtc}>
              <Calculator className="w-4 h-4 mr-1" /> Calculate
            </Button>
          </div>

          {previewResult && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Component</th>
                    <th className="px-3 py-2 text-left font-medium text-content-secondary">Code</th>
                    <th className="px-3 py-2 text-right font-medium text-content-secondary">Rate / Input</th>
                    <th className="px-3 py-2 text-right font-medium text-content-secondary">Amount</th>
                    <th className="px-3 py-2 text-center font-medium text-content-secondary">Payslip</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {/* Earnings */}
                  {previewResult.lines.filter((l) => l.headType === 'EARNING').map((line) => (
                    <tr key={line.headCode} className={`${!line.showOnPayslip ? 'opacity-50 bg-surface-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{line.headName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-content-tertiary">{line.headCode}</td>
                      <td className="px-3 py-2 text-right">{fmt(line.rate)}</td>
                      <td className="px-3 py-2 text-right font-medium text-green-700">{fmt(line.totalAmount)}</td>
                      <td className="px-3 py-2 text-center">
                        {line.showOnPayslip
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                          : <XCircle className="w-4 h-4 text-content-tertiary inline" />
                        }
                      </td>
                    </tr>
                  ))}

                  {/* Subtotal Earnings */}
                  <tr className="bg-green-50 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>Total Earnings</td>
                    <td className="px-3 py-2 text-right text-green-700">{fmt(previewResult.summary.totalEarnings)}</td>
                    <td />
                  </tr>

                  {/* Deductions */}
                  {previewResult.lines.filter((l) => l.headType === 'DEDUCTION').map((line) => (
                    <tr key={line.headCode} className={`${!line.showOnPayslip ? 'opacity-50 bg-surface-50' : ''}`}>
                      <td className="px-3 py-2 font-medium">{line.headName}</td>
                      <td className="px-3 py-2 font-mono text-xs text-content-tertiary">{line.headCode}</td>
                      <td className="px-3 py-2 text-right">{fmt(line.rate)}</td>
                      <td className="px-3 py-2 text-right font-medium text-red-700">-{fmt(Math.abs(line.totalAmount))}</td>
                      <td className="px-3 py-2 text-center">
                        {line.showOnPayslip
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 inline" />
                          : <XCircle className="w-4 h-4 text-content-tertiary inline" />
                        }
                      </td>
                    </tr>
                  ))}

                  {/* Subtotal Deductions */}
                  <tr className="bg-red-50 font-semibold">
                    <td className="px-3 py-2" colSpan={3}>Total Deductions</td>
                    <td className="px-3 py-2 text-right text-red-700">-{fmt(previewResult.summary.totalDeductions)}</td>
                    <td />
                  </tr>

                  {/* Net Pay */}
                  <tr className="bg-brand-50 font-bold text-base">
                    <td className="px-3 py-3" colSpan={3}>Net Pay</td>
                    <td className="px-3 py-3 text-right text-brand-700">{fmt(previewResult.summary.netPay)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
      </div>
    </DashboardLayout>
  );
}

// ── Sub-Component: Read-only component card ──────────

function ComponentCard({ component: c }: { component: PayComponent }) {
  return (
    <div className={`rounded-lg border p-2.5 text-sm ${!c.showOnPayslip ? 'opacity-60 bg-surface-50' : 'bg-white'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{c.head.name}</span>
          <span className="text-xs font-mono text-content-tertiary">{c.head.code}</span>
          {c.head.category && (
            <Badge variant={c.head.category === 'STATUTORY' ? 'brand' : c.head.category === 'VARIABLE' ? 'warning' : 'info'} className="text-[10px]">
              {c.head.category}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!c.showOnPayslip && (
            <span className="text-[10px] text-content-tertiary flex items-center gap-0.5">
              <EyeOff className="w-3 h-3" /> Hidden
            </span>
          )}
          {c.isVariable && <Badge variant="warning" className="text-[10px]">Variable</Badge>}
        </div>
      </div>
      {c.formula && (
        <div className="mt-1 px-2 py-1 bg-surface-100 rounded font-mono text-xs text-content-secondary break-all">
          {c.formula}
        </div>
      )}
      <div className="flex gap-1.5 mt-1.5 flex-wrap">
        {c.affectsPf && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">PF</span>}
        {c.affectsEsi && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">ESI</span>}
        {c.affectsPt && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">PT</span>}
        {c.affectsGratuity && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">Gratuity</span>}
        {c.hasArrear && <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded">Arrear</span>}
        {c.roundingMode !== 'NORMAL' && (
          <span className="text-[10px] px-1.5 py-0.5 bg-surface-100 text-content-tertiary rounded">{c.roundingMode}</span>
        )}
      </div>
    </div>
  );
}
