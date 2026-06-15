-- Migrate legacy group 1 expense data to group 2 (one-time; idempotent because group_id=1 rows disappear after first run)
UPDATE expenses         SET group_id = 2 WHERE group_id = 1;
UPDATE fixed_expenses   SET group_id = 2 WHERE group_id = 1;
UPDATE monthly_salaries SET group_id = 2 WHERE group_id = 1;

-- Assign any remaining ungrouped data to group 2
UPDATE expenses         SET group_id = 2 WHERE group_id IS NULL;
UPDATE fixed_expenses   SET group_id = 2 WHERE group_id IS NULL;
UPDATE monthly_salaries SET group_id = 2 WHERE group_id IS NULL;

-- Default categories (global, shared across all groups)
INSERT IGNORE INTO categories (value, label, icon, color) VALUES
  ('FOOD',          'Food',          'restaurant',     '#e91e63'),
  ('TRANSPORT',     'Transport',     'directions_car', '#2196f3'),
  ('HOUSING',       'Housing',       'home',           '#ff9800'),
  ('ENTERTAINMENT', 'Entertainment', 'movie',          '#9c27b0'),
  ('HEALTH',        'Health',        'local_hospital', '#4caf50'),
  ('SHOPPING',      'Shopping',      'shopping_cart',  '#00bcd4'),
  ('OTHER',         'Other',         'more_horiz',     '#607d8b');

INSERT IGNORE INTO categories (value, label, icon, color, is_income) VALUES
  ('REFUND', 'Refunds & Credits', 'payments', '#4caf50', TRUE);

-- Default subcategories
INSERT IGNORE INTO subcategories (category_value, name) VALUES
  ('FOOD', 'Tim Hortons'),
  ('FOOD', 'McDonald''s'),
  ('FOOD', 'Subway'),
  ('FOOD', 'Pizza Pizza'),
  ('FOOD', 'Starbucks'),
  ('FOOD', 'Grocery Store'),
  ('FOOD', 'Uber Eats'),
  ('FOOD', 'DoorDash'),
  ('FOOD', 'Restaurant'),
  ('FOOD', 'Other'),

  ('TRANSPORT', 'Gas Station'),
  ('TRANSPORT', 'TTC / Transit'),
  ('TRANSPORT', 'Uber'),
  ('TRANSPORT', 'Lyft'),
  ('TRANSPORT', 'Parking'),
  ('TRANSPORT', 'Car Maintenance'),
  ('TRANSPORT', 'Car Insurance'),
  ('TRANSPORT', 'Other'),

  ('HOUSING', 'Rent'),
  ('HOUSING', 'Electricity'),
  ('HOUSING', 'Internet'),
  ('HOUSING', 'Water Bill'),
  ('HOUSING', 'Phone Bill'),
  ('HOUSING', 'Cleaning Supplies'),
  ('HOUSING', 'Furniture'),
  ('HOUSING', 'Other'),

  ('ENTERTAINMENT', 'Netflix'),
  ('ENTERTAINMENT', 'Spotify'),
  ('ENTERTAINMENT', 'Movies'),
  ('ENTERTAINMENT', 'Games'),
  ('ENTERTAINMENT', 'Concerts'),
  ('ENTERTAINMENT', 'YouTube Premium'),
  ('ENTERTAINMENT', 'Disney+'),
  ('ENTERTAINMENT', 'Other'),

  ('HEALTH', 'Pharmacy'),
  ('HEALTH', 'Doctor Visit'),
  ('HEALTH', 'Gym Membership'),
  ('HEALTH', 'Dental'),
  ('HEALTH', 'Eye Care'),
  ('HEALTH', 'Massage'),
  ('HEALTH', 'Other'),

  ('SHOPPING', 'Amazon'),
  ('SHOPPING', 'Winners'),
  ('SHOPPING', 'Walmart'),
  ('SHOPPING', 'Costco'),
  ('SHOPPING', 'Clothing'),
  ('SHOPPING', 'Electronics'),
  ('SHOPPING', 'Home Goods'),
  ('SHOPPING', 'Other'),

  ('OTHER', 'Gifts'),
  ('OTHER', 'Donations'),
  ('OTHER', 'Banking Fees'),
  ('OTHER', 'Miscellaneous'),
  ('OTHER', 'Other'),

  ('REFUND', 'Amazon Refund'),
  ('REFUND', 'Price Adjustment'),
  ('REFUND', 'Cashback'),
  ('REFUND', 'Store Credit'),
  ('REFUND', 'Insurance Claim'),
  ('REFUND', 'Tax Refund'),
  ('REFUND', 'Other');
