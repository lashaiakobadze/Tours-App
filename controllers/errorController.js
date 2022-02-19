const AppError = require('./../utils/appError');

// mongo-ს ბაზის error-ის მოდიფიცირება.
const handleCastErrorDB = err => {
  const message = `Invalid ${err.path}: ${err.vale}.`;
  return new AppError(message, 400);
};

const handleDuplicateFieldDB = err => {
  const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];

  const message = `Duplicate field value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = err => {
  const errors = Object.values(err.error).map(el => el.message);

  const message = `Invalid input data. ${errors.json('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError('Invalid token, Please login in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please login in again!', 401);

const sendErrorDev = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack
    });
  }

  // B) RENDER WEBSITE
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message
  });
};

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // A) Operational, trusted error: send message to client
    if (err.isOperational) {
      return res.status(err.statusCode).json({
        status: err.status,
        message: err.message
      });
    }
    // B) Programing or other unknown error: dont't leak error details
    // 1) Log error
    console.error('ERROR 💥', err);

    // 2) Send generic message
    return res.status(500).json({
      status: 'error',
      message: 'Something went very wrong!'
    });
  }

  // B) RENDER WEBSITE
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message
    });
  }

  // B) Programing or other unknown error: dont't leak error details
  // 1) Log error
  console.error('ERROR 💥', err);

  // 2) Send generic message
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: 'Place try again later.'
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    let error = { ...err };
    error.message = err.message;

    // ბაზიდან წამოსული არსაწორი ობიექტის მოთხოვნის შემოწმაება.
    if (error.name === 'CastError') {
      error = handleCastErrorDB(error);
    }

    // ბაზიდან წამოსული დუბლიკაცისს შემოწმაება.
    if (error.code === 11000) {
      error = handleDuplicateFieldDB(error);
    }

    // ბაზიდან წამოსული განახლების შემოწმაება.
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }

    // token-ის error-ი.
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }

    // ვადაგასული token-ის error-ი.
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }

    sendErrorProd(error, req, res);
  }
};
