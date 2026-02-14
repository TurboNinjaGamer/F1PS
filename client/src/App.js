import logo from './logo.svg';
import './App.css';
import { useEffect, useState } from "react";

function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch("/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((e) => setHealth({ ok: false, error: String(e) }));
  }, []);

  useEffect(() => {
  fetch("/api/laps?session_key=9161&driver_number=63&lap_number=8")
    .then((r) => r.json())
    .then((data) => console.log("laps:", data))
    .catch((e) => console.error(e));
}, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>F1PS</h1>
      <pre>{JSON.stringify(health, null, 2)}</pre>
    </div>
  );
  /*return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );*/
}

export default App;
