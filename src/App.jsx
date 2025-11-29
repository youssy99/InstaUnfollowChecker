import "./App.css";
import MyDropzone from "./MyDropzone";

function App() {
  return (
    <>
      <div>
        <h2 style={{ color: "#fdf0d5" }}>
          Welcome to InstaUnfollowChecker! Here you can see who doesn’t follow
          you back.
        </h2>
        <MyDropzone />
      </div>
    </>
  );
}

export default App;
