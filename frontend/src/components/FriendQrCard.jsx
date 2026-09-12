import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { friendInviteUrl } from "../utils/friendInvite.js";

export default function FriendQrCard({ email }) {
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !email) return;
    let cancelled = false;
    setError("");
    QRCode.toDataURL(friendInviteUrl(email), {
      width: 192,
      margin: 1,
      color: { dark: "#24332c", light: "#faf8f3" },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not generate QR");
      });
    return () => {
      cancelled = true;
    };
  }, [open, email]);

  if (!email) {
    return (
      <p className="hint">Your account needs an email before you can share a friend QR.</p>
    );
  }

  return (
    <div className="friend-qr">
      <button type="button" className="btn-paper" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide QR" : "Show my QR"}
      </button>
      {open ? (
        <div className="friend-qr-body">
          {src ? <img src={src} alt="Friend invite QR code" /> : null}
          {error ? <p className="error">{error}</p> : null}
          <p className="hint">Scan to send me a friend request.</p>
          <p className="hint">{email}</p>
        </div>
      ) : null}
    </div>
  );
}
