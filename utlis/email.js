const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  // 1 create a transporter
  const transporter = nodemailer.createTransport({
    host: 'smtp.mailtrap.io',
    port: 2525,
    auth: {
      user: 'b1edb52d205419',
      pass: 'fc571675c16a21',
    },
  });
  // 2 define the email options
  const mailOptions = {
    from: 'Subodh Adhikari <subodh18feb1990@gmail.com',
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  // send the email with nodemailer
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
