const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleAuthMiddleware = require("../middlewares/roleAuthMiddleware");


const {
    getStoreCategories,
    getCategoryById,
    createCategory,
    updateCategoryById,
    deleteCategoryById,
} = require("../controllers/category.controller");

const router = express.Router();

// router.get("/store/:store_id", authMiddleware, roleAuthMiddleware(["owner", "employee", "manager"]), getStoreCategories);
router.get("/store/:store_id", getStoreCategories);

// router.post("/store/:store_id", authMiddleware, roleAuthMiddleware(["owner", "employee", "manager"]), getCategoryById); 
router.get("/:category_id", getCategoryById);

// router.post("/store/:store_id", authMiddleware, roleAuthMiddleware(["owner", "employee", "manager"]), createCategory);
router.post("/store/:store_id", createCategory);

// router.put("/:category_id", authMiddleware, roleAuthMiddleware(["owner", "employee", "manager"]), updateCategoryById);
router.put("/:category_id", updateCategoryById);

// router.delete("/:category_id", authMiddleware, roleAuthMiddleware(["owner", "employee", "manager"]), deleteCategoryById);
router.delete("/:category_id", deleteCategoryById);

module.exports = router

