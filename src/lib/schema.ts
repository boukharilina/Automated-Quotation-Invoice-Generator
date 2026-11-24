// Idempotent PostgreSQL schema, executed at startup.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','accounting','sales')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS login_attempts (email TEXT PRIMARY KEY, n INT NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS services (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS counters (
  kind TEXT NOT NULL, year INT NOT NULL, last INT NOT NULL DEFAULT 0,
  PRIMARY KEY (kind, year)
);
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  cin_passport TEXT NOT NULL DEFAULT '',
  student_name TEXT NOT NULL DEFAULT '',
  registered_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quotes (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_id INT NOT NULL REFERENCES customers(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','rejected','expired','converted')),
  issue_date DATE NOT NULL,
  valid_until DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  conditions TEXT NOT NULL DEFAULT '',
  subtotal_ht NUMERIC(14,3) NOT NULL, discount NUMERIC(14,3) NOT NULL DEFAULT 0, extra_charges NUMERIC(14,3) NOT NULL DEFAULT 0,
  total_ht NUMERIC(14,3) NOT NULL, vat_rate NUMERIC(5,2) NOT NULL, vat_amount NUMERIC(14,3) NOT NULL, total_ttc NUMERIC(14,3) NOT NULL,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS quote_items (
  id SERIAL PRIMARY KEY,
  quote_id INT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  service_id INT REFERENCES services(id),
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,3) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14,3) NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  customer_id INT NOT NULL REFERENCES customers(id),
  quote_id INT REFERENCES quotes(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','partially_paid','paid','overdue','cancelled')),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'bank_transfer',
  notes TEXT NOT NULL DEFAULT '',
  conditions TEXT NOT NULL DEFAULT '',
  subtotal_ht NUMERIC(14,3) NOT NULL, discount NUMERIC(14,3) NOT NULL DEFAULT 0, extra_charges NUMERIC(14,3) NOT NULL DEFAULT 0,
  total_ht NUMERIC(14,3) NOT NULL, vat_rate NUMERIC(5,2) NOT NULL, vat_amount NUMERIC(14,3) NOT NULL, total_ttc NUMERIC(14,3) NOT NULL,
  amount_paid NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_quote_unique ON invoices(quote_id) WHERE quote_id IS NOT NULL AND status <> 'cancelled';
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position INT NOT NULL,
  service_id INT REFERENCES services(id),
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,3) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14,3) NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  invoice_id INT NOT NULL REFERENCES invoices(id),
  customer_id INT NOT NULL REFERENCES customers(id),
  amount NUMERIC(14,3) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL CHECK (method IN ('bank_transfer','cash','check','other')),
  paid_on DATE NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_by INT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id INT, user_name TEXT NOT NULL DEFAULT 'système',
  action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_entity ON audit_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS quotes_customer ON quotes(customer_id);
CREATE INDEX IF NOT EXISTS payments_invoice ON payments(invoice_id);
`;
