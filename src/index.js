const express = require("express");
const app = express(); // To start the express.js
const path = require("path");
const collection = require("./mongodb");
const CryptoJS = require("crypto-js");
const sendEmail = require("./email");
const crypto = require("crypto");
require("dotenv").config();
const viewsPath = path.join(__dirname, "../views");
const session = require("express-session");
const auth = require("./auth");
const socketIo = require("socket.io");
const cors = require("cors");
const Chat = require("./chat");

// Variables used.
const { SESSION_SECRET } = process.env;

app.use(cors());
app.use(express.json()); // for parsing application/json

app.use(session({ secret: SESSION_SECRET })); // for user session

app.set("views", viewsPath);

// Defining that view engine is hbs.
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

// Use static file to link css, js and other files.
app.use(express.static("public"));

// Get method to fetch the desired route.//
// For root route
app.get("/", auth.isLogout, (req, res) => {
  res.render("login", { alertMessage: "" });
});

// For SignUp.
app.get("/signup", auth.isLogout, (req, res) => {
  res.render("signup", { alertMessage: "" });
});

app.get("/forgot", (req, res) => {
  res.render("forgot", { alertMessage: "" });
});

// Backend route for temporary.
app.get("/temporary/:token", (req, res) => {
  const token = req.params.token;
  // Render temporary.hbs and pass the token to the template
  res.render("temporary", { token }, { alertMessage: "" });
});

// For dashboard
app.get("/dashboard", auth.isLogin, async (req, res) => {
  try {
    const users = await collection.find({
      _id: { $nin: [req.session.user._id] },
    });
    res.render("dashboard", { user: req.session.user, users: users });
  } catch (error) {
    console.log(error.message);
  }
});

//////////////////////////////////
// Backend routes/Post requests.//
// For SignUp
app.post("/signup", async (req, res) => {
  const data = {
    name: req.body.name,
    password: req.body.password,
    email_ID: req.body.email,
  };

  const check = await collection.findOne({ name: req.body.name });

  // Check for existing username
  if (check && check.name === data.name) {
    return res.render("signup", {
      alertMessage: "Please select another username.",
    });
  }

  // Check if email exists
  const checkEmail = await collection.findOne({ email: req.body.email });
  if (checkEmail) {
    return res.render("signup", {
      alertMessage: "Email already exists. Please use another email.",
    });
  }

  console.log(
    `data name ${data.name}, data password ${data.password} and mail is ${checkEmail}`
  );
  // Encrypt the password
  const encryptedPassword = CryptoJS.AES.encrypt(
    data.password,
    "Pass!123$"
  ).toString();

  // Create an object with the encrypted password
  const encryptedData = {
    name: data.name,
    password: encryptedPassword,
    email: data.email_ID,
  };

  // Insert the encrypted data into the collection
  await collection.insertMany(encryptedData);

  res.redirect("/");
});

// For LogIn
app.post("/login", async (req, res) => {
  try {
    const checkUser = await collection.findOne({ name: req.body.name });

    if (!checkUser) {
      // If user doesn't exist
      return res.render("login", { alertMessage: "Incorrect username!" });
    }

    // const isPasswordMatch = checkUser.password === req.body.password;
    const decryptedPassword = CryptoJS.AES.decrypt(
      checkUser.password,
      "Pass!123$"
    ).toString(CryptoJS.enc.Utf8);

    if (decryptedPassword === req.body.password) {
      const userId = checkUser._id;

      req.session.user = checkUser;
      //   return res.render("dashboard", { userId });
      return res.redirect("/dashboard");
    } else {
      return res.render("login", { alertMessage: "Incorrect password!" });
    }
  } catch {
    res.redirect("/signup");
  }

  //   res.render("dashboard", { user: req.session.user });
  res.redirect("/dashboard");
});

