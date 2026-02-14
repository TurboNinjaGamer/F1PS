import { useEffect, useState } from "react";
import Login from "./Login";

export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    return token && userStr ? { token, user: JSON.parse(userStr) } : null;
  });

  useEffect(() => {
    // opciono: proveri da server radi
    fetch("/health").catch(() => {});
  }, []);

  if (!auth) {
    return <Login onLoggedIn={setAuth} />;
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>F1PS</h1>
      <p>Logged in as: <b>{auth.user.email}</b></p>

      <button
        onClick={() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setAuth(null);
        }}
      >
        Logout
      </button>

      <hr style={{ margin: "24px 0" }} />

      <h2>OpenF1 test</h2>
      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          <button onClick={() => alert("Results - soon")}>Results</button>
          <button onClick={() => alert("Teams - soon")}>Teams</button>
          <button onClick={() => alert("Real time - soon")}>Real time</button>
      </div>
    </div>
  );
}