const nodemailer = require('nodemailer');
const pug = require('pug');
const htmlToText = require('html-to-text');

// new Email(user, url).sendWelcome();

module.exports = class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Lasha Iakobadze <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Sendgrid
      return nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_USERNAME,
          pass: process.env.SENDGRID_PASSWORD
        }
      });
    }

    // 1) Create a transporter:
    // მოცემულ შემთხვევაში ვიყენებთ https://mailtrap.io/ რომელიც ამარტივებს სერვისს,
    // თუ გამოვიყებედით gmail-ს მას აქვს 500 ტრანზაქციის უფლება დღეში და ჩვენი აპლიკაცია დაისპამება
    // თუ 500-ზე მეტს გავაგზავნით.
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_port,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  // Send the actual email
  async send(template, subject) {
    // 1) Render HTML based on a pug template
    const html = pug.renderFile(`${__dirname}/../views/email/${template}.pug`, {
      firstName: this.firstName,
      url: this.url,
      subject
    });

    // 2) Define email options
    const mailOPtions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText.fromString(html)
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOPtions);
  }

  async sendWelcome() {
    await this.send('welcome', `Welcome to the Natures Family`);
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      `Your password reset token (valid for only 10 minutes)`
    );
  }
};

// const sendEmail = async options => {
//   // 1) Create a transporter:
//   // მოცემულ შემთხვევაში ვიყენებთ https://mailtrap.io/ რომელიც ამარტივებს სერვისს,
//   // თუ გამოვიყებედით gmail-ს მას აქვს 500 ტრანზაქციის უფლება დღეში და ჩვენი აპლიკაცია დაისპამება
//   // თუ 500-ზე მეტს გავაგზავნით.
//   const transport = nodemailer.createTransport({
//     host: process.env.EMAIL_HOST,
//     port: process.env.EMAIL_port,
//     auth: {
//       user: process.env.EMAIL_USERNAME,
//       pass: process.env.EMAIL_PASSWORD
//     }
//   });

//   2) Define the email options
//   const mailOPtions = {
//     from: 'Lasha Iakobadze lashaiakobadze98@gmail.com',
//     to: options.email,
//     subject: options.subject,
//     text: options.message
//     //   html:
//   };
//   3) Actually send the email
//   await transport.sendMail(mailOPtions);
// };

// module.exports = sendEmail;
