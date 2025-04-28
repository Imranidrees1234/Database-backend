
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const multer = require("multer");
const path = require("path");
const Image = require("./models/Image");

dotenv.config();
connectDB();

const app = express();
// const httpServer = http.createServer(app);
// const socketServer = http.createServer();
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://admin-panel-sage-iota.vercel.app/login",
      "https://client-app-rouge.vercel.app/dashboard",
      "https://driver-app-blue.vercel.app/",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// const io = new Server(socketServer, {
//   cors: {
//     origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
//     methods: ["GET", "POST"]
//   }
// });

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
  methods: ["GET", "POST", "DELETE", "PUT"],
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Namespaces for better management
const adminNamespace = io.of("/admin");
const clientNamespace = io.of("/client");
const driverNamespace = io.of("/driver");

let clients = {};
let admins = {};
let drivers = {};

// WebRTC and WebSocket Handling
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  socket.on("register_admin", (adminId) => {
    admins[adminId] = socket.id;
    console.log(`📌 Admin registered: ${adminId}`);
  });

  socket.on("register_driver", (driverId) => {
    drivers[driverId] = socket.id;
    console.log(`📌 Driver registered: ${driverId}`);
  });

  socket.on("request_video", ({ adminId, driverId }) => {
    if (drivers[driverId]) {
      console.log(`📡 Admin ${adminId} requesting video from Driver ${driverId}`);
      io.to(drivers[driverId]).emit("start_video_stream", { adminId });
    }
  });

  socket.on("send_offer", ({ signal, adminId, driverId }) => {
    if (admins[adminId]) {
      io.to(admins[adminId]).emit("receive_offer", { signal, driverSocket: socket.id });
    }
  });

  socket.on("send_ice_candidate", ({ candidate, adminId }) => {
    if (admins[adminId]) {
      io.to(admins[adminId]).emit("receive_ice_candidate", { candidate });
    }
  });

  socket.on("send_answer", ({ signal, driverSocket }) => {
    io.to(driverSocket).emit("receive_answer", { signal });
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    Object.keys(drivers).forEach((id) => { if (drivers[id] === socket.id) delete drivers[id]; });
    Object.keys(admins).forEach((id) => { if (admins[id] === socket.id) delete admins[id]; });
  });
});

