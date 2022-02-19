class AppError extends Error {
  constructor(message, statusCode) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    // isOperational დავამატოთ იმისათის, რადგაან გამოვარჩიოთ ბაგის გასხმები,
    // ჩვეულებრივი რექვესთის ერორისგან, რომელიც რევესთების დროს ხდება
    // შემოწმება მოხდება ამ ცვლადის არსებობის შემოწმებით.
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
