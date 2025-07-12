const express = require("express");
const {
  getAllStore,
  getStoreInformation,
  getAllDishInStore,
  getDetailDish,
} = require("../controllers/customerStore.controller");

const router = express.Router();

router.get("/", getAllStore);
router.get("/:store_id", getStoreInformation);

router.get("/:store_id/dish", getAllDishInStore);
router.get("/dish/:dish_id", getDetailDish);

module.exports = router;
