import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Chat = {
  message: string;
  sender: string;
};

const ChatArea = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const myStream = useRef<MediaStream | null>(null);
  const connection = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [message, setMessage] = useState<string>("");
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const otherVideoRef = useRef<HTMLVideoElement>(null);
  const currentOffer = useRef<any>(null);

  const getUserMedia = useCallback(async () => {
    try {
      console.log("Requesting media stream...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      console.log("Stream acquired");
      myStream.current = stream;
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
      }
      if (currentOffer.current) {
        const offer = currentOffer.current;
        currentOffer.current = null;
        await handleOffer(offer);
      }
    } catch (error) {
      console.error("Failed to get media stream:", error);
    }
  }, []);

  useEffect(() => {
    getUserMedia();
    const socket = io("http://localhost:8080");
    socketRef.current = socket;

    socket.on("send-offer", async () => {
      cleanUp();
      console.log("send-offer received by user1");
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      console.log("after getUserMedia", myStream.current);
      if (myStream.current) {
        myStream.current.getTracks().forEach((track) => {
          console.log(`Adding track: ${track.kind}`);
          pc.addTrack(track, myStream.current!);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { offer });
      console.log("offer sent to user2");

      pc.onicecandidate = ({ candidate }) => {
        console.log("ICE candidate received:", candidate);
        if (candidate) {
          socket.emit("ice-candidate", { candidate });
        }
      };

      console.log("pc before add track", pc);
      pc.ontrack = ({ track }) => {
        console.log("inside on track user 1");
        if (otherVideoRef.current && !otherVideoRef.current.srcObject) {
          console.log("new mediastream user1");
          otherVideoRef.current.srcObject = new MediaStream();
        }
        if (track.kind === "audio") {
          console.log(track.label);
          //@ts-ignore
          otherVideoRef.current.srcObject.addTrack(track);
          console.log("remote audio added");
        } else {
          console.log(track.label);
          //@ts-ignore
          otherVideoRef.current.srcObject.addTrack(track);
          console.log("remote video added");
        }
        console.log("Video element:", otherVideoRef.current);
        console.log("Video srcObject:", otherVideoRef.current?.srcObject);
        const mediaStream = otherVideoRef.current
          ?.srcObject as MediaStream | null;
        console.log("Video tracks:", mediaStream?.getTracks());
      };

      connection.current = pc;
    });

    socket.on("offer", async ({ offer }) => {
      cleanUp();
      if (!myStream.current) {
        currentOffer.current = offer;
        return;
      }

      await handleOffer(offer);
    });

    socket.on("answer", ({ answer }) => {
      console.log("answer received by user1");
      connection.current?.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", ({ candidate }) => {
      console.log("received-ice");
      connection.current?.addIceCandidate(candidate);
    });

    socket.on(
      "chat-message",
      ({ msg, sender }: { msg: string; sender: string }) => {
        console.log("chat msg received");
        setChats((prevChats) => [
          ...prevChats,
          { message: msg, sender: sender ?? "unknown" },
        ]);
      }
    );

    return () => {
      socket.disconnect();
      connection.current?.close();
    };
  }, []);

  const handleOffer = async (offer: any) => {
    console.log("offer received by user2");
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    console.log("above add stream user2");
    console.log("my stream", myStream.current);
    if (myStream.current) {
      console.log("inside add stream user2");
      myStream.current.getTracks().forEach((track) => {
        console.log(`Adding track: ${track.kind}`);
        pc.addTrack(track, myStream.current!);
      });
    }

    console.log("before on track user 2");
    pc.ontrack = ({ track }) => {
      console.log("inside on track user 2");
      if (otherVideoRef.current && !otherVideoRef.current.srcObject) {
        console.log("new mediastream user2");
        otherVideoRef.current.srcObject = new MediaStream();
      }
      if (track.kind === "audio") {
        //@ts-ignore
        otherVideoRef.current.srcObject.addTrack(track);
        console.log("remote audio added");
      } else {
        //@ts-ignore
        otherVideoRef.current.srcObject.addTrack(track);
        console.log("remote video added");
      }
    };

    await pc.setRemoteDescription(offer);
    console.log("remote set");
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    pc.onicecandidate = ({ candidate }) => {
      console.log("ICE candidate received:", candidate);
      if (candidate) {
        socketRef.current?.emit("ice-candidate", { candidate });
      }
    };

    connection.current = pc;
    socketRef.current?.emit("answer", { answer });
  };

  //free up connection to establish a new connection
  const cleanUp = () => {
    if (connection.current) {
      console.log("old conenction found");
      connection.current.onicecandidate = null;
      connection.current.ontrack = null;
      connection.current.onconnectionstatechange = null;
      connection.current.close();
      console.log("after connection close");
      connection.current = null;
    }

    const mediaStream = otherVideoRef.current?.srcObject as MediaStream | null;
    console.log(
      "Video tracks inside cleanup before:",
      mediaStream?.getTracks()
    );

    mediaStream?.getTracks().forEach((track) => {
      track.stop();
      mediaStream?.removeTrack(track);
    });
    console.log("Video tracks inside cleanup after:", mediaStream?.getTracks());

    setChats([]);
    setMessage("");
  };

  const handleSendMsg = () => {
    console.log("inside handle send msg");
    console.log(socketRef.current?.id);
    socketRef.current?.emit("chat-message", message);
    setMessage("");
    console.log("message sent");
  };

  const handleSkip = () => {
    console.log("clicked skip");
    socketRef.current?.emit("skip");
  };

  return (
    <div className="flex px-10 pt-6 h-[530px]  font-josfin">
      <div className="w-2/5 flex-col justify-center">
        <video
          className="h-64 rounded-t-lg mb-1"
          ref={myVideoRef}
          autoPlay
          playsInline
        />
        <video
          className="h-64 rounded-b-lg mt-1"
          ref={otherVideoRef}
          autoPlay
          playsInline
        />
      </div>
      <div className="w-3/5 flex flex-col ml-2 h-full">
        <div className="flex-1 overflow-y-auto mb-4">
          {chats.length === 0 ? (
            <h1>Send a message</h1>
          ) : (
            chats.map((chat) => {
              return (
                <div className="flex justify-start">
                  <h3 className="font-bold">
                    {chat.sender === socketRef.current?.id
                      ? "You:"
                      : "Stranger:"}
                  </h3>
                  <h3 className="ml-1 font-normal">{chat.message}</h3>
                </div>
              );
            })
          )}
        </div>
        <div className="flex flex-row w-full">
          <button
            className="bg-black text-white font-semibold w-16 rounded-sm mr-1"
            onClick={handleSkip}
          >
            skip
          </button>
          <div className="flex-1 border-2 border-black rounded-sm">
            <input
              className="w-full p-3"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="type..."
            ></input>
          </div>
          <button
            className="bg-black text-white font-semibold w-16 rounded-sm ml-1"
            onClick={handleSendMsg}
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
