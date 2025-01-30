import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Chat = {
  message: string;
  sender: string;
};

const ChatArea = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  // const [myVideo, setMyVideo] = useState<MediaStreamTrack | null>(null);
  // const [myAudio, setMyAudio] = useState<MediaStreamTrack | null>(null);
  const myStream = useRef<MediaStream | null>(null);
  const [, setOtherVideo] = useState<MediaStreamTrack | null>(null);
  const [, setOtherAudio] = useState<MediaStreamTrack | null>(null);
  const [connection, setConnection] = useState<RTCPeerConnection | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState<string>("");
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const otherVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      // .then((stream) => {
      //   const audio = stream.getAudioTracks()[0];
      //   const video = stream.getVideoTracks()[0];
      //   setMyVideo(video);
      //   setMyAudio(audio);
      //   if (myVideoRef.current) {
      //     myVideoRef.current.srcObject = new MediaStream([video]);
      //     myVideoRef.current.play();
      //   }
      // });
      .then((stream) => {
        myStream.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }
      });
  }, []);

  //setup websocket connection
  //get user media
  //setup webrtc connection
  useEffect(() => {
    const socket = io("http://localhost:8080");
    setSocket(socket);

    socket.on("send-offer", async () => {
      console.log("send-offer received by user1");
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // if (myAudio) {
      //   console.log("audio added");
      //   pc.addTrack(myAudio);
      // }
      // if (myVideo) {
      //   console.log("video added");
      //   pc.addTrack(myVideo);
      // }
      if (myStream.current) {
        myStream.current.getTracks().forEach((track) => {
          console.log(`Adding track: ${track.kind}`);
          pc.addTrack(track, myStream.current!);
        });
      }
      // pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { offer });
      console.log("offer sent to user2");
      // };

      pc.onicecandidate = ({ candidate }) => {
        console.log("ICE candidate received:", candidate);
        if (candidate) {
          socket.emit("ice-candidate", { candidate });
        }
      };

      pc.ontrack = ({ track }) => {
        if (track.kind === "audio") {
          setOtherAudio(track);
          if (otherVideoRef.current?.srcObject) {
            //@ts-ignore
            otherVideoRef.current.srcObject.addTrack(track);
          }
        } else {
          setOtherVideo(track);
          //@ts-ignore
          otherVideoRef.current.srcObject.addTrack(track);
        }
      };

      setConnection(pc);
    });

    socket.on("offer", async ({ offer }) => {
      console.log("offer received by user2");
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      await pc.setRemoteDescription(offer);
      console.log("remote set");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // if (myAudio) {
      //   console.log("audio added");
      //   pc.addTrack(myAudio);
      // }
      // if (myVideo) {
      //   console.log("video added");
      //   pc.addTrack(myVideo);
      // }

      if (myStream.current) {
        myStream.current.getTracks().forEach((track) => {
          console.log(`Adding track: ${track.kind}`);
          pc.addTrack(track, myStream.current!);
        });
      }

      pc.onicecandidate = ({ candidate }) => {
        console.log("ICE candidate received:", candidate);
        if (candidate) {
          socket.emit("ice-candidate", { candidate });
        }
      };

      pc.ontrack = ({ track }) => {
        if (track.kind === "audio") {
          setOtherAudio(track);
          if (otherVideoRef.current?.srcObject) {
            //@ts-ignore
            otherVideoRef.current.srcObject.addTrack(track);
          }
        } else {
          setOtherVideo(track);
          //@ts-ignore
          otherVideoRef.current.srcObject.addTrack(track);
        }
      };

      setConnection(pc);
      socket.emit("answer", { answer });
    });

    socket.on("answer", ({ answer }) => {
      console.log("answer received by user1");
      setConnection((connection) => {
        console.log("Current signaling state:", connection?.signalingState);
        connection?.setRemoteDescription(answer).then(() => {
          console.log("remote set");
        });
        return connection;
      });
    });

    socket.on("ice-candidate", ({ candidate }) => {
      console.log("received-ice");
      setConnection((connection) => {
        connection?.addIceCandidate(candidate);
        return connection;
      });
    });

    socket.on(
      "chat-message",
      ({ msg, sender }: { msg: string; sender: Socket }) => {
        setChats((prevChats) => [
          ...prevChats,
          { message: msg, sender: sender.id ?? "unknown" },
        ]);
      }
    );

    return () => {
      socket.disconnect();
      connection?.close();
    };
  }, []);

  // useEffect(() => {
  //   if (!connection) return;

  //   const interval = setInterval(() => {
  //     console.log("ICE Connection State:", connection.iceConnectionState);
  //     console.log("Signaling State:", connection.signalingState);
  //   }, 2000);

  //   return () => clearInterval(interval);
  // }, [connection]);

  const handleSendMsg = () => {
    socket?.emit("chat-message", message);
    setMessage("");
  };

  return (
    <div>
      <div className="flex-col justify-center">
        <video ref={myVideoRef} autoPlay playsInline />
        <video ref={otherVideoRef} autoPlay playsInline />
      </div>
      <div>
        <div className="flex-col">
          {chats.map((chat) => {
            return <li>{chat.message}</li>;
          })}
        </div>
        <div>
          <input
            onChange={(e) => setMessage(e.target.value)}
            placeholder="type"
          ></input>
          <button onClick={handleSendMsg}>send</button>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
