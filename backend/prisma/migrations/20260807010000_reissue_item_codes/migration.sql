-- 품목 코드를 새 규칙(분류 접두어 + 두 자리 순번)으로 다시 매긴다.
--   고철 FE / 비철 NF(STS·AL 포함) / 구리 CU / 폐기물 스크랩 WS
-- 코드를 바꾸면 입출고·재고원장이 끊기므로, 지우고 다시 만들지 않고
-- 새 코드 행을 만든 뒤 참조를 옮기고 옛 행만 지운다. 거래 데이터는 그대로 남는다.
-- 미분류(UNCLASSIFIED)는 시스템이 쓰는 코드라 건드리지 않는다.

CREATE TEMP TABLE item_code_map AS
WITH grouped AS (
  SELECT
    item_code AS old_code,
    item_name,
    CASE
      WHEN item_code LIKE 'CU%' OR category ILIKE '%CU%' OR category LIKE '%구리%' OR item_name LIKE '%구리%' THEN 'CU'
      WHEN item_code LIKE 'W%'  OR category LIKE '%폐기물%' OR item_name LIKE '폐%' THEN 'WS'
      WHEN item_code LIKE 'STS%' OR item_code LIKE 'AL%'
           OR category ILIKE '%STS%' OR category ILIKE '%AL%'
           OR category LIKE '%비철%' OR category LIKE '%알루미늄%' OR category LIKE '%스테인%' THEN 'NF'
      ELSE 'FE'
    END AS grp
  FROM item_master
  WHERE item_code <> 'UNCLASSIFIED'
)
SELECT
  old_code,
  grp,
  grp || '-' || LPAD(ROW_NUMBER() OVER (PARTITION BY grp ORDER BY item_name)::text, 2, '0') AS new_code
FROM grouped;

-- 이미 규칙에 맞는 코드는 옮길 필요가 없다.
DELETE FROM item_code_map WHERE old_code = new_code;

-- 1) 새 코드로 품목 행을 복제한다.
INSERT INTO item_master (
  id, item_code, category, sub_category, item_name, base_price, is_temporary, memo, created_at,
  alias_names, minor_category, material, grade,
  base_unit, weigh_unit, purchase_unit, sales_unit, unit_factor, qty_managed,
  usage_type, convert_to_item_code, expected_yield, deduct_impurity, deduct_soil, deduct_moisture,
  zone_code, price_linked, price_ref_code,
  tax_type, recycle_deductible, ecount_item_code, account_code,
  is_active, updated_at, created_by
)
SELECT
  gen_random_uuid(), m.new_code,
  CASE m.grp WHEN 'FE' THEN '고철' WHEN 'NF' THEN '비철' WHEN 'CU' THEN '구리' ELSE '폐기물 스크랩' END,
  i.sub_category, i.item_name, i.base_price, i.is_temporary, i.memo, i.created_at,
  i.alias_names, i.minor_category, i.material, i.grade,
  i.base_unit, i.weigh_unit, i.purchase_unit, i.sales_unit, i.unit_factor, i.qty_managed,
  i.usage_type, i.convert_to_item_code, i.expected_yield, i.deduct_impurity, i.deduct_soil, i.deduct_moisture,
  i.zone_code, i.price_linked, i.price_ref_code,
  i.tax_type, i.recycle_deductible, i.ecount_item_code, i.account_code,
  i.is_active, NOW(), i.created_by
FROM item_master i
JOIN item_code_map m ON m.old_code = i.item_code;

-- 2) 거래·원장·단가 이력의 참조를 새 코드로 옮긴다.
UPDATE inbound          t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE waste_inbound    t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE outbound_sale    t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE waste_outbound   t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE inventory_ledger t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE item_price_history t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE sorting t SET item_code = m.new_code FROM item_code_map m WHERE t.item_code = m.old_code;
UPDATE sorting t SET source_item_code = m.new_code FROM item_code_map m WHERE t.source_item_code = m.old_code;
UPDATE item_master t SET convert_to_item_code = m.new_code FROM item_code_map m WHERE t.convert_to_item_code = m.old_code;

-- 3) 참조가 모두 옮겨졌으니 옛 품목 행을 지운다.
DELETE FROM item_master WHERE item_code IN (SELECT old_code FROM item_code_map);

DROP TABLE item_code_map;

-- 4) 이미 규칙에 맞던 코드도 분류명을 새 이름으로 통일한다.
UPDATE item_master SET category =
  CASE
    WHEN item_code LIKE 'FE-%' THEN '고철'
    WHEN item_code LIKE 'NF-%' THEN '비철'
    WHEN item_code LIKE 'CU-%' THEN '구리'
    WHEN item_code LIKE 'WS-%' THEN '폐기물 스크랩'
    ELSE category
  END
WHERE item_code ~ '^(FE|NF|CU|WS)-[0-9]+$';
