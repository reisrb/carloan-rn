import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { financingService } from './financingService';

const BACKUP_PATH = FileSystem.documentDirectory + 'carloan_backup.json';

export const backupService = {
  async buildPayload(): Promise<string> {
    const financings = await financingService.getAll();
    const payload = [];
    for (const f of financings) {
      const installments = await financingService.getInstallments(f.id);
      let carImageBase64: string | undefined;

      if (f.carPhotoPath) {
        try {
          const { data, error } = await supabase.storage.from('car-images').download(f.carPhotoPath);
          if (!error && data) {
            const reader = new FileReader();
            const promise = new Promise<string>((resolve, reject) => {
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
            });
            reader.readAsDataURL(data);
            carImageBase64 = await promise;
          }
        } catch (e) {
          console.error('Erro ao baixar foto:', e);
        }
      }

      payload.push({
        carro: f.carName,
        placa: f.licensePlate,
        banco: f.bank,
        valor_veiculo: f.vehicleValue,
        entrada: f.downPayment,
        taxa_mensal: f.monthlyRate,
        total_parcelas: f.totalInstallments,
        primeiro_vencimento: f.firstDueDate,
        criado_em: f.createdAt,
        car_image_base64: carImageBase64,
        parcelas: installments.map(i => ({
          numero: i.number,
          vencimento: i.dueDate,
          valor: i.amount,
          amortizacao: i.principalAmount,
          juros: i.interestAmount,
          saldo_devedor: i.remainingBalance,
          pagamento: i.payment
            ? {
                pago_em: i.payment.paidDate,
                valor_pago: i.payment.paidAmount,
                observacao: i.payment.note,
              }
            : null,
        })),
      });
    }
    return JSON.stringify({ versao: 1, exportado_em: Date.now(), financiamentos: payload });
  },

  async share(): Promise<void> {
    const json = await backupService.buildPayload();
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carloan_backup.json';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await FileSystem.writeAsStringAsync(BACKUP_PATH, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(BACKUP_PATH, {
        mimeType: 'application/json',
        dialogTitle: 'Exportar dados',
      });
    }
  },

  async importJson(uri: string): Promise<{ financings: number }> {
    const userId = await getUserId();
    const raw = Platform.OS === 'web'
      ? await (await fetch(uri)).text()
      : await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
    const json = JSON.parse(raw);
    const entries: any[] = json.financiamentos ?? [];
    let total = 0;

    for (const entry of entries) {
      if (!entry.carro || !entry.parcelas?.length) continue;
      const financingId = generateId();

      let carPhotoPath: string | null = null;
      if (entry.car_image_base64) {
        try {
          const base64 = entry.car_image_base64;
          const blob = await (await fetch(base64)).blob();
          const photoPath = `${financingId}/car-${generateId()}.jpg`;
          await supabase.storage.from('car-images').upload(photoPath, blob, {
            contentType: 'image/jpeg',
            upsert: true,
          });
          carPhotoPath = photoPath;
        } catch (e) {
          console.error('Erro ao restaurar foto:', e);
        }
      }

      const { error } = await supabase.from('financings').insert({
        id: financingId,
        user_id: userId,
        car_name: entry.carro,
        license_plate: entry.placa ?? '',
        bank: entry.banco ?? '',
        vehicle_value: entry.valor_veiculo ?? 0,
        down_payment: entry.entrada ?? 0,
        monthly_rate: entry.taxa_mensal ?? 0,
        total_installments: entry.total_parcelas ?? entry.parcelas.length,
        first_due_date: entry.primeiro_vencimento ?? Date.now(),
        created_at: entry.criado_em ?? Date.now(),
        car_photo_path: carPhotoPath,
      });
      if (error) continue;
      total++;

      for (const p of entry.parcelas) {
        const installmentId = generateId();
        await supabase.from('installments').insert({
          id: installmentId,
          user_id: userId,
          financing_id: financingId,
          number: p.numero,
          due_date: p.vencimento,
          amount: p.valor,
          principal_amount: p.amortizacao ?? p.valor,
          interest_amount: p.juros ?? 0,
          remaining_balance: p.saldo_devedor ?? 0,
        });
        if (p.pagamento) {
          await supabase.from('payments').insert({
            id: generateId(),
            user_id: userId,
            installment_id: installmentId,
            paid_date: p.pagamento.pago_em ?? p.vencimento,
            paid_amount: p.pagamento.valor_pago ?? p.valor,
            note: p.pagamento.observacao ?? null,
            receipt_paths: [],
          });
        }
      }
    }
    return { financings: total };
  },
};
