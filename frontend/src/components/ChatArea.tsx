import { useCallback, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
const loading = "/loading.mp4";

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
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);

  const getUserMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      myStream.current = stream;
      if (myVideoRef.current) {
        const onlyVideoStream = new MediaStream();
        onlyVideoStream.addTrack(stream.getVideoTracks()[0]);
        myVideoRef.current.srcObject = onlyVideoStream;
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
    otherVideoRef.current!.src = loading;
    getUserMedia();
    const socket = io("http://localhost:8080");
    socketRef.current = socket;

    socket.on("send-offer", async () => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      if (myStream.current) {
        myStream.current.getTracks().forEach((track) => {
          pc.addTrack(track, myStream.current!);
        });
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("offer", { offer });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit("ice-candidate", { candidate });
        }
      };

      pc.ontrack = ({ track }) => {
        if (otherVideoRef.current && !otherVideoRef.current.srcObject) {
          otherVideoRef.current.srcObject = new MediaStream();
        }
        if (track.kind === "audio") {
          //@ts-ignore
          otherVideoRef.current.srcObject.addTrack(track);
        } else {
          //@ts-ignore
          otherVideoRef.current.srcObject.addTrack(track);
        }
      };

      connection.current = pc;
    });

    socket.on("offer", async ({ offer }) => {
      if (!myStream.current) {
        currentOffer.current = offer;
        return;
      }

      await handleOffer(offer);
    });

    socket.on("answer", ({ answer }) => {
      connection.current?.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", ({ candidate }) => {
      connection.current?.addIceCandidate(candidate);
    });

    socket.on(
      "chat-message",
      ({ msg, sender }: { msg: string; sender: string }) => {
        setChats((prevChats) => [
          ...prevChats,
          { message: msg, sender: sender ?? "unknown" },
        ]);
      }
    );

    socket.on("pushed-to-queue", () => {
      cleanUp();
    });

    return () => {
      socket.disconnect();
      connection.current?.close();
    };
  }, []);

  const handleOffer = async (offer: any) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    if (myStream.current) {
      myStream.current.getTracks().forEach((track) => {
        pc.addTrack(track, myStream.current!);
      });
    }

    pc.ontrack = ({ track }) => {
      if (otherVideoRef.current && !otherVideoRef.current.srcObject) {
        otherVideoRef.current.srcObject = new MediaStream();
      }
      if (track.kind === "audio") {
        //@ts-ignore
        otherVideoRef.current.srcObject.addTrack(track);
      } else {
        //@ts-ignore
        otherVideoRef.current.srcObject.addTrack(track);
      }
    };

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    pc.onicecandidate = ({ candidate }) => {
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
      connection.current.onicecandidate = null;
      connection.current.ontrack = null;
      connection.current.onconnectionstatechange = null;
      connection.current.close();
      connection.current = null;
    }

    const mediaStream = otherVideoRef.current?.srcObject as MediaStream | null;

    mediaStream?.getTracks().forEach((track) => {
      track.stop();
      mediaStream?.removeTrack(track);
    });
    otherVideoRef.current!.srcObject = null;
    otherVideoRef.current!.src = loading;

    setChats([]);
    setMessage("");
  };

  const handleSendMsg = () => {
    socketRef.current?.emit("chat-message", message);
    setMessage("");
  };

  const handleSkip = () => {
    socketRef.current?.emit("skip");
  };

  const toggleMute = () => {
    const audioTrack = myStream.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
    }
  };

  return (
    <div className="flex px-10 pt-6 h-[530px]  font-josfin">
      <div className="w-2/5 flex-col justify-center">
        <video
          className="w-full h-64 rounded-t-lg mb-1 object-fill"
          ref={myVideoRef}
          autoPlay
          playsInline
        />
        <video
          className="w-full h-64 rounded-b-lg mt-1 object-fill"
          ref={otherVideoRef}
          autoPlay
          playsInline
          loop
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
            onClick={toggleMute}
          >
            {audioEnabled ? "mute" : "unmute"}
          </button>
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
