// API endpoint to fetch products (id, name) from MySQL
import { fmPool, fmPoolsql } from '../utils/fm_pool';

export default defineEventHandler(async (event) => {
  const request = fmPool.request();
  // Use query parameters for GET requests
  const body = await readBody(event);
  const { searchTerm } = body;
  request.input('searchTerm', fmPoolsql.NVarChar, searchTerm);
  try {
    // Adjust table name if needed
    const result = await request.query(
      "SELECT PartNumber, ProductDescription \
        FROM vFM_STOCKED_PART_DETAILS \
        WHERE PartStatus = 'Active' AND UsualSource = 'Manufactured' AND \
        CONCAT(PartNumber, ProductDescription) LIKE '%' + @searchTerm + '%' \
        ORDER BY PartNumber OFFSET 0 ROWS FETCH NEXT 100 ROWS ONLY",
    );
    return { success: true, products: result.recordset };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
