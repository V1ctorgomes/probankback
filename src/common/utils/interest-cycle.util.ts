import {
  dueDateForReference,
  roundMoney,
  toNumber,
} from './money.util';

export type InterestCycleStatus = 'PAGO' | 'PENDENTE' | 'ATRASADO';

export const INTEREST_CYCLE_STATUS_ORDER: Record<InterestCycleStatus, number> = {
  ATRASADO: 0,
  PENDENTE: 1,
  PAGO: 2,
};

type CycleRecord = {
  id: string;
  loanId: string;
  referencia: string;
  principalBase: unknown;
  jurosGerado: unknown;
  jurosPago: unknown;
  createdAt: Date;
};

export function resolveInterestCycleStatus(
  jurosGerado: number,
  jurosPago: number,
  referencia: string,
  diaPagamento: number,
  now = new Date(),
): InterestCycleStatus {
  const jurosPendente = roundMoney(jurosGerado - jurosPago);
  if (jurosPendente <= 0) {
    return 'PAGO';
  }

  const vencimento = dueDateForReference(referencia, diaPagamento);
  return vencimento < now ? 'ATRASADO' : 'PENDENTE';
}

export function serializeInterestCycle(
  cycle: CycleRecord,
  diaPagamento: number,
  now = new Date(),
) {
  const jurosGerado = toNumber(cycle.jurosGerado);
  const jurosPago = toNumber(cycle.jurosPago);
  const jurosPendente = roundMoney(jurosGerado - jurosPago);
  const vencimento = dueDateForReference(cycle.referencia, diaPagamento);
  const status = resolveInterestCycleStatus(
    jurosGerado,
    jurosPago,
    cycle.referencia,
    diaPagamento,
    now,
  );

  return {
    id: cycle.id,
    loanId: cycle.loanId,
    referencia: cycle.referencia,
    principalBase: toNumber(cycle.principalBase),
    jurosGerado,
    jurosPago,
    jurosPendente,
    vencimento: vencimento.toISOString(),
    status,
    createdAt: cycle.createdAt,
  };
}
