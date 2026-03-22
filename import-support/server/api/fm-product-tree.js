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
    -- root
    SELECT DISTINCT
        CAST(@productId AS varchar(100)) AS root_product_id,
        CAST(@productId AS varchar(100)) AS node_id,
        CAST(@productId AS varchar(100)) AS product_id,
        CAST(NULL AS varchar(100)) AS parent_product_id,
        CAST(0 AS int) AS lvl,
        CAST('|' + CAST(@productId AS varchar(100)) + '|' AS varchar(max)) AS path,
        CAST(1 AS decimal(18,6)) AS product_qtt,
        CAST(rootInfo.[Parent Part Description] AS varchar(255)) AS product_name,
        CAST(0 AS bit) AS is_raw_material,
        CAST(NULL AS int) AS material_id
    FROM vAssemblies rootInfo
    WHERE CAST(rootInfo.[Parent Part No] AS varchar(100)) = CAST(@productId AS varchar(100))

    UNION ALL

    -- normal BOM children from vAssemblies
    SELECT
        CAST(pt.root_product_id AS varchar(100)) AS root_product_id,
        CAST(b.[Component Part No] AS varchar(100)) AS node_id,
        CAST(b.[Component Part No] AS varchar(100)) AS product_id,
        CAST(b.[Parent Part No] AS varchar(100)) AS parent_product_id,
        CAST(pt.lvl + 1 AS int) AS lvl,
        CAST(pt.path + CAST(b.[Component Part No] AS varchar(100)) + '|' AS varchar(max)) AS path,
        CAST(
            TRY_CAST(
                NULLIF(LTRIM(RTRIM(CAST(b.[Qty Required Per Parent] AS varchar(100)))), '')
                AS decimal(18,6)
            ) AS decimal(18,6)
        ) AS product_qtt,
        CAST(b.[Component Part Description] AS varchar(255)) AS product_name,
        CAST(0 AS bit) AS is_raw_material,
        CAST(NULL AS int) AS material_id
    FROM product_tree pt
    JOIN vAssemblies b
        ON CAST(b.[Parent Part No] AS varchar(100)) = pt.product_id
    WHERE pt.is_raw_material = 0
      AND NULLIF(LTRIM(RTRIM(REPLACE(CAST(b.[Component Part No] AS varchar(100)), '"', ''))), '') IS NOT NULL
      AND pt.path NOT LIKE '%|' + CAST(b.[Component Part No] AS varchar(100)) + '|%'

    UNION ALL

    -- RM children from vFM_ASSEMBLIES
    SELECT
        CAST(pt.root_product_id AS varchar(100)) AS root_product_id,
        CAST('RM:' + CAST(rm.ComponentMaterialID AS varchar(100)) AS varchar(100)) AS node_id,
        CAST('RM:' + CAST(rm.ComponentMaterialID AS varchar(100)) AS varchar(100)) AS product_id,
        CAST(rm.AssemblyPartNumber AS varchar(100)) AS parent_product_id,
        CAST(pt.lvl + 1 AS int) AS lvl,
        CAST(pt.path + 'RM:' + CAST(rm.ComponentMaterialID AS varchar(100)) + '|' AS varchar(max)) AS path,
        CAST(
            TRY_CAST(
                NULLIF(LTRIM(RTRIM(CAST(rm.QuantityRequired AS varchar(100)))), '')
                AS decimal(18,6)
            ) AS decimal(18,6)
        ) AS product_qtt,
        CAST(NULL AS varchar(255)) AS product_name,
        CAST(1 AS bit) AS is_raw_material,
        CAST(rm.ComponentMaterialID AS int) AS material_id
    FROM product_tree pt
    JOIN vFM_ASSEMBLIES rm
        ON CAST(rm.AssemblyPartNumber AS varchar(100)) = pt.product_id
    WHERE pt.is_raw_material = 0
      AND rm.ComponentMaterialID IS NOT NULL
      AND rm.ComponentMaterialID <> 0
      AND pt.path NOT LIKE '%|RM:' + CAST(rm.ComponentMaterialID AS varchar(100)) + '|%'
),

raw_material_rows AS (
    SELECT DISTINCT
        CAST(rm.AssemblyPartNumber AS varchar(100)) AS product_id,
        CAST(rm.ComponentMaterialID AS int) AS material_id,
        CAST(rmd.Form AS varchar(50)) AS form,
        CAST(NULLIF(LTRIM(RTRIM(rmd.PartNumber)), '') AS varchar(100)) AS part_number,
        CAST(rmd.Specification AS varchar(255)) AS specification,
        CAST(rmd.Dimension1 AS varchar(100)) AS dimension_1,
        CAST(rmd.Dimension2 AS varchar(100)) AS dimension_2,
        CAST(rmd.Dimension3 AS varchar(100)) AS dimension_3,
        CAST(rmd.Description AS varchar(255)) AS description,
        CAST(rmd.MaterialComments AS varchar(255)) AS material_comments,
        CAST(rm.StockUOM AS varchar(50)) AS stock_uom,
        CAST(
            TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(rm.QuantityOfMaterial AS varchar(100)))), '') AS decimal(18,6))
            AS decimal(18,6)
        ) AS quantity_of_material,
        CAST(
            TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(rm.QuantityRequired AS varchar(100)))), '') AS decimal(18,6))
            AS decimal(18,6)
        ) AS quantity_required,
        CAST(
            TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(rm.PreWasteQuantity AS varchar(100)))), '') AS decimal(18,6))
            AS decimal(18,6)
        ) AS pre_waste_quantity,
        CAST(
            TRY_CAST(NULLIF(LTRIM(RTRIM(CAST(rm.WastePercentage AS varchar(100)))), '') AS decimal(18,6))
            AS decimal(18,6)
        ) AS waste_percentage
    FROM vFM_ASSEMBLIES rm
    LEFT JOIN vFM_RAW_MATERIAL_DETAILS rmd
        ON rmd.MaterialID = rm.ComponentMaterialID
    WHERE rm.ComponentMaterialID IS NOT NULL
      AND rm.ComponentMaterialID <> 0
)

