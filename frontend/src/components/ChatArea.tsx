import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type Chat = {
  message: string;
  sender: Socket;
};

const ChatArea = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [myVideo, setMyVideo] = useState<MediaStreamTrack | null>(null);
  const [myAudio, setMyAudio] = useState<MediaStreamTrack | null>(null);
  const [, setOtherVideo] = useState<MediaStreamTrack | null>(null);
  const [, setOtherAudio] = useState<MediaStreamTrack | null>(null);
  const [, setConnection] = useState<RTCPeerConnection | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState<string>("");
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const otherVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        const audio = stream.getAudioTracks()[0];
        const video = stream.getVideoTracks()[0];
        setMyVideo(video);
        setMyAudio(audio);
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = new MediaStream([video]);
          myVideoRef.current.play();
        }
      });
  }, []);

  //setup websocket connection
  //get user media
  //setup webrtc connection
  useEffect(() => {
    const socket = io("http://localhost:8080");
    setSocket(socket);

    socket.on("send-offer", () => {
      const pc = new RTCPeerConnection();
      setConnection(pc);

      if (myAudio) {
        pc.addTrack(myAudio);
      }
      if (myVideo) {
        pc.addTrack(myVideo);
      }

      pc.onnegotiationneeded = async () => {
        const offer = await pc.createOffer();
        pc.setLocalDescription(offer);
        socket.emit("offer", { offer });
      };

      pc.onicecandidate = ({ candidate }) => {
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
    });

    socket.on(
      "offer",
      async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
        const pc = new RTCPeerConnection();
        pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        pc.setLocalDescription(answer);

        pc.onicecandidate = ({ candidate }) => {
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

        socket.emit("answer", { answer });
      }
    );

    socket.on("answer", ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      setConnection((connection) => {
        connection?.setRemoteDescription(answer);
        return connection;
      });
    });

    socket.on(
      "ice-candidate",
      ({ candidate }: { candidate: RTCIceCandidate }) => {
        setConnection((connection) => {
          connection?.addIceCandidate(candidate);
          return connection;
        });
      }
    );

    socket.on(
      "chat-message",
      ({ msg, sender }: { msg: string; sender: Socket }) => {
        setChats((prevChats) => [...prevChats, { message: msg, sender }]);
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [myAudio, myVideo]);

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
        <div>
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
