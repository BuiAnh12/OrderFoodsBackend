const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const {
  getAllStoreRating,
  getDetailRating,
  addStoreRating,
  editStoreRating,
  deleteStoreRating,
} = require("../controllers/rating.controller");

const router = express.Router();

router.get("/:storeId", validateMongoDbId("storeId"), getAllStoreRating);
router.get("/detail/:ratingId", validateMongoDbId("ratingId"), getDetailRating);

router.post("/add-rating", authMiddleware, validateMongoDbId("storeId"), addStoreRating);

router.put("/edit-rating/:ratingId", authMiddleware, validateMongoDbId("ratingId"), editStoreRating);

router.delete("/delete-rating/:ratingId", authMiddleware, validateMongoDbId("ratingId"), deleteStoreRating);

module.exports = router;
