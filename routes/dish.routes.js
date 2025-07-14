const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const roleAuthMiddleware = require("../middlewares/roleAuthMiddleware");
const {
    getDishById,
    getDishesByStoreId,
    createDish,
    changeStatus,
    updateDish,
    deleteDish

} = require("../controllers/dish.controller");

const router = express.Router();

router.get("/:dish_id", getDishById);
// router.get("/store/:store_id", authMiddleware, roleAuthMiddleware(["admin", "employee"]), getDishesByStoreId);
router.get("/store/:store_id", getDishesByStoreId);
// router.post("/store/:store_id", authMiddleware, roleAuthMiddleware(["admin", "employee"]), createDish); 
router.post("/store/:store_id", createDish); 



// router.put("/:dish_id", authMiddleware, roleAuthMiddleware(["admin", "employee"]), updateDish); 
router.put("/:dish_id", updateDish); 
// router.delete("/:dish_id", authMiddleware, roleAuthMiddleware(["admin", "employee"]), deleteDish);
router.delete("/:dish_id", deleteDish);

// router.post("/:dish_id/status", authMiddleware, roleAuthMiddleware(["admin", "employee"]), changeStatus);
router.post("/:dish_id/status", changeStatus);
module.exports = router;