SELECT
    pt.root_product_id,
    pt.parent_product_id,
    pt.node_id,
    pt.product_id,
    pt.lvl,
    pt.path,
    pt.product_qtt,

    CASE
        WHEN pt.is_raw_material = 1
            THEN CAST(COALESCE(rmd.Description, rmd.Specification, 'Raw material') AS varchar(255))
        ELSE pt.product_name
    END AS product_name,

    CASE
        WHEN pt.is_raw_material = 1 THEN CAST('RM' AS varchar(255))
        ELSE CAST(sp.UsualSource AS varchar(255))
    END AS manufactured,

    pt.is_raw_material,
    pt.material_id,

    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE ro.[Operation No] END AS process_no,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE r.Res_Description END AS resource,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE ro.[Setup Time] END AS setup_norm,
    CASE
        WHEN pt.is_raw_material = 1 THEN NULL
        WHEN ro.[Op Time] IS NULL OR ro.[Qty In Op Time] IS NULL OR ro.[Qty In Op Time] = 0 THEN NULL
        ELSE CAST(
            (
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
                ) / 3600.0
            ) / NULLIF(ro.[Qty In Op Time], 0)
            AS decimal(18,6)
        )
    END AS unit_op_norm,

    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.Form AS varchar(50)) ELSE NULL END AS rm_form,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(NULLIF(LTRIM(RTRIM(rmd.PartNumber)), '') AS varchar(100)) ELSE NULL END AS rm_part_number,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.Specification AS varchar(255)) ELSE NULL END AS rm_specification,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.Dimension1 AS varchar(100)) ELSE NULL END AS rm_dimension_1,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.Dimension2 AS varchar(100)) ELSE NULL END AS rm_dimension_2,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.Dimension3 AS varchar(100)) ELSE NULL END AS rm_dimension_3,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.Description AS varchar(255)) ELSE NULL END AS rm_description,
    CASE WHEN pt.is_raw_material = 1 THEN CAST(rmd.MaterialComments AS varchar(255)) ELSE NULL END AS rm_material_comments,

    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE CAST(sp.StockUOM AS varchar(50)) END AS stock_uom,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE CAST(sp.DefaultWorkshop AS varchar(100)) END AS default_workshop,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE CAST(sp.DefaultReceiptLocation AS varchar(100)) END AS default_receipt_location,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE CAST(sp.DefaultIssueLocation AS varchar(100)) END AS default_issue_location,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE TRY_CAST(sp.MinimumEBQ AS decimal(18,6)) END AS minimum_ebq,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE TRY_CAST(sp.ManLeadTime AS decimal(18,6)) END AS man_lead_time,
    CASE WHEN pt.is_raw_material = 1 THEN NULL ELSE CAST(sp.ProductGroup AS varchar(100)) END AS product_group,

    rmj.raw_materials_json

FROM product_tree pt
LEFT JOIN vFM_STOCKED_PART_DETAILS sp
    ON pt.is_raw_material = 0
   AND CAST(sp.PartNumber AS varchar(100)) = pt.product_id
LEFT JOIN vFM_RAW_MATERIAL_DETAILS rmd
    ON pt.is_raw_material = 1
   AND rmd.MaterialID = pt.material_id
LEFT JOIN vRouteHeader rh
    ON pt.is_raw_material = 0
   AND CAST(rh.[Part No] AS varchar(100)) = pt.product_id
LEFT JOIN vRouteOperations ro
    ON ro.[Route No] = rh.[Route No]
LEFT JOIN RESOURCE r
    ON r.Resource_Code = ro.[Resource Code]

OUTER APPLY (
    SELECT
        rmr.material_id,
        rmr.form,
        rmr.part_number,
        rmr.specification,
        rmr.dimension_1,
        rmr.dimension_2,
        rmr.dimension_3,
        rmr.description,
        rmr.material_comments,
        rmr.stock_uom,
        rmr.quantity_of_material,
        rmr.quantity_required,
        rmr.pre_waste_quantity,
        rmr.waste_percentage
    FROM raw_material_rows rmr
    WHERE rmr.product_id = pt.product_id
    FOR JSON PATH
) rmj(raw_materials_json)

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
