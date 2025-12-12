var database = require("../config/storage");

module.exports = {
  getEmployees: async (req, res) => {
    try {
      // Validasi input searchName
      // const searchName = req.query.searchName ? req.query.searchName.trim() : '';

      // Menggunakan prepared statement untuk mencegah SQL injection
      let q = `SELECT *, profile AS photourl FROM tb_m_employees`;
      const client = await database.connect();
      const userDataQuery = await client.query(q);
      const userData = userDataQuery.rows;
      client.release();

      // Logging untuk memeriksa data karyawan sebelum dikirim (opsional)
      // console.log("Data karyawan yang dikirim ke frontend:", userData);

      // Kirim respons dengan data karyawan yang ditemukan
      res.status(200).json({
        message: "Success to Get Data",
        data: userData,
      });
    } catch (error) {
      // Penanganan kesalahan dengan pesan kesalahan yang lebih deskriptif
      console.error("Error fetching employee data:", error);
      res.status(500).json({
        message: "Failed to Get Data",
      });
    }
  },

  getSupervisor: async (req, res) => {
    try {
      const jabatan = "Section Head";
      const q = `SELECT *, profile AS photourl FROM tb_m_employees WHERE jabatan = $1`;
      const client = await database.connect();
      const userDataQuery = await client.query(q, [jabatan]);
      const userData = userDataQuery.rows;
      // console.log("userData", userData);

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
};
