const mongoose = require("mongoose");
const crypto = require("crypto");

// Connect the node to the mongodb database with the name "Chatbot".

mongoose
  .connect("mongodb+srv://ishansinha1990:Impossible1234@cluster0.pclav4r.mongodb.net/?retryWrites=true&w=majority")

  // When it is connected
  .then(() => {
    console.log("mongodb connected");
  })

  // When it is not connected.
  .catch(() => {
    console.log("Connection failed!");
  });

// Create a schema.
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  is_online: {
    type: String,
    default: 0,
  },
  temporaryPassword: { type: String },
  temporaryPasswordExpires: { type: Date },
});

//  Creating new schema inside user schema which will hold the new password token.
userSchema.methods.createResetPasswordToken = function () {
  // This reset token will not be encrpted.
  const resetToken = crypto.randomBytes(12).toString("hex");

  // Encrypting the reset token.
  this.temporaryPassword = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.temporaryPasswordExpires = Date.now() + 10 * 60 * 1000;

  console.log(
    `reset token in hex ${resetToken} and encrpted is ${this.temporaryPassword}`
  );

  return resetToken;
};

const collection = new mongoose.model("User", userSchema);

module.exports = collection;
