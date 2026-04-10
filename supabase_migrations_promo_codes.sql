CREATE TABLE promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  applicable_plans TEXT[] DEFAULT NULL,
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  max_uses INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by_worker_id UUID REFERENCES workers(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE coupon_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  brand_id UUID REFERENCES brands(id),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  discount_amount DECIMAL(10,2),
  period_type VARCHAR(20) CHECK (period_type IN ('immediate', 'next_billing'))
);

-- Índices para mejor rendimiento
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_active ON promo_codes(is_active, valid_from, valid_until);
CREATE INDEX idx_coupon_applications_user ON coupon_applications(user_id);
CREATE INDEX idx_coupon_applications_brand ON coupon_applications(brand_id);
