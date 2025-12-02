const database = require("../config/storage");

async function getStdChemicalUsage(targetStart, clientParam = null) {
  const client = clientParam || (await database.connect());

  try {
    console.log("🔹 targetStart:", targetStart);

    // 1️⃣ Ambil semua STD per line sesuai bulan
    const stdQuery = `
      SELECT *
      FROM tb_m_oil_targets_hist
      WHERE month = $1
    `;
    const stdRes = await client.query(stdQuery, [targetStart]);

    // --- STD per line (sudah dikali plan_prod dari hist) ---
    const std_per_line = stdRes.rows.map((r) => ({
      line_id: r.line_id,
      oil_id: r.oil_id,
      std_value: parseFloat(r.gentani_val || 0) * parseFloat(r.plan_prod || 0),
    }));

    // console.log("🔹 std_per_line:", std_per_line);

    // Buat set cepat untuk filter usage
    const validStdSet = new Set(
      std_per_line.map((s) => `${s.line_id}_${s.oil_id}`)
    );

    // 2️⃣ STD per mesin: proporsional dari usage 3 bulan terakhir
    const startTarget = new Date(targetStart);
    const startRef = new Date(startTarget);
    startRef.setMonth(startRef.getMonth() - 3);

    const usageQuery = `
      SELECT u.machine_id, COALESCE(m.root_line_id, u.line_id) AS line_id, u.oil_id,
             SUM(u.oil_volume::numeric) AS total_usage
      FROM tb_r_oil_usage AS u
      LEFT JOIN tb_m_machines AS m ON u.machine_id = m.machine_id
      WHERE u.created_dt >= $1
        AND u.created_dt < $2
      GROUP BY u.machine_id, COALESCE(m.root_line_id, u.line_id), u.oil_id
    `;
    const usageRes = await client.query(usageQuery, [
      startRef.toISOString().slice(0, 10) + " 07:00:00",
      startTarget.toISOString().slice(0, 10) + " 07:00:00",
    ]);

    // Filter usage hanya untuk oil_id yang ada di STD
    const validUsage = usageRes.rows.filter((r) =>
      validStdSet.has(`${r.line_id}_${r.oil_id}`)
    );

    // Hitung total usage per line & oil untuk proporsi
    const totalUsagePerLineOil = {};
    validUsage.forEach((r) => {
      const key = `${r.line_id}_${r.oil_id}`;
      totalUsagePerLineOil[key] =
        (totalUsagePerLineOil[key] || 0) + parseFloat(r.total_usage);
    });

    // Hitung STD per mesin proporsional
    const std_per_machine = validUsage.map((r) => {
      const lineStd = std_per_line.find(
        (s) => s.line_id === r.line_id && s.oil_id === r.oil_id
      );
      const stdLineValue = lineStd ? lineStd.std_value : 0;
      const key = `${r.line_id}_${r.oil_id}`;
      const prop =
        totalUsagePerLineOil[key] > 0
          ? parseFloat(r.total_usage) / totalUsagePerLineOil[key]
          : 0;
      return {
        machine_id: r.machine_id,
        line_id: r.line_id,
        oil_id: r.oil_id,
        std_value: stdLineValue * prop,
      };
    });
    // console.log("🔹 std_per_mesin:", std_per_machine);
    return {
      std_per_line,
      std_per_machine,
    };
  } finally {
    if (!clientParam) client.release();
  }
}

module.exports = { getStdChemicalUsage };
