const User = require("../models/User");
const asyncHandler = require("express-async-handler");

// Get all users (Admin only)
const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({});
  res.json(users);
});

// Delete User (Admin only)
const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    await user.deleteOne({ _id: req.params.id });
    res.json({ message: "User removed" });
  } else {
    res.status(404).json({ message: "User not found" });
  }
});




// Update User Role (Admin only)
const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  const user = await User.findById(req.params.id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (!["admin", "client", "driver"].includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }

  user.role = role;
  await user.save();

  res.json({ message: "User role updated successfully", user });
});



module.exports = { getUsers, deleteUser, updateUserRole };
