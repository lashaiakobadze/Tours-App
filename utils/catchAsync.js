// მოცემული მეთოდით კონტროლერების error-ებს try/catch-ის ნაცვლად
// გამოვიყენებთ და შევძლებთ ასინქრონულად დაჭერას, დაჭერილ error-ს next-ით
// გადავცემთ გლობალურ middleware-ს.
module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
