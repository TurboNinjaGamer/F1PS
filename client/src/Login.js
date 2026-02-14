import { useState } from "react";

export default function Login({ onLoggedIn }) {
  const [step, setStep] = useState("email"); // "email" | "code"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function requestCode(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setStep("code");
      setCode("")
      setMsg("Kod je poslat (za sada se ispisuje u server konzoli).");
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Verify failed");

      // sacuvaj token i user
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      onLoggedIn({ token: data.token, user: data.user });
    } catch (err) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>F1PS</h1>
      <p style={{ marginTop: 0, opacity: 0.8 }}>
        Prijava bez lozinke (email kod)
      </p>

      {step === "email" && (
        <form onSubmit={requestCode}>
          <label>Email</label>
          <input
            autoFocus
            style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="npr. djordje@test.com"
            required
          />
          <button disabled={loading} style={{ width: "100%", padding: 10 }}>
            {loading ? "Šaljem..." : "Pošalji kod"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verifyCode}>
          <div style={{ marginBottom: 12, opacity: 0.8 }}>
            Email: <b>{email}</b>{" "}
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setMsg("");
              }}
              style={{ marginLeft: 8 }}
            >
              promeni
            </button>
          </div>

          <label>Kod (6 cifara)</label>
          <input
            style={{ width: "100%", padding: 10, marginTop: 6, marginBottom: 12 }}
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            required
          />
          <button disabled={loading} style={{ width: "100%", padding: 10 }}>
            {loading ? "Proveravam..." : "Uloguj se"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={requestCode}
            style={{ width: "100%", padding: 10, marginTop: 10 }}
          >
            Pošalji novi kod
          </button>
        </form>
      )}

      {msg && (
        <div style={{ marginTop: 14, padding: 10, border: "1px solid #ccc" }}>
          {msg}
        </div>
      )}
    </div>
  );
}