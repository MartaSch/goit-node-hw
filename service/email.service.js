const sgMail = require('@sendgrid/mail');
require('dotenv').config();
sgMail.setApiKey(process.env.API_KEY);

const send = async (email, verificationToken) => {

const msg = {
    to: email,
    from: 'marscha8903@gmail.com',
    subject: 'Email verification',
    text: `Hello, please click on the link to verify your email:
    http://localhost:3000/api/users/verify/${verificationToken}`
};

return await sgMail
  .send(msg)
  .then(() => {
    console.log('Email sent successfully');
  })
  .catch(error => {
    console.error(error);
  });
}
module.exports = {
    send,
}
