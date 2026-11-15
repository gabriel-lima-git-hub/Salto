/** Colunas retornadas pela API de unidades (lista e mutação). */
export const UNIDADE_SELECT =
  "id, name, cnpj, internal_code, employee_count, is_active, sort_order, cep, state, city, neighborhood, street, number, complement, phone, email, responsible_name, notes, created_at, updated_at";

export type UnidadeLinha = {
  id: string;
  name: string;
  cnpj: string | null;
  internal_code: string | null;
  employee_count: number | null;
  is_active: boolean;
  sort_order: number;
  cep: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  phone: string | null;
  email: string | null;
  responsible_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
