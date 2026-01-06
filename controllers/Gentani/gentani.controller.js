var database = require("../../config/storage");
var moment = require("moment-timezone");
const GET_LAST_ID = require("../../function/GET_LAST_ID");
const updateRow = require("../../function/edit");

module.exports = {
  getSummaryGentani: async (req, res) => {
    try {
      const { line_id, month } = req.query;

      const client = await database.connect();

      let start, end;

      if (month) {
        // month format: "YYYY-MM"
        const [year, mon] = month.split("-");
        // Start: 1st day of month, 07:00
        start = moment
          .tz(`${year}-${mon}-01 07:00:00`, "Asia/Jakarta")
          .toISOString();
        // End: 1st day of next month, 07:00
        const nextMonth = moment
          .tz(`${year}-${mon}-01 07:00:00`, "Asia/Jakarta")
          .add(1, "month");
        end = nextMonth.toISOString();
      } else {
        // default ke hari ini jam 07:00 sampai besok jam 07:00
        const today = moment().tz("Asia/Jakarta").format("YYYY-MM-DD");
        start = moment.tz(`${today} 07:00:00`, "Asia/Jakarta").toISOString();
        end = moment
          .tz(`${today} 07:00:00`, "Asia/Jakarta")
          .add(1, "day")
          .toISOString();
      }

      const q = `
      SELECT *
      FROM vw_oil_usage_summary
      WHERE ($1::int IS NULL OR line_id = $1)
        AND usage_date >= $2::timestamp
        AND usage_date < $3::timestamp
      ORDER BY usage_date, oil_id;
    `;

      const result = await client.query(q, [line_id || null, start, end]);
      const rows = result.rows;

      // Format timestamp jika perlu
      rows.forEach((row) => {
        row.usage_date = moment(row.usage_date)
          .tz("Asia/Jakarta")
          .format("YYYY-MM-DD HH:mm:ss");
      });

      client.release();

      res.status(200).json({
        message: "Success to Get Gentani Summary",
        data: rows,
      });
    } catch (error) {
      console.error("Error getGentaniSummary:", error);
      res.status(500).json({
        message: "Failed to Get Gentani Summary",
        error: error.message,
      });
    }
  },
  getStdGentani: async (req, res) => {
    try {
      const { line_id, month } = req.query;

      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          message: "Invalid month format, use YYYY-MM",
        });
      }

      const monthStart = `${month}-01`;

      const q = `
      SELECT 
        t.*, 
        l.line_nm,
        m.oil_nm,
        d.target_id
      FROM tb_m_oil_targets_hist t
      LEFT JOIN tb_m_lines l ON l.line_id = t.line_id
      LEFT JOIN tb_m_oils m ON m.oil_id = t.oil_id
      LEFT JOIN tb_m_oil_targets d 
        ON d.line_id = t.line_id 
       AND d.oil_id = t.oil_id
      WHERE t.line_id = $1
        AND t.month >= $2::date
        AND t.month < ($2::date + INTERVAL '1 month')
      ORDER BY d.target_id DESC
    `;

      const result = await database.query(q, [line_id, monthStart]);

      res.status(200).json({
        message: "Success to Get Data",
        data: result.rows,
      });
    } catch (error) {
      console.error("Error getStdGentani:", error);
      res.status(500).json({
        message: "Failed to Get Data",
        error: error.message,
      });
    }
  },
  addStdGentani: async (req, res) => {
    try {
      const data = req.body;
      const queryLastId = await GET_LAST_ID("target_id", "tb_m_oil_targets");

      const client = await database.connect();
      const result = await client.query(queryLastId);
      const newId = result.rows[0].new_id;

      const insertQuery = `
        INSERT INTO tb_m_oil_targets (target_id, oil_id, line_id, gentani_val, plan_prod, created_dt, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *;
      `;
      const values = [
        newId,
        data.oil_id,
        data.line_id,
        data.gentani_val,
        data.plan_prod,
        moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss"),
        data.created_by,
      ];

      const { rows: userData } = await client.query(insertQuery, values);
      client.release();

      res.status(201).json({
        message: "Success to Add Data",
        data: userData,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to Add Data",
        error: error.message,
      });
    }
  },
  editStdGentani: async (req, res) => {
    const { target_id, oil_id, line_id, gentani_val, plan_prod, created_by } =
      req.body;
    console.log("reg.boy", req.body);

    if (!target_id) {
      return res.status(400).json({ message: "target_id wajib diisi" });
    }

    const client = await database.connect();

    try {
      await client.query("BEGIN");

      // ambil data lama untuk dibandingkan
      const { rows } = await client.query(
        `SELECT * FROM tb_m_oil_targets WHERE target_id = $1`,
        [target_id]
      );

      if (!rows.length) {
        await client.query("ROLLBACK");
        client.release();
        return res.status(404).json({ message: "Data tidak ditemukan" });
      }

      const old = rows[0];
      const now = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

      // 1. Update plan_prod → semua row sesuai line_id dari FE
      if (plan_prod !== undefined && plan_prod != old.plan_prod && line_id) {
        await client.query(
          `UPDATE tb_m_oil_targets 
         SET plan_prod = $1, created_dt = $2, created_by = $3
         WHERE line_id = $4`,
          [plan_prod, now, created_by || old.created_by, line_id]
        );
      }

      // 2. Update gentani_val / oil_id / line_id / created_by → hanya target_id
      const updateFields = {};

      if (gentani_val !== undefined && gentani_val != old.gentani_val)
        updateFields.gentani_val = gentani_val;

      if (oil_id !== undefined && oil_id != old.oil_id)
        updateFields.oil_id = oil_id;

      if (line_id !== undefined && line_id != old.line_id)
        updateFields.line_id = line_id;

      // selalu update created_by & created_dt jika ada input
      if (created_by !== undefined && created_by != old.created_by) {
        updateFields.created_by = created_by;
        updateFields.created_dt = now;
      }

      // jalankan updateRow jika ada field
      if (Object.keys(updateFields).length > 0) {
        await updateRow(
          "tb_m_oil_targets",
          "target_id",
          target_id,
          updateFields
        );
      }

      await client.query("COMMIT");

      // ambil data terbaru
      const { rows: updatedRows } = await client.query(
        `SELECT * FROM tb_m_oil_targets WHERE target_id = $1`,
        [target_id]
      );

      client.release();
      res
        .status(200)
        .json({ message: "Success Update Data", data: updatedRows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      client.release();
      console.error("Error editStdGentani:", error);
      res
        .status(500)
        .json({ message: "Failed to Update Data", error: error.message });
    }
  },
  deleteStdGentani: async (req, res) => {
    try {
      const { target_id } = req.params;
      console.log("target_id", target_id);

      const client = await database.connect();
      const result = await client.query(
        `DELETE FROM tb_m_oil_targets WHERE target_id = $1 RETURNING *`,
        [target_id]
      );
      client.release();
      res.status(200).json({ message: "Success to Delete Data", data: result });
    } catch (error) {
      res.status(500).json({
        message: "Failed to Delete Data",
        error: error.message,
      });
    }
  },
};
