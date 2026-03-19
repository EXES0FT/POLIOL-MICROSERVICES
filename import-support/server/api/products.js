// API endpoint to fetch products (id, name) from MySQL
import { pool as fmPool, sql } from '../utils/fm_pool';

export default defineEventHandler(async (event) => {
  const request = fmPool.request();
  // Use query parameters for GET requests
  const body = await readBody(event);
  const { limit } = body;
  request.input('limit', sql.Int, limit);
  try {
    // Adjust table name if needed
    const result = await request.query(
      "SELECT PartNumber, ProductDescription \
        FROM vFM_STOCKED_PART_DETAILS \
        WHERE PartStatus = 'Active' AND UsualSource = 'Manufactured' \
        ORDER BY PartNumber OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY",
    );
    return { success: true, products: result.recordset };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
