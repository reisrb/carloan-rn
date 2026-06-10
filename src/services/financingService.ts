import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { Financing, FinancingWithInstallments, Installment, Payment } from '../types';
import { loanCalculator } from './loanCalculator';

type FinancingRow = {
  id: string;
  car_name: string;
  license_plate: string;
  bank: string;
  vehicle_value: number;
  down_payment: number;
  monthly_rate: number;
  total_installments: number;
  first_due_date: number;
  created_at: number;
  car_photo_path: string | null;
};

type InstallmentDbRow = {
  id: string;
  financing_id: string;
  number: number;
  due_date: number;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  remaining_balance: number;
};

type PaymentRow = {
  id: string;
  installment_id: string;
  paid_date: number;
  paid_amount: number;
  note: string | null;
  receipt_paths: string[];
};

const toFinancing = (r: FinancingRow): Financing => ({
  id: r.id,
  carName: r.car_name,
  licensePlate: r.license_plate,
  bank: r.bank,
  vehicleValue: r.vehicle_value,
  downPayment: r.down_payment,
  monthlyRate: r.monthly_rate,
  totalInstallments: r.total_installments,
  firstDueDate: r.first_due_date,
  createdAt: r.created_at,
  carPhotoPath: r.car_photo_path,
});

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  installmentId: r.installment_id,
  paidDate: r.paid_date,
  paidAmount: r.paid_amount,
  note: r.note,
  receiptPaths: r.receipt_paths ?? [],
});

const toInstallment = (r: InstallmentDbRow, payment: Payment | null): Installment => ({
  id: r.id,
  financingId: r.financing_id,
  number: r.number,
  dueDate: r.due_date,
  amount: r.amount,
  principalAmount: r.principal_amount,
  interestAmount: r.interest_amount,
  remainingBalance: r.remaining_balance,
  payment,
});

function flatInstallments(amount: number, count: number, firstDueDate: number): InstallmentRowLite[] {
  return Array.from({ length: count }, (_, idx) => {
    const k = idx + 1;
    const d = new Date(firstDueDate);
    d.setMonth(d.getMonth() + k - 1);
    return {
      number: k,
      dueDate: d.getTime(),
      amount,
      principalAmount: amount,
      interestAmount: 0,
      remainingBalance: amount * (count - k),
    };
  });
}

type InstallmentRowLite = ReturnType<typeof loanCalculator.priceTable>[number];

async function insertInBatches(table: string, rows: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 50));
    if (error) throw new Error(error.message);
  }
}

export const financingService = {
  async getAll(): Promise<Financing[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('financings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as FinancingRow[]).map(toFinancing);
  },

  async getInstallments(financingId: string): Promise<Installment[]> {
    const { data: instRows, error } = await supabase
      .from('installments')
      .select('*')
      .eq('financing_id', financingId)
      .order('number', { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (instRows as InstallmentDbRow[]).map(r => r.id);
    let payments: PaymentRow[] = [];
    if (ids.length > 0) {
      const { data: payRows, error: payError } = await supabase
        .from('payments')
        .select('*')
        .in('installment_id', ids);
      if (payError) throw new Error(payError.message);
      payments = payRows as PaymentRow[];
    }

    const byInstallment = new Map(payments.map(p => [p.installment_id, toPayment(p)]));
    return (instRows as InstallmentDbRow[]).map(r => toInstallment(r, byInstallment.get(r.id) ?? null));
  },

  async getById(id: string): Promise<FinancingWithInstallments | null> {
    const { data, error } = await supabase
      .from('financings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const installments = await financingService.getInstallments(id);
    return { ...toFinancing(data as FinancingRow), installments };
  },

  async create(params: {
    carName: string;
    licensePlate: string;
    bank: string;
    vehicleValue: number;
    downPayment: number;
    monthlyRate: number;
    installmentAmount: number;
    totalInstallments: number;
    firstDueDate: number;
    alreadyPaidCount: number;
    carPhotoPath: string | null;
  }): Promise<string> {
    const userId = await getUserId();
    const id = generateId();

    const financed = params.vehicleValue > 0
      ? Math.max(0, params.vehicleValue - params.downPayment)
      : params.installmentAmount * params.totalInstallments;

    const rows = params.installmentAmount > 0 && params.monthlyRate === 0
      ? flatInstallments(params.installmentAmount, params.totalInstallments, params.firstDueDate)
      : loanCalculator.priceTable(financed, params.monthlyRate, params.totalInstallments, params.firstDueDate);

    const { error } = await supabase.from('financings').insert({
      id,
      user_id: userId,
      car_name: params.carName,
      license_plate: params.licensePlate,
      bank: params.bank,
      vehicle_value: params.vehicleValue,
      down_payment: params.downPayment,
      monthly_rate: params.monthlyRate,
      total_installments: params.totalInstallments,
      first_due_date: params.firstDueDate,
      created_at: Date.now(),
      car_photo_path: params.carPhotoPath,
    });
    if (error) throw new Error(error.message);

    const instRows = rows.map(r => ({
      id: generateId(),
      user_id: userId,
      financing_id: id,
      number: r.number,
      due_date: r.dueDate,
      amount: r.amount,
      principal_amount: r.principalAmount,
      interest_amount: r.interestAmount,
      remaining_balance: r.remainingBalance,
    }));
    await insertInBatches('installments', instRows);

    if (params.alreadyPaidCount > 0) {
      const prepaid = instRows
        .filter(r => r.number <= params.alreadyPaidCount)
        .map(r => ({
          id: generateId(),
          user_id: userId,
          installment_id: r.id,
          paid_date: r.due_date,
          paid_amount: r.amount,
          note: null,
          receipt_paths: [],
        }));
      await insertInBatches('payments', prepaid);
    }

    return id;
  },

  async update(id: string, params: {
    carName: string;
    licensePlate: string;
    bank: string;
    vehicleValue: number;
    installmentAmount: number;
    carPhotoPath: string | null;
  }): Promise<void> {
    const { error } = await supabase
      .from('financings')
      .update({
        car_name: params.carName,
        license_plate: params.licensePlate,
        bank: params.bank,
        vehicle_value: params.vehicleValue,
        car_photo_path: params.carPhotoPath,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);

    const installments = await financingService.getInstallments(id);
    const unpaidIds = installments.filter(i => !i.payment).map(i => i.id);
    if (unpaidIds.length > 0) {
      const { error: updError } = await supabase
        .from('installments')
        .update({ amount: params.installmentAmount })
        .in('id', unpaidIds);
      if (updError) throw new Error(updError.message);
    }
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('financings').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
