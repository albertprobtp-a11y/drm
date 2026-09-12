import { useEffect, useRef } from "react";
import { WS_BASE } from "../lib/api";

/** Écoute la révocation/expiration en temps réel pour une session destinataire. */
export function useRevocationSocket(sessionToken: string | null, onCut: (reason: string) => void) {
  const onCutRef = useRef(onCut);
  onCutRef.current = onCut;

  useEffect(() => {
    if (!sessionToken) return;

    const url = WS_BASE ? `${WS_BASE}/ws` : `${window.location.origin.replace(/^http/, "ws")}/ws`;
    const socket = new WebSocket(url);
    let closedByServer = false;

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "subscribe", sessionToken }));
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "revoked") {
          closedByServer = true;
          onCutRef.current(message.reason ?? "Accès révoqué.");
        } else if (message.type === "expired") {
          closedByServer = true;
          onCutRef.current("Votre session a expiré.");
        }
      } catch {
        // message non JSON, ignoré
      }
    });

    const heartbeat = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      if (!closedByServer) socket.close();
    };
  }, [sessionToken]);
}
