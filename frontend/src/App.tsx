import "./App.css";
import LandingPage from "./components/LandingPage";
import ChatArea from "./components/ChatArea";
import { useState } from "react";

function App() {
  const [start, setStart] = useState<boolean>(false);

  return (
    <div>{start ? <ChatArea /> : <LandingPage setStart={setStart} />}</div>
  );
}

export default App;
