const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, req, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: req.secure || req.headers('x-forwarded=proto') === 'https'
  };

  // secure: true ამ ნაწილს ვააქტიურებთ პროდაქშენზე სადაც ვიყენებთ https-ს.
  // დეველოპმენტის დროს
  // if (process.env.NODE_ENV === 'production') {
  //   cookieOptions.secure = true;
  // }

  // პრობა დავამატეთ heroku-ს სპეციფიკის მიხედვით
  // cookieOptions.secure = req.secure || req.headers('x-forwarded=proto') === 'https';

  // Remove password from output. პაროლის დამალვა res-ში, რეგისტრაციისას.
  user.password = undefined;

  res.cookie('jwt', token, cookieOptions);

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

// მოცემულ შემთხვევაში, ჩვენ ვაგზავნით cookie-ს ტოკენის გარეშე
// httpOnly: true, არის მეტად დაული მიდგომა, და უბრალოდ ტოკენის ამოშლა საქმეს არ გააკეთებს.
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedOut', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role
  });

  // რეგსიტრაციისას მაილზე ვგზავნით ფორმას,
  // რომელზეც შევძლებთ გადასვლას და ავტორიზაციას.
  const url = `${req.protocol}://${req.get(`host`)}/me`;
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    // return რადგან error-ის შემთხვევაში არ გააგრძელოს ფუნქციის სხვა ნაწილების შესრულება.
    return next(new AppError('Please provide email and password!', 400));
  }

  // 2) Check if user exists and password is correct
  // select('+password'), რადგან დამალული ფასვორდი ამოვიღოთ ბაზიდან ამ როუთზე.
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // 3) If everting ok, and send token to client
  createSendToken(user, 200, req, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it'd there
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }
  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists, მაგა: ტოკენი გვაქს მაგრამ იუზერი წაიშალა, მაშინ დატა აღარ უნდა წამოვიდეს ტოკენით.
  const freshUser = await User.findById(decoded.id);
  if (!freshUser) {
    return next(
      new AppError('The user belong to this token does no longer exist.', 401)
    );
  }

  // 4) Check if user change passwords after the token was issued
  if (freshUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401)
    );
  }

  // Grant Access To Protected Route
  req.user = freshUser;
  res.locals.user = freshUser;
  // console.log(freshUser);
  next();
});

// only for rendered pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      // 1) verify token
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );

      // 3) Check if user still exists, მაგა: ტოკენი გვაქს მაგრამ იუზერი წაიშალა, მაშინ დატა აღარ უნდა წამოვიდეს ტოკენით.
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 4) Check if user change passwords after the token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next();
      }

      // THERE IS A LOGGED IN USER
      res.locals.user = currentUser;
      return next();
    } catch (err) {
      return next();
    }
  }
  next();
};

// არგუმენტიანი middleware-ი როლებისათვის.
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['lead-guide', 'admin']. role = 'user'
    // ვინაიდან protect-ის მერე ეშვება role-ზე წვდომა გვექნება!
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email.
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token.
  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  try {
    // const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\n If you didn't forgot your password, please ignore this email.`;
    // await Email({
    //   email: user.email,
    //   subject: 'Your password reset token (valid for 10 min)',
    //   message
    // });

    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPasswords/${resetToken}`;

    // მაილზე ფასვორდის აღდგენის ფორმის გაგზავნა.
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    user.passwordResetToken = undefined;
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
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError('Token is invalid or expired', 400));
  }

  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  // 3) Update changedPasswordAt property for user

  // 4) Log the user in, send JWT
  createSendToken(user, 200, req, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, req, res);
});
