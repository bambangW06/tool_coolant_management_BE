const {
  getSummaryGentani,
} = require("../../controllers/Gentani/gentani.controller");

var router = require("express").Router();

router.get("/get", getSummaryGentani);

module.exports = router;
