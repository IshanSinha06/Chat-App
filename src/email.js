const nodemailer = require("nodemailer");
require("dotenv").config();

const sendEmail = async (option) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const emailOptions = {
      from: "Pokedex support<support@chatapp.com>",
      to: option.email,
      subject: option.subject,
      text: option.message,
    };

    await transporter.sendMail(emailOptions);
    console.log("Email sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

module.exports = sendEmail;
