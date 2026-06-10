export type InstallmentStatus = 'paid' | 'open' | 'overdue';

export interface Financing {
  id: string;
  carName: string;
  licensePlate: string;
  bank: string;
  vehicleValue: number;
  downPayment: number;
  monthlyRate: number;
  totalInstallments: number;
  firstDueDate: number;
  createdAt: number;
  carPhotoPath: string | null;
}

export interface Payment {
  id: string;
  installmentId: string;
  paidDate: number;
  paidAmount: number;
  note: string | null;
  receiptPaths: string[];
}

export interface Installment {
  id: string;
  financingId: string;
  number: number;
  dueDate: number;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  remainingBalance: number;
  payment: Payment | null;
}

export interface FinancingWithInstallments extends Financing {
  installments: Installment[];
}

export function financedAmount(f: Financing): number {
  return f.vehicleValue - f.downPayment;
}

export function installmentStatus(i: Installment): InstallmentStatus {
  if (i.payment) return 'paid';
  return i.dueDate < Date.now() ? 'overdue' : 'open';
}

export function isCurrentMonth(i: Installment): boolean {
  const due = new Date(i.dueDate);
  const now = new Date();
  return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth();
}

export interface InstallmentRow {
  number: number;
  dueDate: number;
  amount: number;
  principalAmount: number;
  interestAmount: number;
  remainingBalance: number;
}

export interface ReduceTermResult {
  newInstallmentCount: number;
  newPayoffDate: number | null;
  totalInterestSaved: number;
}

export interface ReduceMonthlyResult {
  newMonthlyPayment: number;
  savingPerMonth: number;
  totalInterestSaved: number;
}

export interface AmortizationResult {
  selectedNumbers: number[];
  principalToPayNow: number;
  interestSkipped: number;
  reduceTerm: ReduceTermResult;
  reduceMonthly: ReduceMonthlyResult;
}

export interface FinancingShare {
  id: string;
  financingId: string;
  sharedBy: string;
  sharedWithEmail: string;
  sharedWithId: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}
