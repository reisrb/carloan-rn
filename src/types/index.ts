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
  tankLiters: number | null;
}

export type MaintenanceStatus = 'pending' | 'done';

export interface MaintenanceItem {
  name: string;
  value: number;
}

export interface Maintenance {
  id: string;
  financingId: string;
  status: MaintenanceStatus;
  description: string;
  items: MaintenanceItem[];
  totalValue: number;
  itemValue: number;
  laborValue: number;
  serviceDate: number | null;
  kmAtService: number | null;
  itemPurchaseDate: number | null;
  dueKm: number | null;
  dueDate: number | null;
  receiptPaths: string[];
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

export interface FixedExpense {
  id: string;
  financingId: string;
  name: string;
  value: number;
  createdAt: number;
}

export interface FuelFillup {
  id: string;
  financingId: string;
  local: string | null;
  flag: string | null;
  fuelType: string | null;
  date: number | null;
  totalValue: number;
  liters: number | null;
  km: number | null;
  kmDriven: number | null;
  createdAt: number;
}

// Consumption belongs to the PREVIOUS station. When you fuel at a station you
// record the km driven since the last fill and the litres put in now:
//   consumption(previous station) = kmDriven(this fill) / litres(this fill)
// A station only gets a value once the NEXT fill records those numbers, so the
// most recent fill has no consumption yet.
function fuelSortedAsc(fillups: FuelFillup[]): FuelFillup[] {
  return [...fillups].sort((a, b) => (a.date ?? a.createdAt) - (b.date ?? b.createdAt));
}

/** Stats keyed by the PREVIOUS fill's id, from THIS fill's km + litres + spend. */
export function fuelStatsByFill(fillups: FuelFillup[]): Record<string, { kmL: number; costPerKm: number }> {
  const s = fuelSortedAsc(fillups);
  const map: Record<string, { kmL: number; costPerKm: number }> = {};
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1], cur = s[i];
    const km = cur.kmDriven ?? 0;
    if (km <= 0) continue;
    const kmL = (cur.liters ?? 0) > 0 ? km / (cur.liters as number) : 0;
    const costPerKm = cur.totalValue > 0 ? cur.totalValue / km : 0;
    if (kmL > 0 || costPerKm > 0) map[prev.id] = { kmL, costPerKm };
  }
  return map;
}

/** Best consumption (km/L) grouped by the PREVIOUS station's attribute. Best first. */
function fuelConsumptionByKey(fillups: FuelFillup[], keyOf: (f: FuelFillup) => string): { key: string; kmL: number }[] {
  const s = fuelSortedAsc(fillups);
  const agg: Record<string, { km: number; liters: number }> = {};
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1], cur = s[i];
    if ((cur.kmDriven ?? 0) > 0 && (cur.liters ?? 0) > 0) {
      const key = keyOf(prev);
      const a = agg[key] ?? { km: 0, liters: 0 };
      a.km += cur.kmDriven as number;
      a.liters += cur.liters as number;
      agg[key] = a;
    }
  }
  return Object.entries(agg)
    .map(([key, v]) => ({ key, kmL: v.liters > 0 ? v.km / v.liters : 0 }))
    .filter(x => x.kmL > 0)
    .sort((a, b) => b.kmL - a.kmL);
}

/** Best consumption per brand (bandeira). Best first. */
export function fuelConsumptionByFlag(fillups: FuelFillup[]): { flag: string; kmL: number }[] {
  return fuelConsumptionByKey(fillups, f => (f.flag && f.flag.trim()) || 'Sem bandeira').map(x => ({ flag: x.key, kmL: x.kmL }));
}

/** Best consumption per fuel type. Best first. */
export function fuelConsumptionByType(fillups: FuelFillup[]): { type: string; kmL: number }[] {
  return fuelConsumptionByKey(fillups, f => (f.fuelType && f.fuelType.trim()) || 'Sem tipo').map(x => ({ type: x.key, kmL: x.kmL }));
}

/** Average consumption (km/L): total distance / total litres over measured fills. */
export function avgConsumption(fillups: FuelFillup[]): number | null {
  const s = fuelSortedAsc(fillups);
  let km = 0, liters = 0;
  for (let i = 1; i < s.length; i++) {
    const cur = s[i];
    if ((cur.kmDriven ?? 0) > 0 && (cur.liters ?? 0) > 0) {
      km += cur.kmDriven as number;
      liters += cur.liters as number;
    }
  }
  return liters > 0 ? km / liters : null;
}

/** Average cost per km: total paid / total distance over measured fills. */
export function avgCostPerKm(fillups: FuelFillup[]): number | null {
  const s = fuelSortedAsc(fillups);
  let cost = 0, km = 0;
  for (let i = 1; i < s.length; i++) {
    const cur = s[i];
    if ((cur.kmDriven ?? 0) > 0 && cur.totalValue > 0) {
      cost += cur.totalValue;
      km += cur.kmDriven as number;
    }
  }
  return km > 0 ? cost / km : null;
}

/** Estimated range on a full tank (km) = avg consumption × tank size. */
export function tankRange(car: Financing, fillups: FuelFillup[]): number | null {
  const c = avgConsumption(fillups);
  if (c == null || !car.tankLiters) return null;
  return c * car.tankLiters;
}

/** Fuel spend grouped by month, most recent first. */
export function fuelByMonth(fillups: FuelFillup[]): { key: string; label: string; total: number }[] {
  const map = new Map<string, { label: string; total: number }>();
  for (const f of fillups) {
    const d = new Date(f.date ?? f.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const cur = map.get(key) ?? { label, total: 0 };
    cur.total += f.totalValue;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, v]) => ({ key, label: v.label, total: v.total }));
}

/** Average fuel spend per month (across months that have fill-ups). */
export function fuelMonthlyAverage(fillups: FuelFillup[]): number {
  const months = fuelByMonth(fillups);
  if (!months.length) return 0;
  return months.reduce((s, m) => s + m.total, 0) / months.length;
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
