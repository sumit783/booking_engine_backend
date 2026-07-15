import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason 
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";

// In-memory mappings
// ownerId -> WASocket
const sessions = new Map();
// ownerId -> { status, qrCodeString (base64 data url), error }
const sessionStates = new Map();

const SESSION_DIR_BASE = path.join(process.cwd(), "whatsapp_sessions");

// Ensure base session directory exists
if (!fs.existsSync(SESSION_DIR_BASE)) {
  fs.mkdirSync(SESSION_DIR_BASE, { recursive: true });
}

/**
 * Initializes and connects Baileys for a specific owner
 */
export const connectOwner = async (ownerId) => {
  if (sessions.has(ownerId)) {
    const existing = sessions.get(ownerId);
    return existing;
  }

  const ownerSessionDir = path.join(SESSION_DIR_BASE, `owner_${ownerId}`);
  
  sessionStates.set(ownerId, { status: "Connecting", qrCodeString: null, error: null });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(ownerSessionDir);

    const makeSocket = makeWASocket.default || makeWASocket;
    const sock = makeSocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
    });

    sessions.set(ownerId, sock);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await qrcode.toDataURL(qr);
          sessionStates.set(ownerId, { status: "Connecting", qrCodeString: qrDataUrl, error: null });
        } catch (err) {
          console.error("QR Code generation error:", err);
        }
      }

      if (connection === "connecting") {
        const current = sessionStates.get(ownerId) || {};
        sessionStates.set(ownerId, { ...current, status: "Connecting" });
      }

      if (connection === "open") {
        sessionStates.set(ownerId, { status: "Connected", qrCodeString: null, error: null });
      }

      if (connection === "close") {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        sessions.delete(ownerId);

        if (shouldReconnect) {
          sessionStates.set(ownerId, { status: "Connecting", qrCodeString: null, error: "Disconnected, reconnecting..." });
          // Attempt reconnection
          setTimeout(() => connectOwner(ownerId), 3000);
        } else {
          // Logged out: clean up session folder
          sessionStates.set(ownerId, { status: "Disconnected", qrCodeString: null, error: "Logged out" });
          cleanupSessionDir(ownerId);
        }
      }
    });

    return sock;
  } catch (error) {
    sessionStates.set(ownerId, { status: "Disconnected", qrCodeString: null, error: error.message });
    sessions.delete(ownerId);
    throw error;
  }
};

/**
 * Disconnects and cleans up WhatsApp session for an owner
 */
export const disconnectOwner = async (ownerId) => {
  const sock = sessions.get(ownerId);
  if (sock) {
    try {
      sock.end();
    } catch (e) {}
    sessions.delete(ownerId);
  }
  cleanupSessionDir(ownerId);
  sessionStates.set(ownerId, { status: "Disconnected", qrCodeString: null, error: null });
};

/**
 * Clean up the filesystem directory for the session
 */
const cleanupSessionDir = (ownerId) => {
  const ownerSessionDir = path.join(SESSION_DIR_BASE, `owner_${ownerId}`);
  if (fs.existsSync(ownerSessionDir)) {
    try {
      fs.rmSync(ownerSessionDir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete session directory for owner_${ownerId}:`, e);
    }
  }
};

/**
 * Gets connection status & QR data
 */
export const getSessionStatus = (ownerId) => {
  // If we don't have it in memory but session folder exists, auto connect
  const ownerSessionDir = path.join(SESSION_DIR_BASE, `owner_${ownerId}`);
  if (!sessionStates.has(ownerId)) {
    if (fs.existsSync(ownerSessionDir)) {
      connectOwner(ownerId).catch(() => {});
      return { status: "Connecting", qrCodeString: null, error: null };
    }
    return { status: "Disconnected", qrCodeString: null, error: null };
  }
  return sessionStates.get(ownerId);
};

export const sendWhatsAppMessage = async (ownerId, phone, text, options = {}) => {
  const sock = sessions.get(ownerId);
  if (!sock) {
    throw new Error("WhatsApp account is not connected");
  }

  // Format phone number to WhatsApp JID: e.g. 919876543210@s.whatsapp.net
  let cleanPhone = phone.replace(/\D/g, "");
  // Default to India (91) if 10 digits
  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone;
  }
  const jid = `${cleanPhone}@s.whatsapp.net`;

  if (options.image) {
    await sock.sendMessage(jid, { 
      image: options.image, 
      caption: text 
    });
  } else {
    await sock.sendMessage(jid, { text });
  }
};
