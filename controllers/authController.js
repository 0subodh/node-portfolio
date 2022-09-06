const crypto = require('crypto');
const jwt = require('jsonwebtoken');
// const { promisify } = require('util');
const User = require('../models/userModel');
const catchAsync = require('../utlis/catchAsync');
const AppError = require('../utlis/appError');
const sendEmail = require('../utlis/email');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

const createAndSendToken = (user, statusCode, res) => {
  const token = generateToken(user._id);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user,
    },
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
  });

  createAndSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  console.log(email, password);

  // 1 check if email and password exists
  if (!email || !password) {
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2 check if user exist and password is correct
  const user = await User.findOne({ email: email }).select('+password');
  console.log(user.name, user.email);

  // correctPassword is an instance method defined in the userSchema
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3 if everything is ok, send token to the client
  createAndSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1 check if the token is present and if it's there get it
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  console.log(token);

  if (!token) {
    return next(new AppError('You are not Logged In, Please Log In', 401));
  }

  // 2 verification of token, getting payload which is _id in our case
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  console.log('decoded ', decoded);

  // 3 check if user still exists
  const currentUser = await User.findById(decoded.id);
  console.log('fresh-user logged');
  console.log(currentUser);

  if (!currentUser) {
    return next(
      new AppError('The User belonging to this token does not exist', 401)
    );
  }

  // 4 check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again', 401)
    );
  }

  // grant access to protected route
  req.user = currentUser;
  next();
});

exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(`You don't have permission to perform this action`, 403)
      );
    }
    next();
  };

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1 get user based on posted email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with the given email.', 404));
  }

  // 2 generate random reset token and store encrypted form of reset token in database
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3 send it to users email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  console.log('resetURL', resetURL);

  const message = `Forgot your password? \n Submit a PATCH request with your new password and passwordConfirm to ${resetURL}.\n If you didn't forget your password please ignore this mail!`;
  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token( Valid for 10 mins)',
      message,
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email',
    });
  } catch (err) {
    user.createPasswordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(
      new AppError(
        'There was an error sending the email. Try again later!',
        500
      )
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1 get user based on the token, token is the only thing that can identify user at this point
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2 if token has not expired, and there is user, set the password
  if (!user) {
    return next(new AppError('Token is invalid or expired', 400));
  }
  console.log(user);
  user.password = req.body.password;
  console.log(user.password);
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 3 update passwordChangedAt property for the user
  // done in userModel in pre save middleware

  // 4 log the user in, send JWT
  createAndSendToken(user, 200, res);
});

exports.updatePassword = async (req, res, next) => {
  // 1. get user from collection(user is logged in)
  const user = await User.findById(req.user.id).select('+password');

  // 2. check if the POSTed current password is correct
  if (!user.correctPassword(req.body.currentPassword, user.password)) {
    return next(new AppError('Current password is wrong!', 401));
  }

  // 3. if so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();

  // 4. log user in, send JWT
  createAndSendToken(user, 200, res);
};
