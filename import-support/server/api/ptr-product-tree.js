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
            t.ID AS product_id,
            NULL AS parent_product_id,
            CAST(t.ID AS CHAR(1000)) AS path,
            0 AS lvl
        FROM termektorzs t
        WHERE t.ID = ?
        UNION ALL
        SELECT
          pt.root_product_id,
          ta.ID_termektorzs AS product_id,
          ta.ID_termektorzs_Celtermek AS parent_product_id,
          CONCAT(pt.path, '>', ta.ID_termektorzs) AS path,
          pt.lvl + 1 AS lvl
        FROM product_tree pt
        JOIN termektorzs_alapanyag ta
            ON ta.ID_termektorzs_Celtermek = pt.product_id
        WHERE ta.del = false
          AND FIND_IN_SET(
                ta.ID_termektorzs,
                REPLACE(pt.path, '>', ',')
              ) = 0
        )
        SELECT
            pt.root_product_id,
            pt.parent_product_id,
            pt.product_id,
            pt.lvl,
            pt.path,
            e.Nev AS resource,
            mt.Tipus AS process_group,
            m.Nev AS process,
            ms.norma_db AS unit_norm,
            ms.sorrend
        FROM product_tree pt
        JOIN muvelet_sorrend ms
            ON ms.ID_termektorzs = pt.product_id
        LEFT JOIN muvelet_tipus mt
            ON mt.ID = ms.ID_muvelet_tipus
        LEFT JOIN muvelet m
            ON m.ID = ms.ID_muvelet
        LEFT JOIN eroforras e
            ON e.ID = ms.ID_eroforras
        ORDER BY pt.path, ms.sorrend
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