// For forgot password
app.post("/forgot", async (req, res) => {
  // Get the username and email address. In out case the email id is same for all.
  const checkUser = await collection.findOne({ name: req.body.name });
  const checkEmail = await collection.findOne({ email: req.body.email });

  if (checkEmail && checkUser) {
    // Generating temporary password and it's expiration time and storing it in the DB.
    const resetToken = checkEmail.createResetPasswordToken();
    await checkEmail.save({ validateBeforeSave: false });

    // This sends the reset token to the email.
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/temporary/${resetToken}`;

    console.log(resetURL);

    const message = `We have received a password reset request.\nPlease use the below link to reset your password.\n\n${resetURL}\n\nThe temporary password is ${resetToken}\n\nThis reset password link will expire in the next 10 minutes.\n\n\nThanks,\nTeam Pokedex.`;

    console.log(message);

    try {
      await sendEmail({
        email: checkEmail.email,
        subject: "Request Password Change",
        message: message,
      });

      res.status(200).render("forgot", {
        status: "success",
        alertMessage: "Reset password link sent successfully!",
      });
    } catch (error) {
      checkEmail.temporaryPassword = undefined;
      checkEmail.temporaryPasswordExpires = undefined;
      await checkEmail.save({ validateBeforeSave: false });

      return res.status(500).render("forgot", {
        alertMessage:
          "An error occurred while processing your request, please try again after some time.",
      });
    }
  } else {
    // If email is not correct.
    return res.render("forgot", {
      alertMessage: "Incorrect email address or username",
    });
  }
});

// Backend route for Password Reset.
app.post("/temporary/:token", async (req, res) => {
  const token = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  console.log(`token is ${token}, line 298`);

  // This checks for the target user and also the password expiration time.
  const user = await collection.findOne({
    temporaryPassword: token,
    temporaryPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    console.log(`user not match line 307`);
    return res.status(500).render("/temporary/:token", {
      alertMessage:
        "An error occurred while processing your request.\nPlease try again after some time.",
    });
  }

  console.log(
    `user is ${user}, req body temporaryPassword ${
      req.body.temporaryPassword
    } type is ${typeof req.body.temporaryPassword}, line 315`
  );

  const encryptedTemporaryPassword = crypto
    .createHash("sha256")
    .update(req.body.temporaryPassword)
    .digest("hex");

  console.log(`encrypted is ${encryptedTemporaryPassword}, line 266`);

  console.log(
    `user.temporaryPassword ${user.temporaryPassword} and encryptedTemporaryPassword ${encryptedTemporaryPassword} line 263`
  );

  if (user.temporaryPassword !== encryptedTemporaryPassword) {
    console.log(
      `user.temporaryPassword ${user.temporaryPassword} and encryptedTemporaryPassword ${encryptedTemporaryPassword} line 268 when temp pass not equal.`
    );
    return res.render("temporary", {
      alertMessage: "Temporary password doesn't match. Please try again.",
    });
  }

  // Check if the new password and confirmation password matches
  const newPassword = req.body.newPassword;
  const confirmPassword = req.body.confirmPassword;

  if (newPassword !== confirmPassword) {
    console.log(`password not match, line 280`);
    return res.render("temporary", {
      alertMessage: "Passwords do not match",
    });
  }

  // Temporary password matches, update user password
  user.password = CryptoJS.AES.encrypt(newPassword, "Pass!123$").toString();
  user.confirmPassword = confirmPassword;
  user.temporaryPassword = undefined;
  user.temporaryPasswordExpires = undefined;

  await user.save();

  console.log(`before redirecting to login, line 301`);
  // Redirecting to the login page after successfully updating the password.
  res.redirect("/");
});

// For Logout.
app.get("/logout", auth.isLogin, (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

////////////////////////////////////////////////
// Open the web application on the port "4000".
const server = app.listen(4000, () => {
  console.log("Port connect");
});

const io = socketIo(server, {
  cors: {
    origin: "http://localhost:4000",
    credential: true,
  },
});

// Create custom name-space.
const csp = io.of("/chat-namespace");

// When user is online.
csp.on("connection", async function (socket) {
  console.log("User Connected");

  let userId = socket.handshake.auth.token;

  await collection.findByIdAndUpdate(
    { _id: userId },
    { $set: { is_online: "1" } }
  );

  // Broadcast user online status
  socket.broadcast.emit("getOnlineUser", { user_id: userId });

  // When user is offline
  socket.on("disconnect", async function () {
    console.log("User disconnected");

    await collection.findByIdAndUpdate(
      { _id: userId },
      { $set: { is_online: "0" } }
    );

    // Broadcast user offline status
    socket.broadcast.emit("getOfflineUser", { user_id: userId });
  });

  // Get the receiver data sent sent by the sender from the frontend
  socket.on("newChat", function (data) {
    console.log(`newChat data is ${data.message}`);
    socket.broadcast.emit("loadNewChat", data);
  });

  // Load existing chats
  socket.on("existingChat", async function (data) {
    let existingChats = await Chat.find({
      $or: [
        { sender_id: data.sender_id, receiver_id: data.receiver_id },
        { sender_id: data.receiver_id, receiver_id: data.sender_id },
      ],
    });

    socket.emit("loadOldChats", { chats: existingChats });
  });

  // Delete chats from the other user's end
  socket.on("chatDelete", function (id) {
    socket.broadcast.emit("chatMessageDelete", id);
  });
});

////////////////////////////////////////////////
// To save chats
app.post("/save-chat", async (req, res) => {
  try {
    var chat = new Chat({
      sender_id: req.body.sender_id,
      receiver_id: req.body.receiver_id,
      message: req.body.message,
    });

    console.log(chat);
    const newChat = await chat.save();
    console.log(newChat.receiver_id);
    res.status(200).send({ success: true, msg: "Chat saved", data: newChat });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
});

// To delete chat
app.post("/delete-chat", async (req, res) => {
  try {
    await Chat.deleteOne({ _id: req.body.id });
    res.status(200).send({ success: true });
  } catch (error) {
    res.status(400).send({ success: false, msg: error.message });
  }
});
