import sql from 'mssql';
import { fmPool } from '../utils/fm_pool';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { productId } = body;

  if (!productId) {
    return {
      success: false,
      error: 'Missing productId',
    };
  }

  try {
    const pool = await fmPool;

    const request = pool.request();
    request.input('productId', sql.VarChar(100), String(productId));

    const result = await request.query(`
      WITH product_tree AS (
          SELECT
              CAST(@productId AS varchar(100)) AS root_part_no,
              CAST(@productId AS varchar(100)) AS part_no,
              CAST(NULL AS varchar(100)) AS parent_part_no,
              CAST(0 AS int) AS lvl,
              CAST('|' + CAST(@productId AS varchar(100)) + '|' AS varchar(max)) AS path,
              CAST(NULL AS decimal(18,6)) AS qty_required_per_parent,
              CAST(1.0 AS decimal(18,6)) AS cumulative_qty,
              CAST(NULL AS varchar(255)) AS parent_part_description,
              CAST(NULL AS varchar(255)) AS component_part_description

          UNION ALL

          SELECT
              CAST(pt.root_part_no AS varchar(100)) AS root_part_no,
              CAST(b.[Component Part No] AS varchar(100)) AS part_no,
              CAST(b.[Parent Part No] AS varchar(100)) AS parent_part_no,
              CAST(pt.lvl + 1 AS int) AS lvl,
              CAST(pt.path + CAST(b.[Component Part No] AS varchar(100)) + '|' AS varchar(max)) AS path,
              CAST(
                  TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(b.[Qty Required Per Parent] AS varchar(100)))), '') AS decimal(18,6))
                  AS decimal(18,6)
              ) AS qty_required_per_parent,
              CAST(
                  pt.cumulative_qty *
                  ISNULL(
                      TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(b.[Qty Required Per Parent] AS varchar(100)))), '') AS decimal(18,6)),
                      0
                  )
                  AS decimal(18,6)
              ) AS cumulative_qty,
              CAST(b.[Parent Part Description] AS varchar(255)) AS parent_part_description,
              CAST(b.[Component Part Description] AS varchar(255)) AS component_part_description
          FROM product_tree pt
          JOIN [vAssemblies] b
              ON CAST(b.[Parent Part No] AS varchar(100)) = pt.part_no
          WHERE pt.path NOT LIKE '%|' + CAST(b.[Component Part No] AS varchar(100)) + '|%'
      )

      SELECT
          pt.root_part_no,
          pt.parent_part_no,
          pt.part_no,
          pt.lvl,
          pt.path,
          pt.qty_required_per_parent,
          pt.cumulative_qty,
          pt.parent_part_description,
          pt.component_part_description,

          ro.[Operation No] AS OperationNo,
          r.Res_Description AS resource,
          ro.[Setup Time] AS setup_norm,
          ROUND(
              CAST(LEFT(ro.[Op Time], CHARINDEX(':', ro.[Op Time]) - 1) AS decimal(18,6))
              + CAST(
                  SUBSTRING(
                      ro.[Op Time],
                      CHARINDEX(':', ro.[Op Time]) + 1,
                      CHARINDEX(':', ro.[Op Time], CHARINDEX(':', ro.[Op Time]) + 1)
                          - CHARINDEX(':', ro.[Op Time]) - 1
                  ) AS decimal(18,6)
                ) / 60.0
              + CAST(
                  RIGHT(
                      ro.[Op Time],
                      LEN(ro.[Op Time]) - CHARINDEX(':', ro.[Op Time], CHARINDEX(':', ro.[Op Time]) + 1)
                  ) AS decimal(18,6)
                ) / 3600.0,
              2
          ) / NULLIF(ro.[Qty In Op Time], 0) AS unit_op_norm

      FROM product_tree pt
      LEFT JOIN vRouteHeader rh
          ON CAST(rh.[Part No] AS varchar(100)) = pt.part_no
      LEFT JOIN vRouteOperations ro
          ON ro.[Route No] = rh.[Route No]
      LEFT JOIN RESOURCE r
          ON r.Resource_Code = ro.[Resource Code]

      ORDER BY pt.path, ro.[Operation No]
      OPTION (MAXRECURSION 100);
    `);

    return {
      success: true,
      products: result.recordset,
    };
  } catch (error) {
    return {
      success: false,
      error: error?.message || 'Unknown error',
    };
  }
});
