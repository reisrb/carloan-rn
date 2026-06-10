import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';

export const installmentService = {
  async markAsPaid(installmentId: string, paidDate: number, paidAmount: number, note: string | null): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('payments').insert({
      id: generateId(),
      user_id: userId,
      installment_id: installmentId,
      paid_date: paidDate,
      paid_amount: paidAmount,
      note: note?.trim() || null,
      receipt_paths: [],
    });
    if (error) throw new Error(error.message);
  },

  async undoPayment(installmentId: string): Promise<void> {
    const { error } = await supabase.from('payments').delete().eq('installment_id', installmentId);
    if (error) throw new Error(error.message);
  },

  async addReceipt(installmentId: string, receiptPath: string): Promise<void> {
    const { data, error } = await supabase
      .from('payments')
      .select('receipt_paths')
      .eq('installment_id', installmentId)
      .single();
    if (error) throw new Error(error.message);
    const paths: string[] = [...(data.receipt_paths ?? []), receiptPath];
    const { error: updError } = await supabase
      .from('payments')
      .update({ receipt_paths: paths })
      .eq('installment_id', installmentId);
    if (updError) throw new Error(updError.message);
  },

  async removeReceipt(installmentId: string, receiptPath: string): Promise<void> {
    const { data, error } = await supabase
      .from('payments')
      .select('receipt_paths')
      .eq('installment_id', installmentId)
      .single();
    if (error) throw new Error(error.message);
    const paths: string[] = (data.receipt_paths ?? []).filter((p: string) => p !== receiptPath);
    const { error: updError } = await supabase
      .from('payments')
      .update({ receipt_paths: paths })
      .eq('installment_id', installmentId);
    if (updError) throw new Error(updError.message);
  },
};
