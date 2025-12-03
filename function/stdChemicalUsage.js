const database = require("../config/storage");

async function getStdChemicalUsage(targetStart, clientParam = null) {
  const client = clientParam || (await database.connect());

  try {
    console.log("🔹 targetStart:", targetStart);

    // 1️⃣ Ambil STD line bulan target
    const stdQuery = `
      SELECT *
      FROM tb_m_oil_targets_hist
      WHERE month = $1
    `;
    const stdRes = await client.query(stdQuery, [targetStart]);

    const std_per_line = stdRes.rows.map((r) => ({
      line_id: r.line_id,
      oil_id: r.oil_id,
      std_value: parseFloat(r.gentani_val || 0) * parseFloat(r.plan_prod || 0),
    }));

    // Buat set untuk filter usage
    const validStdSet = new Set(
      std_per_line.map((s) => `${s.line_id}_${s.oil_id}`)
    );

    // 2️⃣ Ambil usage 3 bulan terakhir per mesin
    const startTarget = new Date(targetStart);
    const startRef = new Date(startTarget);
    startRef.setMonth(startRef.getMonth() - 3);

    const usageQuery = `
      SELECT u.machine_id,
             COALESCE(m.root_line_id, u.line_id) AS line_id,
             u.oil_id,
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

    // Ambil semua mesin di line untuk fallback
    const machineQuery = await client.query(
      `SELECT machine_id, COALESCE(root_line_id, line_id) AS line_id FROM tb_m_machines`
    );
    const machinePerLine = {};
    machineQuery.rows.forEach((m) => {
      if (!machinePerLine[m.line_id]) machinePerLine[m.line_id] = [];
      machinePerLine[m.line_id].push(m.machine_id);
    });

    // 3️⃣ Hitung STD per mesin proporsional
    const std_per_machine = [];

    std_per_line.forEach((lineStd) => {
      const { line_id, oil_id, std_value } = lineStd;
      const key = `${line_id}_${oil_id}`;

      const usageMachines = validUsage.filter(
        (u) => u.line_id === line_id && u.oil_id === oil_id
      );

      if (usageMachines.length > 0) {
        // Mesin ada usage → proporsional
        usageMachines.forEach((u) => {
          const total3Month = parseFloat(u.total_usage);
          const prop =
            totalUsagePerLineOil[key] > 0
              ? total3Month / totalUsagePerLineOil[key]
              : 0;
          const monthlyStd = (std_value * prop) / 3; // rata-rata bulanan

          // // 🔹 LOG INFO
          // console.log(
          //   `Machine ${u.machine_id} | Line ${line_id} | Oil ${oil_id} | ` +
          //     `Total 3 bulan: ${total3Month.toFixed(2)} | Prop: ${prop.toFixed(
          //       2
          //     )} | ` +
          //     `STD permesin : ${monthlyStd.toFixed(2)}`
          // );

          std_per_machine.push({
            machine_id: u.machine_id,
            line_id,
            oil_id,
            std_value: monthlyStd,
          });
        });
      } else {
        // Mesin baru / belum ada usage → bagi rata ke semua mesin di line
        const machinesInLine = machinePerLine[line_id] || [];
        const monthlyStd = std_value / (3 * machinesInLine.length); // rata-rata bulanan
        machinesInLine.forEach((machine_id) => {
          // console.log(
          //   `Machine ${machine_id} | Line ${line_id} | Oil ${oil_id} | ` +
          //     `No usage history → STD dibagi rata: ${monthlyStd.toFixed(2)}`
          // );

          std_per_machine.push({
            machine_id,
            line_id,
            oil_id,
            std_value: monthlyStd,
          });
        });
      }
    });

    return {
      std_per_line,
      std_per_machine,
    };
  } finally {
    if (!clientParam) client.release();
  }
}

module.exports = { getStdChemicalUsage };
