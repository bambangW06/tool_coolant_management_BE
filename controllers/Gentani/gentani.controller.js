var database = require("../../config/storage");
var moment = require("moment-timezone");

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
};
