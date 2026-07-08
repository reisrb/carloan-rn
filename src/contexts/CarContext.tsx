import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { FinancingWithInstallments } from '../types';
import { financingService } from '../services/financingService';

interface CarContextValue {
  financingId: string;
  readOnly: boolean;
  ownerUsername?: string;
  car: FinancingWithInstallments | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const CarContext = createContext<CarContextValue | null>(null);

export const CarProvider: React.FC<{
  financingId: string;
  readOnly?: boolean;
  ownerUsername?: string;
  children: React.ReactNode;
}> = ({ financingId, readOnly = false, ownerUsername, children }) => {
  const [car, setCar] = useState<FinancingWithInstallments | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const data = await financingService.getById(financingId);
    setCar(data);
  }, [financingId]);

  useEffect(() => {
    reload().catch(() => null).finally(() => setLoading(false));
  }, [reload]);

  return (
    <CarContext.Provider value={{ financingId, readOnly, ownerUsername, car, loading, reload }}>
      {children}
    </CarContext.Provider>
  );
};

export function useCar(): CarContextValue {
  const ctx = useContext(CarContext);
  if (!ctx) throw new Error('useCar must be used within a CarProvider');
  return ctx;
}
