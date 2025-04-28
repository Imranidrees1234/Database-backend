const express = require("express");
const {
  getUsers,
  deleteUser,
  updateUserRole,
} = require("../controllers/userController");
const { protect, admin } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", protect, admin, getUsers);
router.delete("/:id", protect, admin, deleteUser);
router.put("/:id/role", protect, admin, updateUserRole); // New endpoint

module.exports = router;
