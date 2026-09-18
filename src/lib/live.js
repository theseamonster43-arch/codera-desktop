// @ts-nocheck: a copy of the website file of the same name, kept as plain JavaScript.
/**
 * Live streaming, browser to browser. A copy of the website's web/live.js with
 * npm imports; the website, the desktop app and the phone app all speak this.
 *
 * There is no streaming server. The streamer's browser sends its camera or
 * screen straight to each viewer over WebRTC; Firestore is only the notice board
 * where the two sides leave each other the details needed to connect:
 *
 *   streams/{id}/peers/{viewer}          the viewer's offer, then the streamer's answer
 *   streams/{id}/peers/{viewer}/viewer/* the viewer's network routes
 *   streams/{id}/peers/{viewer}/host/*   the streamer's network routes
 *
 * Each viewer is a separate upload from the streamer, so this suits a small
 * audience (a handful to a dozen, depending on the streamer's connection). A
 * `session` id on everything means a viewer who reconnects starts clean instead
 * of tripping over the routes from last time.
 *
 * Only public STUN servers are used to find a route. Two people both behind
 * strict corporate or mobile networks may not be able to connect; that needs a
 * TURN relay, which costs money to run.
 */

import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, addDoc, serverTimestamp,
} from 'firebase/firestore';

const ICE = {
  iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
};

const plain = d => ({ type: d.type, sdp: d.sdp });
const newSession = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/**
 * The streamer's side: answers every viewer who asks, sending them `media`.
 *
 * @returns {{ stop(): void }}
 */
export function hostStream(db, streamId, media, { onWatching } = {}) {
  const peersCol = collection(db, 'streams', streamId, 'peers');
  const peers = new Map();       // viewer uid -> { pc, session, unsub }

  const report = () => {
    if (!onWatching) return;
    let n = 0;
    peers.forEach(p => { if (p.pc.connectionState === 'connected') n++; });
    onWatching(n);
  };

  function drop(uid) {
    const p = peers.get(uid);
    if (!p) return;
    peers.delete(uid);
    try { p.unsub && p.unsub(); } catch (e) {}
    try { p.pc.close(); } catch (e) {}
    report();
  }

  async function answer(uid, data) {
    drop(uid);
    const pc = new RTCPeerConnection(ICE);
    const entry = { pc, session: data.session, unsub: null };
    peers.set(uid, entry);

    media.getTracks().forEach(t => pc.addTrack(t, media));
    pc.onicecandidate = e => {
      if (!e.candidate) return;
      addDoc(collection(db, 'streams', streamId, 'peers', uid, 'host'),
        { session: data.session, c: e.candidate.toJSON() }).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') drop(uid);
      else report();
    };

    await pc.setRemoteDescription(data.offer);
    const reply = await pc.createAnswer();
    await pc.setLocalDescription(reply);
    await updateDoc(doc(peersCol, uid), { answer: plain(reply), answered: data.session });

    entry.unsub = onSnapshot(collection(db, 'streams', streamId, 'peers', uid, 'viewer'), snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type !== 'added') return;
        const d = ch.doc.data();
        if (d.session === entry.session) pc.addIceCandidate(d.c).catch(() => {});
      });
    });
  }

  const unsub = onSnapshot(peersCol, snap => {
    snap.docChanges().forEach(ch => {
      const uid = ch.doc.id;
      const d = ch.doc.data();
      if (ch.type === 'removed') { drop(uid); return; }
      const cur = peers.get(uid);
      if (d.offer && d.session && (!cur || cur.session !== d.session)) {
        answer(uid, d).catch(() => drop(uid));
      }
    });
  });

  return {
    stop() {
      unsub();
      [...peers.keys()].forEach(drop);
    },
  };
}

/**
 * A viewer's side: asks the streamer for the stream and plays it in `video`.
 *
 * @param onState called with 'connecting', 'connected', 'failed' or 'closed'
 * @returns {{ stop(): void }}
 */
