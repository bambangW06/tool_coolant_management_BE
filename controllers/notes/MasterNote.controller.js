var database = require("../../config/storage");
const moment = require("moment-timezone");
const GET_LAST_ID = require("../../function/GET_LAST_ID");
const updateRow = require("../../function/edit");

module.exports = {
  addMasterNote: async (req, res) => {
    try {
      const data = req.body;
      const queryLastId = GET_LAST_ID("note_id", "tb_m_usage_note");
      const client = await database.connect(); // Pastikan Anda menggunakan `database.connect()`
      const result = await client.query(queryLastId); // Menjalankan query untuk mendapatkan hasil
      const newId = result.rows[0].new_id;
      const q = `INSERT INTO tb_m_usage_note (note_id, note_nm, note_desc, created_by, created_dt) 
      VALUES ($1, $2, $3, $4, $5) RETURNING *`;
      const values = [
        newId,
        data.note_nm,
        data.note_desc,
        data.created_by,
        data.created_dt,
      ];

      const userDataQuery = await client.query(q, values);
      const userData = userDataQuery.rows;
      client.release();
      res.status(201).json({
        message: "Success to Add Data",
        data: userData,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: "Failed to Add Data",
      });
    }
  },
  getMasterNote: async (req, res) => {
    try {
      const notesUsed = req.query.notesUsed;
      console.log("notesUsed", notesUsed);

      let q = "";
      if (notesUsed) {
        q = `SELECT * FROM tb_m_usage_note WHERE deleted_dt IS NULL ORDER BY note_id ASC`;
      } else {
        q = `SELECT * FROM tb_m_usage_note WHERE deleted_dt IS NULL ORDER BY note_id DESC`;
      }
      const client = await database.connect();
      const userDataQuery = await client.query(q);
      const userData = userDataQuery.rows;
      client.release();
      res.status(200).json({
        message: "Success to Get Data",
        data: userData,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to Get Data",
      });
    }
  },
  editMasterNote: async (req, res) => {
    try {
      const note_id = req.body.note_id;
      const updated = await updateRow(
        "tb_m_usage_note", // nama tabel
        "note_id", // primary key
        note_id, // value pk
        req.body // data baru dari FE
      );

      // kalau gak ada perubahan
      if (!updated || updated.message === "No changes detected") {
        return res.status(200).json({
          message: "No changes detected",
        });
      }

      res.status(200).json({
        message: "Success to update data",
        data: updated,
      });
    } catch (err) {
      console.error("Error updating note:", err);
      res.status(500).json({
        message: "Failed to update data",
      });
    }
  },
  deleteMasterNote: async (req, res) => {
    try {
      const note_id = req.params.id;
      const deleted_by = "admin"; // nanti bisa diganti dari token user login
      const deleted_dt = moment()
        .tz("Asia/Jakarta")
        .format("YYYY-MM-DD HH:mm:ss");

      console.log("Delete params:", req.params);
      console.log("note_id:", note_id);

      const q = `
        UPDATE tb_m_usage_note
        SET deleted_by = $1,
            deleted_dt = $2
        WHERE note_id = $3
        RETURNING *;
      `;
      const values = [deleted_by, deleted_dt, note_id];

      const client = await database.connect();
      const result = await client.query(q, values);
      client.release();

      console.log("Query rowCount:", result.rowCount);
      console.log("Query result:", result.rows);

      // kalau berhasil
      res.status(200).json({
        message: "Success to Delete Data",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({
        message: "Failed to Delete Data",
        error: error.message,
      });
    }
  },
};
