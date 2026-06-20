export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'Entrada no sistema',
  LOGOUT: 'Saída do sistema',
  CREATE: 'Cadastro',
  UPDATE: 'Alteração',
  DEACTIVATE: 'Desativação',
  ACTIVATE: 'Reativação',
  CLOSE: 'Encerramento',
  DELETE: 'Exclusão',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  User: 'Usuário',
  Customer: 'Cliente',
  Loan: 'Empréstimo',
  Payment: 'Pagamento',
  Transaction: 'Movimentação',
  Category: 'Categoria',
};

export function formatAuditDescription(action: string, entity: string): string {
  const actionLabel = AUDIT_ACTION_LABELS[action] ?? action;
  const entityLabel = (AUDIT_ENTITY_LABELS[entity] ?? entity).toLowerCase();
  return `${actionLabel} de ${entityLabel}`;
}
