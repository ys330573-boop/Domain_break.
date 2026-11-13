// Online play — network settings.
//
// Two browsers can usually connect directly (STUN). When one of the networks blocks that (mobile data,
// Jio / Airtel fibre with CGNAT, office or college Wi-Fi), the video and keys must go through a TURN relay.
// The free relays that PeerJS used to ship are gone, so put your own (free) TURN account here:
//   - https://www.expressturn.com  (free plan, static username / password)
//   - https://www.metered.ca/stun-turn  (free plan, "Open Relay")
// Paste the details below and give your friend the SAME file (or both of you can paste them in the game:
// ONLINE → RELAY SETTINGS, which is saved in the browser).
export const TURN = [
  // { urls: 'turn:YOUR-SERVER:3478', username: 'YOUR_USERNAME', credential: 'YOUR_PASSWORD' },
  // { urls: 'turns:YOUR-SERVER:443?transport=tcp', username: 'YOUR_USERNAME', credential: 'YOUR_PASSWORD' },
];

// public STUN servers (free, no account): find each side's public address
export const STUN = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];
