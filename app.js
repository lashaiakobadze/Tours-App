const path = require('path'); // ფაილური სტრუქტურასთან სამუშაო აგრეგატი.
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

// Start express app
const app = express();

// დავამტეთ, პროდაქშენზე cookieOptions.secure-ის გასამართად.
// კონკრეტულად 'x-forwarded=proto'-თვის, რომ ამოიკითხოს მნიშვნელობა.
app.enable('trust proxy');

// view engine რაც ერთგვარი პროტოკოლია პროდაქშენზე ჩვენი კოდის გასაპარსად.
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) MIDDLEWARES
// Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers
// app.use(helmet());

//Add the following
// Further HELMET configuration for Security Policy (CSP)
const scriptSrcUrls = [
  'https://api.tiles.mapbox.com/',
  'https://api.mapbox.com/',
  'https://cdnjs.cloudflare.com/',
  'https://js.stripe.com/'
];
const styleSrcUrls = [
  'https://api.mapbox.com/',
  'https://api.tiles.mapbox.com/',
  'https://fonts.googleapis.com/'
];
const connectSrcUrls = [
  'https://api.mapbox.com/',
  'https://a.tiles.mapbox.com/',
  'https://b.tiles.mapbox.com/',
  'https://events.mapbox.com/',
  'https://*.stripe.com'
];
const fontSrcUrls = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'https://*.stripe.com'
];
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: [],
      connectSrc: [
        "'self'",
        'blob:',
        ...connectSrcUrls,
        `ws://localhost:8080/`, // ვამატებთ ბანდლერის დროს.
        'https://*.mapbox.com'
      ],
      scriptSrc: [
        "'self'",
        ...scriptSrcUrls,
        'https://*.cloudflare.com',
        'https://*.mapbox.com',
        'data:'
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        // 'https:',
        ...styleSrcUrls
        // 'unsafe-inline'
      ],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: [],
      imgSrc: ["'self'", 'blob:', 'data:'],
      fontSrc: [
        "'self'",
        // 'https:',
        ...fontSrcUrls
        // 'data:'
      ],

      // defaultSrc: ["'self'", 'data:', 'blob:'],

      // baseUri: ["'self'"],

      // scriptSrc: ["'self'", 'https://*.stripe.com'],

      frameSrc: ["'self'", 'https://*.stripe.com']

      // objectSrc: ["'none'"],

      // workerSrc: ["'self'", 'data:', 'blob:'],

      // childSrc: ["'self'", 'blob:'],

      // upgradeInsecureRequests: [],
    }
  })
);

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, PUT, DELETE, OPTIONS'
  );
  next();
});

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many request from this IP, please try again in an hour!'
});
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
// დავიცავთ თავს იუზერიდან შემუსული mongo-ს კოდისგან, რომელსაც დასელექტება შეძლება დატის.
app.use(mongoSanitize());

// Data sanitization against XSS
// HTML კოდის დაბლოკვა შემოსული დატისათვის.
app.use(xss());

// Prevent parameter pollution
// პარამეტრების კონტროლი გამეორების შემთხვევაში, რომელიც არჩევს ერთიდაიგვე შემოსულებიდან ბოლოს
// თუ გვინდა განმეორებადი პარამეტრი ჩავსვათ whitelist-ში.
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsAverage',
      'ratingsQuantity',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  })
);

app.use(compression());

// Test middleware 😂
app.use((req, res, next) => {
  // console.log(req.cookies);
  next();
});

// 3) ROUTES
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// error handling middleware for all http methods
app.all('*', (req, res, next) => {
  // res.status(404).json({
  //   status: 'fail',
  //   message: `Can't find ${req.originalUrl}`
  // });

  // const err = new Error(`Can't find ${req.originalUrl}`);
  // err.status = 'fail';
  // err.statusCode = 404;

  // თუ next-ში ჩავსვამთ პარამეტრს, ის ავტომატურად აგენერეირებს ერორს,
  // რომელიც skip-ავს ყველა middleware-ს და გვიგზავნის error-ს, error handling middleware-ში.
  next(new AppError(`Can't find ${req.originalUrl}`), 404);
});

// global error handling middleware, from express
// which have 4 parameter and automatically know this middleware.
app.use(globalErrorHandler);

module.exports = app;
