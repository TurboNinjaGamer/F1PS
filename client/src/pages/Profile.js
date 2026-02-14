export default function Profile() {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div>
      <h2>Profil</h2>
      {user ? <p>Email: <b>{user.email}</b></p> : <p>Nema user-a.</p>}
      <p>Ovde ćemo dodati izbor omiljenog tima.</p>
    </div>
  );
}