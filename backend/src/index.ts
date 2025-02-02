import http from "http";
import { Server, Socket } from "socket.io";

// key improvements -
// can improve the adding to queue logic on skipping and disconnection

const httpServer = http.createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

type Room = {
  p1: Socket;
  p2: Socket;
};

type RoomDetails = { roomId: number; room: Room; user1: Socket; user2: Socket };

let queue = new Array<Socket>(); // queue to store users waiting to get matched
const peerToRoom = new Map<Socket, number>(); //peer -> roomId
const rooms = new Map<number, Room>(); // roomId -> Room
const availableIds = new Array<number>(); // queue containg available roomIds
for (let i = 0; i < 100; i++) {
  availableIds.push(i);
}

io.on("connection", (socket: Socket) => {
  addUser(socket);
});

const addUser = (socket: Socket) => {
  queue.push(socket);
  addEventListener(socket);
  matchUsers();
};

const addEventListener = (socket: Socket) => {
  socket.on("skip", () => {
    handleSkip(socket);
  });

  socket.on("chat-message", (msg: string) => {
    handleChatMessage(socket, msg);
  });

  socket.on("ice-candidate", (candidate) => {
    handleIceCandidate(socket, candidate);
  });

  socket.on("offer", (offer) => {
    handleOffer(socket, offer);
  });

  socket.on("answer", (answer) => {
    handleAnswer(socket, answer);
  });

  socket.on("disconnect", () => {
    const roomDetails: void | RoomDetails = getRoomDetails(socket);
    if (!roomDetails) {
      //handle the case where on disconnection, user was in queue
      queue = queue.filter((user) => user !== socket);
      return;
    }
    if (roomDetails.user1 === socket) {
      queue.unshift(roomDetails.user2);
      roomDetails.user2.emit("pushed-to-queue");
    }
    if (roomDetails.user2 === socket) {
      roomDetails.user1.emit("pushed-to-queue");
      queue.unshift(roomDetails.user1);
    }
    peerToRoom.delete(roomDetails.user1);
    peerToRoom.delete(roomDetails.user2);
    rooms.delete(roomDetails.roomId);
    availableIds.push(roomDetails.roomId);
  });
};

const matchUsers = () => {
  if (queue.length < 2) return;

  const user1: Socket | undefined = queue.shift();
  const user2: Socket | undefined = queue.shift();
  if (user1 === undefined || user2 === undefined) {
    if (user1 !== undefined) {
      queue.unshift(user1);
    }
    if (user2 !== undefined) {
      queue.unshift(user2);
    }
    return;
  }
  const roomId: number | undefined = availableIds.shift();
  if (roomId === undefined) return;
  const newRoom: Room = {
    p1: user1,
    p2: user2,
  };
  rooms.set(roomId, newRoom);
  peerToRoom.set(user1, roomId);
  peerToRoom.set(user2, roomId);
  user1.emit("send-offer");
};

const handleSkip = (socket: Socket) => {
  const roomDetails: void | RoomDetails = getRoomDetails(socket);
  if (!roomDetails) return;
  //the one who skipped to the end of queue
  if (roomDetails.user1 === socket) {
    queue.push(roomDetails.user1);
    queue.unshift(roomDetails.user2);
  } else if (roomDetails.user2 === socket) {
    queue.push(roomDetails.user2);
    queue.unshift(roomDetails.user1);
  }
  roomDetails.user1.emit("pushed-to-queue");
  roomDetails.user2.emit("pushed-to-queue");
  //now the room does not exist
  availableIds.push(roomDetails.roomId);
  peerToRoom.delete(roomDetails.user1);
  peerToRoom.delete(roomDetails.user2);
  rooms.delete(roomDetails.roomId);
  matchUsers();
};

const handleChatMessage = (socket: Socket, msg: string) => {
  const roomDetails: void | RoomDetails = getRoomDetails(socket);
  if (!roomDetails) return;
  roomDetails.user1.emit("chat-message", { msg, sender: socket.id });
  roomDetails.user2.emit("chat-message", { msg, sender: socket.id });
};

const getRoomDetails = (socket: Socket): RoomDetails | void => {
  const roomId: number | undefined = peerToRoom.get(socket);
  if (roomId === undefined) return;
  const room: Room | undefined = rooms.get(roomId);
  if (room === undefined) return;
  const user1 = room.p1;
  const user2 = room.p2;
  return { roomId, room, user1, user2 };
};

const handleIceCandidate = (socket: Socket, candidate: RTCIceCandidate) => {
  const roomDetails: void | RoomDetails = getRoomDetails(socket);
  if (!roomDetails) return;
  if (roomDetails.user1 === socket) {
    roomDetails.user2.emit("ice-candidate", candidate);
  } else if (roomDetails.user2 === socket) {
    roomDetails.user1.emit("ice-candidate", candidate);
  }
};

const handleOffer = (socket: Socket, offer: string) => {
  const roomDetails: void | RoomDetails = getRoomDetails(socket);
  if (!roomDetails) return;
  if (roomDetails.user1 === socket) {
    roomDetails.user2.emit("offer", offer);
  } else if (roomDetails.user2 === socket) {
    roomDetails.user1.emit("offer", offer);
  }
};

const handleAnswer = (socket: Socket, answer: RTCSessionDescriptionInit) => {
  const roomDetails: void | RoomDetails = getRoomDetails(socket);
  if (!roomDetails) return;
  if (roomDetails.user1 === socket) {
    roomDetails.user2.emit("answer", answer);
  } else if (roomDetails.user2 === socket) {
    roomDetails.user1.emit("answer", answer);
  }
};

httpServer.listen(8080, () => {
  console.log("listening on port 8080");
});
