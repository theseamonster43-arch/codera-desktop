/**
 * The drawings, on a 24×24 grid. The same shapes as the app and the website,
 * so all three read as one product. Strokes use currentColor, so an icon takes
 * the colour of the text it sits beside.
 */
const s = (d: string) => `<path d="${d}"/>`;
const fill = (d: string) => `<path d="${d}" fill="currentColor" stroke="none"/>`;

export const ICONS: Record<string, string> = {
  home: s('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  homeOn: fill('M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'),
  shorts: '<rect x="4" y="2.5" width="16" height="19" rx="3.5"/>' + fill('M10.5 9.2v5.6l4.6-2.8z'),
  shortsOn: '<rect x="4" y="2.5" width="16" height="19" rx="3.5" fill="currentColor" stroke="none"/>'
    + '<path d="M10.5 9.2v5.6l4.6-2.8z" fill="var(--bg)" stroke="none"/>',
  person: '<circle cx="12" cy="8" r="3.6"/>' + s('M4.8 20.5c0-3.6 3.2-5.9 7.2-5.9s7.2 2.3 7.2 5.9'),
  personOn: '<circle cx="12" cy="8" r="3.6" fill="currentColor" stroke="none"/>'
    + fill('M4.8 20.5c0-3.6 3.2-5.9 7.2-5.9s7.2 2.3 7.2 5.9'),
  sparkle: s('M10 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z')
    + fill('M18 14.5c.3 1.9 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1.1-2.7-3-3 1.9-.3 2.7-1.1 3-3z'),
  plus: s('M12 5v14M5 12h14'),
  search: '<circle cx="11" cy="11" r="6.4"/>' + s('M16 16l4.5 4.5'),
  code: s('M8.5 8 5 12l3.5 4M15.5 8l3.5 4-3.5 4M13.6 5.5l-3.2 13'),
  play: fill('M7.5 4.9v14.2a.7.7 0 0 0 1.07.6l11.2-7.1a.7.7 0 0 0 0-1.2L8.57 4.3A.7.7 0 0 0 7.5 4.9z'),
  pause: '<rect x="6.6" y="5" width="3.9" height="14" rx="1.3" fill="currentColor" stroke="none"/>'
    + '<rect x="13.5" y="5" width="3.9" height="14" rx="1.3" fill="currentColor" stroke="none"/>',
  loud: fill('M4 9.2h3.1L11.6 5a.8.8 0 0 1 1.4.6v12.8a.8.8 0 0 1-1.4.6L7.1 14.8H4a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1z')
    + s('M16 9.4a3.7 3.7 0 0 1 0 5.2M18.6 6.8a7.4 7.4 0 0 1 0 10.4'),
  quiet: fill('M4 9.2h3.1L11.6 5a.8.8 0 0 1 1.4.6v12.8a.8.8 0 0 1-1.4.6L7.1 14.8H4a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1z')
    + s('M16.2 9.8l4.6 4.4M20.8 9.8l-4.6 4.4'),
  full: s('M9.2 3.6H4.8a1.2 1.2 0 0 0-1.2 1.2v4.4M14.8 3.6h4.4a1.2 1.2 0 0 1 1.2 1.2v4.4M9.2 20.4H4.8a1.2 1.2 0 0 1-1.2-1.2v-4.4M14.8 20.4h4.4a1.2 1.2 0 0 0 1.2-1.2v-4.4'),
  popout: '<rect x="3" y="5" width="18" height="14" rx="2.6"/>'
    + '<rect x="11.6" y="11.4" width="7.4" height="6" rx="1.6" fill="currentColor" stroke="none"/>',
  up: s('M7 10.5h2.6l1.9-5a2 2 0 0 1 3.8 1.1l-.6 3.9h4a1.9 1.9 0 0 1 1.9 2.2l-.9 5.5A2.4 2.4 0 0 1 17.4 20H7z') + s('M3.5 10.5H7V20H3.5z'),
  down: '<g transform="rotate(180 12 12)">'
    + s('M7 10.5h2.6l1.9-5a2 2 0 0 1 3.8 1.1l-.6 3.9h4a1.9 1.9 0 0 1 1.9 2.2l-.9 5.5A2.4 2.4 0 0 1 17.4 20H7z')
    + s('M3.5 10.5H7V20H3.5z') + '</g>',
  comment: s('M21 11.5a8 8 0 0 1-8 8H7l-4 2.5V11.5a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z'),
  check: s('M5 12.5 10 17.5 19 7'),
  close: s('M6.5 6.5l11 11M17.5 6.5l-11 11'),
  trash: s('M4.5 7h15M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.8 7l.9 12.1A1.9 1.9 0 0 0 9.6 21h4.8a1.9 1.9 0 0 0 1.9-1.9L17.2 7'),
  image: '<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="8.6" cy="10" r="1.7"/>'
    + s('M3.4 17.2 9 12.3l4 3.3 3.2-2.6 4.4 3.8'),
  card: '<rect x="2.8" y="5" width="18.4" height="14" rx="2.6"/>' + s('M2.8 9.6h18.4M6.5 15h3.5'),
  // Window controls, drawn thin like the system's own.
  winMin: '<path d="M6 12h12" stroke-width="1.3"/>',
  winMax: '<rect x="6.5" y="6.5" width="11" height="11" rx="1.2" stroke-width="1.3"/>',
  winClose: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke-width="1.3"/>',
  chevronLeft: s('M15 5l-7 7 7 7'),
  live: '<circle cx="12" cy="12" r="2.3" fill="currentColor" stroke="none"/>' + s('M8.3 8.3a5.3 5.3 0 0 0 0 7.4M15.7 8.3a5.3 5.3 0 0 1 0 7.4M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2'),
  liveOn: '<circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none"/><path d="M8.3 8.3a5.3 5.3 0 0 0 0 7.4M15.7 8.3a5.3 5.3 0 0 1 0 7.4M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2" stroke-width="2.3"/>',
  followed: '<circle cx="9" cy="8" r="3.4"/>' + s('M2.8 20.2c0-3.3 2.8-5.4 6.2-5.4s6.2 2.1 6.2 5.4M16.5 5.2a3.2 3.2 0 0 1 0 6.1M17.8 14.9c2.2.5 3.7 2.1 3.7 4.4'),
  followedOn: '<circle cx="9" cy="8" r="3.4" fill="currentColor" stroke="none"/>' + fill('M2.8 20.2c0-3.3 2.8-5.4 6.2-5.4s6.2 2.1 6.2 5.4z') + s('M16.5 5.2a3.2 3.2 0 0 1 0 6.1M17.8 14.9c2.2.5 3.7 2.1 3.7 4.4'),
  tip: '<circle cx="12" cy="12" r="8.6"/>' + s('M14.7 9.4c-.5-.9-1.5-1.5-2.7-1.5-1.5 0-2.7.8-2.7 2s1.1 1.7 2.7 2 2.7.8 2.7 2.1-1.2 2-2.7 2c-1.2 0-2.3-.6-2.8-1.5M12 6.3v1.6M12 16.1v1.6'),
  send: s('M4.5 12 20 4.5l-5.5 15.5-3-6.5zM11.5 13.5 20 4.5'),
  camera: s('M3.5 8.6a2 2 0 0 1 2-2h1.7l1.1-2h7.4l1.1 2h1.7a2 2 0 0 1 2 2v8.9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z') + '<circle cx="12" cy="12.8" r="3.6"/>',
  screen: '<rect x="3" y="4.5" width="18" height="12" rx="2.2"/>' + s('M9 20h6M12 16.5V20'),
};
