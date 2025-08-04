const express = require("express");
const authMiddleware = require("../middlewares/authMiddleware");
const validateMongoDbId = require("../middlewares/validateMongoDBId");
const { addAnEmployee, getEmployeeById, updateEmployee, getAllEmployeesInStore, deleteEmployee } = require("../controllers/staff.controller");
const router = express.Router();

// api/v1/staff/stores/123123/employees
router.post("/stores/:storeId", addAnEmployee);
router.get("/:userId", getEmployeeById); // lấy 1 nhân viên
router.put("/:userId", updateEmployee); // cập nhật
router.delete("/stores/:storeId/:userId", deleteEmployee); // xóa
router.get("/stores/:storeId", getAllEmployeesInStore);

module.exports = router;
