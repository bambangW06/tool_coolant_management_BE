const {
  addPlanProd,
  getPlanProd,
} = require("../../controllers/PlanProd/PlanProd.controller");

var router = require("express").Router();

router.post("/add", addPlanProd);
router.get("/get", getPlanProd);
module.exports = router;
