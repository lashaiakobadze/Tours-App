const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', err => {
  console.log('Uncaught Exception! 💥 Shouting down...');
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

// ზოგადი პრობლემატური error-ის დაჭერა.
process.on('unhandledRejection', () => {
  console.log('Unhandled Rejection! 💥 Shouting down...');
  // ყველა რექვესთზე დალოდება და ისე შეჩერება პროცესის.
  server.close(() => {
    process.exit(1);
  });
});

// მოცემული მიდლვეარი უზრუნველყობს შეტყობინებას, რომელიც გამოიწვევს
// heroku-ს სპეციფიკა, ყოველ 24 საათში გათიშვის სერვერის, ჩვენ ამ დროს ყველა პროცესს შევაჩერებთ.
process.on('SIGTERM', () => {
  console.log('🎈 SIGTERM RECEIVED. Shutting down gracefully.');
  server.close(() => {
    console.log('* Process terminated!');
  });
});
