import { AmortizationResult, InstallmentRow, ReduceMonthlyResult, ReduceTermResult } from '../types';

function addMonths(timestamp: number, months: number): number {
  const d = new Date(timestamp);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export const loanCalculator = {
  /** Price table (Sistema Francês). When monthlyRate = 0, uses equal installments (no interest). */
  priceTable(
    financedAmount: number,
    monthlyRate: number,
    totalInstallments: number,
    firstDueDate: number,
  ): InstallmentRow[] {
    if (totalInstallments <= 0 || financedAmount <= 0) return [];
    const i = monthlyRate;
    const n = totalInstallments;
    const pmt = i > 0
      ? financedAmount * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
      : financedAmount / n;

    const rows: InstallmentRow[] = [];
    let balance = financedAmount;

    for (let k = 1; k <= totalInstallments; k++) {
      const interest = i > 0 ? balance * i : 0;
      const principal = pmt - interest;
      balance -= principal;

      rows.push({
        number: k,
        dueDate: addMonths(firstDueDate, k - 1),
        amount: pmt,
        principalAmount: principal,
        interestAmount: interest,
        remainingBalance: Math.max(0, balance),
      });
    }
    return rows;
  },

  amortize(
    allRows: InstallmentRow[],
    paidNumbers: Set<number>,
    selectedNumbers: Set<number>,
    monthlyRate: number,
  ): AmortizationResult | null {
    if (selectedNumbers.size === 0) return null;
    const selected = allRows.filter(r => selectedNumbers.has(r.number));
    const principalNow = selected.reduce((s, r) => s + r.principalAmount, 0);
    const interestSkipped = selected.reduce((s, r) => s + r.interestAmount, 0);

    const unpaid = allRows.filter(r => !paidNumbers.has(r.number)).sort((a, b) => a.number - b.number);
    const remaining = unpaid.filter(r => !selectedNumbers.has(r.number));

    const firstSelected = selected.reduce<InstallmentRow | null>(
      (min, r) => (min === null || r.number < min.number ? r : min), null,
    );
    if (!firstSelected) return null;

    let balanceBeforeSelected: number;
    const prevNumber = firstSelected.number - 1;
    if (prevNumber === 0) {
      const f = allRows[0];
      if (!f) return null;
      balanceBeforeSelected = f.principalAmount + f.interestAmount + f.remainingBalance;
    } else {
      balanceBeforeSelected = allRows.find(r => r.number === prevNumber)?.remainingBalance ?? 0;
    }
    const newBalance = Math.max(0, balanceBeforeSelected - principalNow);

    const pmt = unpaid[0]?.amount ?? 0;
    const i = monthlyRate;

    let count = 0;
    {
      let bal = newBalance;
      if (pmt > 0) {
        while (bal > 0.01 && count < 1200) {
          const interest = bal * i;
          const principal = pmt - interest;
          if (principal <= 0) break;
          bal -= principal;
          count++;
        }
      }
    }
    const normalInterestOnRemaining = remaining.reduce((s, r) => s + r.interestAmount, 0);
    const reduceTerm: ReduceTermResult = {
      newInstallmentCount: count,
      newPayoffDate: remaining[count - 1]?.dueDate ?? remaining[remaining.length - 1]?.dueDate ?? null,
      totalInterestSaved: Math.max(0, interestSkipped + normalInterestOnRemaining - recomputeInterest(newBalance, i, count)),
    };

    let reduceMonthly: ReduceMonthlyResult;
    const n = remaining.length;
    if (n === 0 || newBalance <= 0) {
      reduceMonthly = { newMonthlyPayment: 0, savingPerMonth: 0, totalInterestSaved: 0 };
    } else {
      const newPmt = i > 0
        ? newBalance * (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1)
        : newBalance / n;
      reduceMonthly = {
        newMonthlyPayment: newPmt,
        savingPerMonth: Math.max(0, pmt - newPmt),
        totalInterestSaved: Math.max(0, interestSkipped + normalInterestOnRemaining - recomputeInterest(newBalance, i, n)),
      };
    }

    return {
      selectedNumbers: [...selectedNumbers].sort((a, b) => a - b),
      principalToPayNow: principalNow,
      interestSkipped,
      reduceTerm,
      reduceMonthly,
    };
  },
};

function recomputeInterest(balance: number, rate: number, count: number): number {
  if (count <= 0 || balance <= 0 || rate <= 0) return 0;
  const pmt = balance * (rate * Math.pow(1 + rate, count)) / (Math.pow(1 + rate, count) - 1);
  let total = 0;
  let bal = balance;
  for (let k = 0; k < count; k++) {
    const interest = bal * rate;
    total += interest;
    bal -= pmt - interest;
  }
  return total;
}
