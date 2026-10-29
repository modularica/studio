// Fish rooms. Routes:
//   GET /            health check
//   WS  /lobi        the room list (pushed to the page whenever a room changes)
//   WS  /oda/<id>    one room: waiting room, the shared pond and the round results
import { Lobi } from './lobi.js';
import { Oda } from './oda.js';

export { Lobi, Oda };

const ODA_ID = /^\/oda\/([a-z0-9]{8})$/;

function izinli(env, req) {
  const liste = String(env.IZINLI || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!liste.length) return true;
  return liste.includes(req.headers.get('Origin') || '');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return new Response('fish rooms\n', { headers: { 'content-type': 'text/plain' } });
    if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('expected a websocket\n', { status: 426 });
    }
    if (!izinli(env, req)) return new Response('origin not allowed\n', { status: 403 });
    if (url.pathname === '/lobi') {
      return env.LOBI.get(env.LOBI.idFromName('lobi')).fetch(req);
    }
    const m = url.pathname.match(ODA_ID);
    if (m) return env.ODA.get(env.ODA.idFromName(m[1])).fetch(req);
    return new Response('not found\n', { status: 404 });
  }
};
