var database = require("../../config/storage");
const moment = require("moment-timezone");

module.exports = {
  getHistoryKuras: async (req, res) => {
    try {
      const machine_id = req.params.machine_id;
      console.log("machine_id", machine_id);

      let q = `SELECT * FROM tb_r_schedules WHERE machine_id = $1 ORDER BY actual_dt DESC`;

      const client = await database.connect();
      const userDataQuery = await client.query(q, [machine_id]);
      console.log("query", userDataQuery);

      const userData = userDataQuery.rows;

      client.release();

      res.status(200).json({
        message: "Success to Get Data",
        data: userData,
      });
    } catch (error) {
      res.status(500).json({
        message: "Failed to Get Data",
        error: error,
      });
    }
  },
};
