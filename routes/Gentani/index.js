const {
  getSummaryGentani,
  getStdGentani,
  addStdGentani,
  editStdGentani,
  deleteStdGentani,
} = require("../../controllers/Gentani/gentani.controller");

var router = require("express").Router();

router.get("/summary", getSummaryGentani);
router.get("/std", getStdGentani);
router.post("/add", addStdGentani);
router.put("/edit", editStdGentani);
router.delete("/delete/:target_id", deleteStdGentani);

module.exports = router;
