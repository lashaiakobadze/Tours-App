const crypto = require('crypto'); // ვიყენებთ კრიპტისათვის, არ სჭირდება დაინსტალირება node_modules-შია.
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    require: [true, 'Please tell us your name!']
  },
  email: {
    type: String,
    require: [true, 'Please provide us your email'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please provide a valid email!']
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user'
  },
  password: {
    type: String,
    require: [true, 'Please provide a valid password!'],
    minLength: 8,
    // select: false რადგან ბაზიდან წამუსული დატისათვის არ ჩანდეს პაროლები.
    select: false
  },
  passwordConfirm: {
    type: String,
    require: [true, 'Please confirm your password!'],
    validate: {
      // This only works on CREATE and SAVE!!!
      validator: function(el) {
        return el === this.password;
      },
      message: 'Password are not the same!'
    }
  },
  // დავამატეთ ტოკენის შესამოწმებლად, შეცვლილი პაროლის შესადარებლად
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  }
});

// // ვიყენებთ pre middleware-ს რადგან მოხდეს ბაზაში შენახვამდე და ბაზიდან წამოსვლის შემდეგ.
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  // პაროლის ჰეშირება, 12 უკეთესად კრიპტავს მაგრამ მეტი დრო უნდა ვიდრე 10-ს, რომელიც დეფაულტად აქვს.
  // ჰეშირება ჯობია ასინქრონულად, რადგან ლუპი არ დაბლოკოს.
  this.password = await bcrypt.hash(this.password, 12);
  // განმეორებითი პაროლი არ ინახება ბაზაში ამიტომ გავუტლოთ undefined-ს.
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function(next) {
  // this.isNew ვნახო დოკუმენტაციაში 💢💢💢
  if (!this.isModified('password') || this.isNew) {
    return next();
  }

  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// middleware-ი რომელიც გაფილტრავს ქუერის პოვნამდე.
userSchema.pre('/^find/', function(next) {
  // this points to the current query
  this.find({ active: { $ne: false } });
  next();
});

// ბაზიდან წამოსული დაკრიპტული პაროლის შემოწმება,
// ჩვენ ვიყენებთ bcrypt.compare რადგან შევძლოთ დაჰეშირებულის შედარება, რომელიც ალგორითმს იყენებს აღსადგენად.
// აბრუნებს ბულიანს.
userSchema.methods.correctPassword = async function(
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// თუ ტოკენის დროის გასვლამდე შეიცვალა პაროლი, მაინც არ ავმუშავოთ ფუნქციონალი.
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    // console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp;
  }

  // False means NOT changed password
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  // დროებითი ტოკენის გასაკეთებლად მაილზე გასაგზავნად.
  const resetToken = crypto.randomBytes(32).toString('hex');

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
