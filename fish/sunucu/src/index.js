// Room servers for the Lab's games. Routes:
//   GET /                health check
//   WS  /lobi            Fish: the room list (pushed to the page whenever a room changes)
//   WS  /oda/<id>        Fish: one room (waiting room, the shared pond and the round results)
//   WS  /tank/lobi       Tank Arenası: the room list
//   WS  /tank/oda/<id>   Tank Arenası: one room (rules shared with the page: lab/tank/oyun.js)
import { Lobi } from './lobi.js';
import { Oda } from './oda.js';
import { TankOda } from './tank-oda.js';

export { Lobi, Oda, TankOda };

const ODA_ID = /^\/oda\/([a-z0-9]{8})$/;
const TANK_ODA_ID = /^\/tank\/oda\/([a-z0-9]{8})$/;

function izinli(env, req) {
  const liste = String(env.IZINLI || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!liste.length) return true;
  return liste.includes(req.headers.get('Origin') || '');
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return new Response('fish and tank rooms\n', { headers: { 'content-type': 'text/plain' } });
    if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return new Response('expected a websocket\n', { status: 426 });
    }
    if (!izinli(env, req)) return new Response('origin not allowed\n', { status: 403 });
    if (url.pathname === '/lobi') {
      return env.LOBI.get(env.LOBI.idFromName('lobi')).fetch(req);
    }
    const m = url.pathname.match(ODA_ID);
    if (m) return env.ODA.get(env.ODA.idFromName(m[1])).fetch(req);
    // Tank rooms use their own Lobi object (the same class, a different name).
    if (url.pathname === '/tank/lobi') {
      return env.LOBI.get(env.LOBI.idFromName('tank')).fetch(req);
    }
    const t = url.pathname.match(TANK_ODA_ID);
    if (t) return env.TANK_ODA.get(env.TANK_ODA.idFromName(t[1])).fetch(req);
    return new Response('not found\n', { status: 404 });
  }
};
