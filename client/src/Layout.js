import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function Layout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const linkStyle = ({ isActive }) => ({
    padding: "8px 12px",
    borderRadius: 10,
    textDecoration: "none",
    fontWeight: 600,
    background: isActive ? "rgba(255,255,255,0.92)" : "transparent",
color: isActive ? "var(--primary)" : "var(--textOnPrimary)",
  });

  return (
    <div>
      <header
        style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        background: "var(--primary)",
        color: "var(--textOnPrimary)",
        borderBottom: "1px solid rgba(255,255,255,0.15)",
      }}
      >
        <div style={{ fontWeight: 700 }}>F1PS</div>

        <nav style={{ display: "flex", gap: 8 }}>
          <NavLink to="/results" style={linkStyle}>Results</NavLink>
          <NavLink to="/teams" style={linkStyle}>Teams</NavLink>
          <NavLink to="/realtime" style={linkStyle}>Real time</NavLink>
          <NavLink to="/profile" style={linkStyle}>Profile</NavLink>
        </nav>

        <button
          onClick={logout}
          style={{
              background: "rgba(255,255,255,0.92)",
              color: "var(--primary)",
              fontWeight: 700,
              borderRadius: 10,
              padding: "8px 12px",
           }}
        >
            Logout
        </button>
      </header>

      <main style={{ padding: 16, minHeight: "calc(100vh - 66px)", background: "var(--bg)" }}>
        <Outlet />
      </main>
    </div>
  );
}