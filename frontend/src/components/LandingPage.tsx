const LandingPage = ({
  setStart,
}: {
  setStart: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <div className="flex flex-col mt-44 items-center h-full">
      <h1 className=" font-luckiest font-normal text-6xl">welcome to omegle</h1>
      <p className="font-luckiest font-light text-md mt-5">
        Get paired with random strangers online
      </p>
      <button
        className="bg-black text-white font-luckiest font-thin w-24 h-11 rounded-full mt-5"
        onClick={() => setStart(true)}
      >
        start
      </button>
    </div>
  );
};

export default LandingPage;
