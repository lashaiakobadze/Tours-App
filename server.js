const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', err => {
  console.log('Uncaught Exception! ๐ฅ Shouting down...');
  console.log(err.name, err.message);

  process.exit(1);
});

dotenv.config({ path: './config.env' });
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<password>',
  process.env.DATABASE_PASSWORD
);

mongoose
  // .connect(process.env.DATABASE_LOCAL, {
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
  })
  .then(() => {
    console.log('DB connection successful!');
  });

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

// แแแแแแ แแ แแแแแแแขแฃแ แ error-แแก แแแญแแ แ.
process.on('unhandledRejection', () => {
  console.log('Unhandled Rejection! ๐ฅ Shouting down...');
  // แงแแแแ แ แแฅแแแกแแแ แแแแแแแแ แแ แแกแ แจแแฉแแ แแแ แแ แแชแแกแแก.
  server.close(() => {
    process.exit(1);
  });
});

// แแแชแแแฃแแ แแแแแแแแ แ แฃแแ แฃแแแแแงแแแก แจแแขแงแแแแแแแแก, แ แแแแแแช แแแแแแฌแแแแก
// heroku-แก แกแแแชแแคแแแ, แงแแแแ 24 แกแแแแจแ แแแแแจแแแก แกแแ แแแ แแก, แฉแแแ แแ แแ แแก แงแแแแ แแ แแชแแกแก แจแแแแฉแแ แแแ.
process.on('SIGTERM', () => {
  console.log('๐ SIGTERM RECEIVED. Shutting down gracefully.');
  server.close(() => {
    console.log('* Process terminated!');
  });
});
