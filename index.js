const express = require("express");
const { createServer } = require("node:http");
const { Server } = require("socket.io");

const app = express();

app.get("/", (req, res) => {
  res.json({ message: true });
});

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
  transports: ["websocket"],
});

let connectedUsers = new Map();
let messages = [];

let last_offer = 0;

let timeLeft = 0;
let intervalId;

let auction_details = {
  title: "",
  description: "",
  image: "",
};

const startTimer = () => {
  if (timeLeft != 0) {
    intervalId = setInterval(() => {
      timeLeft -= 1;
      io.emit("timeUpdate", timeLeft);
      if (timeLeft <= 0) {
        clearInterval(intervalId);
      }
    }, 1000);
  }
};

const resetTimer = (additionalTime) => {
  if (intervalId) {
    clearInterval(intervalId);
  }
  timeLeft += additionalTime;
  startTimer();
};

io.on("connection", (socket) => {
  socket.emit("timeUpdate", timeLeft);

  socket.on("is_finished_auction", () => {
    timeLeft = 0;
    clearInterval(intervalId);
    io.emit("timeUpdate", timeLeft);
    io.emit("is_finished_auction", true);
  });

  socket.on("start_auction", (details) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const auctionEndTime = details.endDate; // saniye cinsinden zaman
    auction_details = {
      title: details.title,
      description: details.description,
      image: details.image,
    };

    // Auction süresini hesapla (son tarih - şu anki zaman)
    timeLeft = auctionEndTime - currentTime;

    messages = [];
    last_offer = Number(details.startPrice);
    io.emit("timeUpdate", timeLeft);
    io.emit("messages", messages);
    io.emit("offer", last_offer);
    io.emit("auction_details", auction_details);
    io.emit("is_finished_auction", false);
    startTimer();
  });

  socket.on("login", (username) => {
    connectedUsers.set(socket.id, username);
    io.emit("messages", messages);
    io.emit("offer", last_offer);
    console.log(`User ${username} connected with ID: ${socket.id}`);
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    io.emit("usersCount", connectedUsers.size);
    console.log(
      "A user disconnected from server, connected users:",
      connectedUsers.size
    );
  });

  socket.on("offer", (offer) => {
    if (timeLeft != 0) {
      const username = connectedUsers.get(socket.id) || "Unknown User";
      let current_offer = last_offer;
      last_offer += Number(offer);
      const message = `${username} increased the bid from $${current_offer} to $${last_offer} (+ $${offer})`;
      messages.push(message);
      io.emit("messages", messages);
      io.emit("offer", last_offer);
      if (timeLeft <= 60) {
        // Eğer kalan süre 1 dakikadan azsa
        resetTimer(180); // 3 dakika ekle
      }
    }
  });

  //   socket.on("message", (msg) => {
  //     messages.push(msg);
  //     io.emit("messages", messages);
  //   });
});

server.listen(3000, () => {
  console.log("server running at http://localhost:3000");
  startTimer();
});
