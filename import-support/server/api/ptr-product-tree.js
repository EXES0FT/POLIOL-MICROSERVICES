// API endpoint to fetch products (id, name) from MySQL
import { ptrPool } from '../utils/ptr_pool';

export default defineEventHandler(async (event) => {
  const connection = await ptrPool.getConnection();
  // Use query parameters for GET requests
  const body = await readBody(event);
  const { productId } = body;
  try {
    // Adjust table name if needed
    const result = await connection.query(
      `
        WITH RECURSIVE product_tree AS (
    SELECT
        t.ID AS root_product_id,
        t.Nev AS product_name,
        t.ID AS product_id,
        NULL AS parent_product_id,
        1 AS product_qtt,
        CAST(t.ID AS CHAR(1000)) AS path,
        0 AS lvl,
        CAST(t.SajatGyartas AS UNSIGNED) AS manufactured
    FROM termektorzs t
    WHERE t.ID = ?

    UNION ALL

    SELECT
        pt.root_product_id,
        child.Nev AS product_name,
        ta.ID_termektorzs AS product_id,
        ta.ID_termektorzs_Celtermek AS parent_product_id,
        ta.Gyartando AS product_qtt,
        CONCAT(pt.path, '>', ta.ID_termektorzs) AS path,
        pt.lvl + 1 AS lvl,
        CAST(child.SajatGyartas AS UNSIGNED) AS manufactured
    FROM product_tree pt
    JOIN termektorzs_alapanyag ta
        ON ta.ID_termektorzs_Celtermek = pt.product_id
    LEFT JOIN termektorzs child
        ON child.ID = ta.ID_termektorzs
    WHERE ta.del = false
      AND FIND_IN_SET(
            ta.ID_termektorzs,
            REPLACE(pt.path, '>', ',')
          ) = 0
),

historical_norms AS (
    SELECT
        ml.ID_termektorzs AS product_id,
        m.ID_eroforras AS resource_id,
        AVG(ml.Norma / ml.TervezettMennyiseg) AS avg_unit_norm
    FROM munkalap ml
    JOIN munka m
        ON m.ID_munkalap = ml.ID
    WHERE ml.del = false
      AND m.del = false
      AND ml.Norma IS NOT NULL
      AND ml.Norma > 0
      AND ml.ID_termektorzs IS NOT NULL
      AND m.ID_eroforras IS NOT NULL
    GROUP BY
        ml.ID_termektorzs,
        m.ID_eroforras
),

elogyartmany_distinct AS (
    SELECT DISTINCT
        e.ID_termektorzs AS product_id,
        COALESCE(e.Anyag, '') AS Anyag,
        COALESCE(e.Vagas, '') AS Vagas,
        COALESCE(e.Darab, '') AS Darab,
        COALESCE(e.megjegyzes, '') AS megjegyzes
    FROM elogyartmany e
    WHERE e.ID_termektorzs IS NOT NULL
),

elogyartmany_agg AS (
    SELECT
        ed.product_id,
        GROUP_CONCAT(
            CONCAT(
                REPLACE(ed.Anyag, '||', ' '), '||',
                REPLACE(ed.Vagas, '||', ' '), '||',
                REPLACE(ed.Darab, '||', ' '), '||',
                REPLACE(ed.megjegyzes, '||', ' ')
            )
            SEPARATOR '##'
        ) AS raw_materials
    FROM elogyartmany_distinct ed
    GROUP BY ed.product_id
)

SELECT
    pt.root_product_id,
    pt.parent_product_id,
    pt.product_name,
    pt.product_id,
    pt.product_qtt,
    pt.manufactured,
    pt.lvl,
    pt.path,
    e.Nev AS resource,
    mt.Tipus AS process_group,
    m.Nev AS process,
    COALESCE(hn.avg_unit_norm, ms.norma_db) AS unit_norm,
    ms.sorrend,
    ea.raw_materials
FROM product_tree pt
LEFT JOIN muvelet_sorrend ms
    ON ms.ID_termektorzs = pt.product_id
LEFT JOIN muvelet_tipus mt
    ON mt.ID = ms.ID_muvelet_tipus
LEFT JOIN muvelet m
    ON m.ID = ms.ID_muvelet
LEFT JOIN eroforras e
    ON e.ID = ms.ID_eroforras
LEFT JOIN historical_norms hn
    ON hn.product_id = pt.product_id
   AND hn.resource_id = ms.ID_eroforras
LEFT JOIN elogyartmany_agg ea
    ON ea.product_id = pt.product_id
ORDER BY pt.path, ms.sorrend;
      `,
      [productId],
    );
    return { success: true, products: result[0] };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
});
