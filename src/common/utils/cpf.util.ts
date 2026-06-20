export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

export function validateCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) {
    return false;
  }

  const calc = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}
