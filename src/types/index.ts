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
  // Car fields (the financing row IS the car)
  brand: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  currentKm: number;
  monthlyCost: number;
}

export type MaintenanceStatus = 'pending' | 'done';

export interface Maintenance {
  id: string;
  financingId: string;
  status: MaintenanceStatus;
  description: string;
  totalValue: number;
  itemValue: number;
  laborValue: number;
  serviceDate: number | null;
  kmAtService: number | null;
  itemPurchaseDate: number | null;
  dueKm: number | null;
  dueDate: number | null;
  createdAt: number;
}

export interface Accessory {
  id: string;
  financingId: string;
  name: string;
  value: number;
  date: number | null;
  createdAt: number;
}

export interface WishlistItem {
  id: string;
  financingId: string;
  name: string;
  estimatedValue: number;
  priority: number;
  notes: string | null;
  createdAt: number;
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

// ============================================================
// Car hub helpers
// ============================================================
export function hasFinancing(f: Financing): boolean {
  return f.totalInstallments > 0;
}

/** The unpaid installment due this month, or the next unpaid one. */
export function currentMonthInstallment(installments: Installment[]): Installment | undefined {
  const unpaid = installments.filter(i => !i.payment);
  return unpaid.find(isCurrentMonth) ?? unpaid[0];
}

/** Recurring monthly spend: this month's installment + fixed monthly cost. */
export function monthlyTotal(car: Financing, installments: Installment[]): number {
  const inst = installments.filter(i => !i.payment).find(isCurrentMonth);
  return (inst?.amount ?? 0) + car.monthlyCost;
}

/** Everything already spent: down payment + paid installments + accessories + done maintenance. */
export function accumulatedTotal(
  car: Financing,
  installments: Installment[],
  accessories: Accessory[],
  maintenances: Maintenance[],
): number {
  const paidInstallments = installments.reduce((s, i) => s + (i.payment?.paidAmount ?? 0), 0);
  const acc = accessories.reduce((s, a) => s + a.value, 0);
  const maint = maintenances
    .filter(m => m.status === 'done')
    .reduce((s, m) => s + m.totalValue, 0);
  return car.downPayment + paidInstallments + acc + maint;
}