export function watchStream(db, streamId, uid, video, onState) {
  const session = newSession();
  const pc = new RTCPeerConnection(ICE);
  const mine = doc(db, 'streams', streamId, 'peers', uid);
  const remote = new MediaStream();
  const unsubs = [];
  let stopped = false;

  pc.addTransceiver('video', { direction: 'recvonly' });
  pc.addTransceiver('audio', { direction: 'recvonly' });

  pc.ontrack = e => {
    remote.addTrack(e.track);
    if (video.srcObject !== remote) video.srcObject = remote;
    video.play().catch(() => {});
  };
  pc.onicecandidate = e => {
    if (!e.candidate) return;
    addDoc(collection(mine, 'viewer'), { session, c: e.candidate.toJSON() }).catch(() => {});
  };
  pc.onconnectionstatechange = () => onState && onState(pc.connectionState);
  onState && onState('connecting');

  (async () => {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    if (stopped) return;
    await setDoc(mine, { offer: plain(offer), session, at: serverTimestamp() });

    unsubs.push(onSnapshot(mine, snap => {
      const d = snap.data();
      if (d && d.answer && d.answered === session && !pc.currentRemoteDescription) {
        pc.setRemoteDescription(d.answer).catch(() => onState && onState('failed'));
      }
    }));
    unsubs.push(onSnapshot(collection(mine, 'host'), snap => {
      snap.docChanges().forEach(ch => {
        if (ch.type !== 'added') return;
        const d = ch.doc.data();
        if (d.session === session) pc.addIceCandidate(d.c).catch(() => {});
      });
    }));
  })().catch(() => onState && onState('failed'));

  return {
    stop() {
      stopped = true;
      unsubs.forEach(u => { try { u(); } catch (e) {} });
      try { pc.close(); } catch (e) {}
      deleteDoc(mine).catch(() => {});
    },
  };
}

/**
 * Records a stream on the streamer's own machine while it runs, so it can be
 * kept afterwards without anything having been uploaded during the stream.
 * MP4 where the browser can write it (it plays everywhere), WebM otherwise.
 */
export function recorder(media) {
  const kinds = [
    'video/mp4;codecs=avc1,opus', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ];
  const type = kinds.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  let rec;
  try {
    rec = new MediaRecorder(media, type ? { mimeType: type, videoBitsPerSecond: 2500000 } : undefined);
  } catch (e) {
    return null;       // no recording on this browser; the stream still runs
  }
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec.start(1000);
  return {
    stop: () => new Promise(resolve => {
      rec.onstop = () => {
        const mime = (rec.mimeType || type || 'video/webm').split(';')[0];
        resolve(new Blob(chunks, { type: mime }));
      };
      try { rec.stop(); } catch (e) { resolve(new Blob(chunks, { type: 'video/webm' })); }
    }),
  };
}

/**
 * The camera, or the screen with the microphone laid over it.
 */
export async function capture(source) {
  if (source === 'screen') {
    const screen = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: 30 }, audio: true,
    });
    // The microphone too, so people can talk over what they are showing. If it
    // is refused, the screen goes out on its own.
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      const has = screen.getAudioTracks().length;
      if (!has) mic.getAudioTracks().forEach(t => screen.addTrack(t));
      else {
        // Both system sound and voice: mix them into one track.
        const ctx = new AudioContext();
        const out = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(new MediaStream(screen.getAudioTracks())).connect(out);
        ctx.createMediaStreamSource(mic).connect(out);
        screen.getAudioTracks().forEach(t => screen.removeTrack(t));
        screen.addTrack(out.stream.getAudioTracks()[0]);
      }
    } catch (e) { /* no microphone: screen only */ }
    return screen;
  }
  return navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    audio: true,
  });
}

/** Whether this browser can stream at all. */
export const canStream = () => !!(navigator.mediaDevices && window.RTCPeerConnection);

/** Seconds as h:mm:ss or m:ss. */
export function elapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  const two = n => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}
