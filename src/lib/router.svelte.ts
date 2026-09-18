/**
 * Where the window is, kept in the address hash so the back and forward mouse
 * buttons work and the mini player window can be opened straight to a video.
 *
 *   #/                    home
 *   #/watch/<id>          one post, short or video
 *   #/shorts[/<id>]       the shorts feed
 *   #/search/<words>
 *   #/you  #/plus  #/new/<kind>
 *   #/mini/<id>?t=<sec>   the mini player window
 *   #/chat/<id>           a stream's chat, in a window of its own
 */
export const route = $state({ name: 'home', arg: '', params: {} as Record<string, string> });

function read() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const [name, ...rest] = path.split('/');
  route.name = name || 'home';
  route.arg = decodeURIComponent(rest.join('/'));
  route.params = Object.fromEntries(new URLSearchParams(qs));
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', read);
  read();
}

export function go(path: string) {
  const next = '#/' + path.replace(/^[#/]+/, '');
  if (location.hash === next) read();
  else location.hash = next;
}

export const back = () => history.back();
