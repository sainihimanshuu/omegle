const LandingPage = ({
  setStart,
}: {
  setStart: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <div className="flex-row justify-center items-center">
      <h1>welcome to omegle</h1>
      <button onClick={() => setStart(true)}>start</button>
    </div>
  );
};

export default LandingPage;
