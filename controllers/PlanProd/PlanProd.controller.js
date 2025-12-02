var database = require("../../config/storage");
const moment = require("moment-timezone");
const GET_LAST_ID = require("../../function/GET_LAST_ID");

module.exports = {
  addPlanProd: async (req, res) => {
    let client;
    try {
      const data = req.body;
      client = await database.connect();

      const now = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

      // fallback creator
      const user = data.created_by || "SYSTEM";

      // 🟦 1. CEK SUDAH ADA ATAU BELUM
      const checkQuery = `
      SELECT plan_id 
      FROM tb_r_plan_production
      WHERE line_id = $1 AND plan_dt = $2
    `;
      const check = await client.query(checkQuery, [
        data.line_id,
        data.plan_dt,
      ]);

      // ============================
      // 🟧 2. UPDATE JIKA SUDAH ADA
      // ============================
      if (check.rows.length > 0) {
        const updateQuery = `
        UPDATE tb_r_plan_production
        SET plan_prod = $1,
            updated_by = $2,
            updated_dt = $3
        WHERE plan_id = $4
      `;

        await client.query(updateQuery, [
          data.plan_prod,
          user,
          now,
          check.rows[0].plan_id,
        ]);

        return res.status(200).json({
          message: "Plan Production Updated",
        });
      }

      // ============================
      // 🟩 3. INSERT BARU
      // ============================

      const queryLastId = GET_LAST_ID("plan_id", "tb_r_plan_production");
      const last = await client.query(queryLastId);
      const newId = last.rows[0].new_id;

      const insertQuery = `
      INSERT INTO tb_r_plan_production 
      (plan_id, line_id, plan_dt, plan_prod, created_by, created_dt)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

      await client.query(insertQuery, [
        newId,
        data.line_id,
        data.plan_dt,
        data.plan_prod,
        user,
        now,
      ]);

      return res.status(201).json({
        message: "Plan Production Added",
      });
    } catch (error) {
      console.error("addPlanProd error:", error);
      return res.status(500).json({
        message: "Failed to Add Plan Production",
        error: error.message,
      });
    } finally {
      client?.release();
    }
  },
  getPlanProd: async (req, res) => {
    try {
      const { line_id, month } = req.query;

      // month = "2025-12"
      const startDate = `${month}-01`;
      const q = `
      SELECT *
      FROM tb_r_plan_production
      WHERE line_id = $1
        AND DATE_TRUNC('month', plan_dt) = DATE_TRUNC('month', $2::date)
      ORDER BY plan_dt ASC;
    `;

      const client = await database.connect();
      const result = await client.query(q, [line_id, startDate]);

      client.release();
      res.status(200).json({
        message: "Success",
        data: result.rows,
      });
    } catch (error) {
      console.error("[GET PLAN PROD ERR]", error);
      res.status(500).json({
        message: "Failed to get data",
        error: error.message,
      });
    }
  },
};
