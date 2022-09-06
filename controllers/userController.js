const User = require('../models/userModel');
const catchAsync = require('../utlis/catchAsync');
const AppError = require('../utlis/appError');

const handlerFactory = require('./handlerFactory');

const filterFunction = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowedFields.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

// user updating his/her data
exports.updateMe = catchAsync(async (req, res, next) => {
  // req.user is send from protect middleware, req.body is send by the user
  // 1) create error if user POST password data
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for updating password. Please use updatePassword route!',
        400
      )
    );
  }

  // 2) filter out unwanted fields that are not allowed to be updated
  const filteredBody = filterFunction(req.body, 'name', 'email');

  // 3) update the user
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser,
    },
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'succes',
    data: null,
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not yet defined. Please use signup instead',
  });
};

exports.getAllUsers = handlerFactory.getAll(User);
exports.getSingleUser = handlerFactory.getOne(User);
// admin updating other users, do not update password
exports.updateUser = handlerFactory.updateOne(User);
// admin deleting other users
exports.deleteUser = handlerFactory.deleteOne(User);