// Admin WebSocket Handling
adminNamespace.on("connection", (socket) => {
    console.log("✅ Admin connected:", socket.id);

    socket.on("registerAdmin", (adminId) => {
        admins[adminId] = socket.id;
        socket.join(adminId);
        console.log(`✅ Admin ${adminId} registered.`);
    });

    socket.on("approveRequest", (data) => {
        if (clients[data.clientId]) {
            console.log(`✅ Approving request for ${data.clientId}`);
            clientNamespace.to(clients[data.clientId]).emit("requestStatus", { message: "✅ Request Approved" });
        }
    });

    socket.on("denyRequest", (data) => {
        if (clients[data.clientId]) {
            console.log(`❌ Denying request for ${data.clientId}`);
            clientNamespace.to(clients[data.clientId]).emit("requestStatus", { message: "❌ Request Denied" });
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ Admin disconnected: ${socket.id}`);
        delete admins[Object.keys(admins).find(id => admins[id] === socket.id)];
    });
});


clientNamespace.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    socket.on("registerClient", (clientId) => {
        clients[clientId] = socket.id;
        socket.join(clientId);
        console.log(`✅ Client ${clientId} registered.`);
    });

    socket.on("sendRequest", (data) => {
        console.log("📩 Request received from client:", data);

        if (admins[data.adminId]) {
            console.log(`📤 Forwarding request to admin ${data.adminId}`);
            adminNamespace.to(admins[data.adminId]).emit("imageRequest", { clientId: data.clientId });
        } else {
            console.log("❌ Admin is not online");
            socket.emit("requestStatus", { message: "❌ Admin is not online" });
        }
    });

    socket.on("requestLocation", (data) => {
        console.log("📩 Location request received from client:", data);
        if (admins[data.adminId]) {
            adminNamespace.to(admins[data.adminId]).emit("locationRequest", { clientId: data.clientId });
        } else {
            socket.emit("requestStatus", { message: "❌ Admin is not online" });
        }
    });

    socket.on("requestImage", (data) => {
        console.log("📩 Image request received from client:", data);
        if (admins[data.adminId]) {
            adminNamespace.to(admins[data.adminId]).emit("imageRequest", { clientId: data.clientId });
        } else {
            socket.emit("requestStatus", { message: "❌ Admin is not online" });
        }
    });

    socket.on("disconnect", () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
        delete clients[Object.keys(clients).find(id => clients[id] === socket.id)];
    });
});

// Driver WebSocket Handling
driverNamespace.on("connection", (socket) => {
  socket.on("sendLocation", (data) => {
    clientNamespace.to(data.clientId).emit("receiveLocation", data);
  });
});

// Image Upload API
app.post("/api/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    const imageUrl = `http://localhost:5005/uploads/${req.file.filename}`;
    const newImage = new Image({ imageUrl });
    await newImage.save();
    res.status(201).json({ message: "Image uploaded", imageUrl });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Fetch Images API
app.get("/api/images", async (req, res) => {
  try {
    const images = await Image.find();
    res.status(200).json({ images });
  } catch (error) {
    res.status(500).json({ message: "Failed to load images" });
  }
});

// const PORT_API = 5005;
// const PORT_SOCKET = 5006;

const PORT = process.env.PORT || 5005;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

// socketServer.listen(PORT_SOCKET, () => console.log(`🔌 WebSocket server running on port ${PORT_SOCKET}`));












// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const connectDB = require("./config/db");

// dotenv.config();
// connectDB();

// const app = express();
// const httpServer = http.createServer(app);
// const io = new Server(httpServer, {
//   cors: {
//     origin: [
//       "http://localhost:3000",
//       "http://localhost:3001",
//       "http://localhost:3002",
//     ],
//     methods: ["GET", "POST"],
//   },
// });

// app.use(cors({
//   origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
//   methods: ["GET", "POST", "DELETE", "PUT"],
//   credentials: true,
// }));
// app.use(express.json());

// const adminNamespace = io.of("/admin");
// const clientNamespace = io.of("/client");
// const driverNamespace = io.of("/driver");

// let clients = {};
// let admins = {};
// let drivers = {};

// io.on("connection", (socket) => {
//   console.log("✅ User connected:", socket.id);

//   socket.on("register_admin", (adminId) => {
//     admins[adminId] = socket.id;
//     console.log(`📌 Admin registered: ${adminId}`);
//   });

//   socket.on("register_driver", (driverId) => {
//     drivers[driverId] = socket.id;
//     console.log(`📌 Driver registered: ${driverId}`);
//   });

//   socket.on("register_client", (clientId) => {
//     clients[clientId] = socket.id;
//     console.log(`📌 Client registered: ${clientId}`);
//   });

//   socket.on("request_video", ({ adminId, driverId }) => {
//     if (drivers[driverId]) {
//       console.log(`📡 Admin ${adminId} requesting video from Driver ${driverId}`);
//       io.to(drivers[driverId]).emit("start_video_stream", { adminId });
//     }
//   });

//   socket.on("send_offer", ({ signal, adminId, driverId }) => {
//     if (admins[adminId]) {
//       io.to(admins[adminId]).emit("receive_offer", { signal, driverSocket: socket.id });
//     }
//   });

//   socket.on("send_ice_candidate", ({ candidate, adminId }) => {
//     if (admins[adminId]) {
//       io.to(admins[adminId]).emit("receive_ice_candidate", { candidate });
//     }
//   });

//   socket.on("send_answer", ({ signal, driverSocket }) => {
//     io.to(driverSocket).emit("receive_answer", { signal });
//   });

//   socket.on("sendRequest", ({ clientId, adminId }) => {
//     if (admins[adminId]) {
//       console.log(`📩 Client ${clientId} requesting video from Admin ${adminId}`);
//       io.to(admins[adminId]).emit("client_request_video", { clientId });
//     } else {
//       console.log(`❌ Admin ID ${adminId} not found.`);
//     }
//   });
  

//   socket.on("approve_request_client", ({ clientId }) => {
//     if (clients[clientId]) {
//       console.log(`✅ Admin approved video request for Client ${clientId}`);
//       io.to(clients[clientId]).emit("start_client_video");
//     }
//   });

//   socket.on("disconnect", () => {
//     console.log("❌ User disconnected:", socket.id);
//     Object.keys(drivers).forEach((id) => { if (drivers[id] === socket.id) delete drivers[id]; });
//     Object.keys(admins).forEach((id) => { if (admins[id] === socket.id) delete admins[id]; });
//     Object.keys(clients).forEach((id) => { if (clients[id] === socket.id) delete clients[id]; });
//   });
// });

// const PORT = process.env.PORT || 5005;
// httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
