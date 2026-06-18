export interface CraEntry {
  id?: number;
  taxYear: number;
  person: string;
  slipType: string;
  issuer: string;
  amount: number;
  taxDeducted?: number;
  notes?: string;
}

export const SLIP_TYPES: { value: string; label: string; color: string }[] = [
  { value: 'T4',       label: 'T4 – Employment',      color: '#1976d2' },
  { value: 'T4A',      label: 'T4A – Other Income',   color: '#7b1fa2' },
  { value: 'T4E',      label: 'T4E – EI Benefits',    color: '#00838f' },
  { value: 'T5',       label: 'T5 – Investment',       color: '#f57c00' },
  { value: 'T3',       label: 'T3 – Trust',            color: '#e65100' },
  { value: 'RRSP',     label: 'RRSP Contribution',     color: '#2e7d32' },
  { value: 'FHSA',     label: 'FHSA Contribution',     color: '#558b2f' },
  { value: 'DONATION', label: 'Charitable Donation',   color: '#c62828' },
  { value: 'MEDICAL',  label: 'Medical Expense',       color: '#ad1457' },
  { value: 'TUITION',  label: 'Tuition / Education',   color: '#4527a0' },
  { value: 'WFH',      label: 'Work From Home',        color: '#0277bd' },
  { value: 'OTHER',    label: 'Other',                 color: '#546e7a' },
];

export function slipInfo(value: string) {
  return SLIP_TYPES.find(s => s.value === value) ?? SLIP_TYPES[SLIP_TYPES.length - 1];
}
