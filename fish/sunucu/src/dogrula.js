// Checks who is connecting: the browser sends its Supabase access token and the chosen
// player (profile) id; we ask Supabase who the token belongs to and whether the player is theirs.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RENK = /^#[0-9a-f]{6}$/i;
const onbellek = new Map(); // token -> { uid, son }

function basliklar(env, token) {
  return { apikey: env.SUPABASE_KEY, Authorization: 'Bearer ' + token };
}

// Local testing only (wrangler dev --var AUTH_YOK:1): trust the name the page sends.
function testMi(env) { return env.AUTH_YOK === '1'; }

export async function kullanici(env, token) {
  if (testMi(env)) return { uid: 'test' };
  if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
  const c = onbellek.get(token);
  if (c && c.son > Date.now()) return c;
  try {
    const r = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: basliklar(env, token) });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    const k = { uid: u.id, son: Date.now() + 5 * 60 * 1000 };
    if (onbellek.size > 500) onbellek.clear();
    onbellek.set(token, k);
    return k;
  } catch (e) {
    return null;
  }
}

export async function oyuncu(env, m) {
  const profil = String(m.profil || '');
  if (!UUID.test(profil)) return null;
  if (testMi(env)) {
    const ad = String(m.ad || 'Koi').trim().slice(0, 20) || 'Koi';
    return { uid: 'test', pid: profil.toLowerCase(), ad, renk: RENK.test(m.renk || '') ? m.renk : '#f27a32' };
  }
  const k = await kullanici(env, m.token);
  if (!k) return null;
  try {
    const url = env.SUPABASE_URL + '/rest/v1/profiles?id=eq.' + profil + '&select=id,name,color,owner_id';
    const r = await fetch(url, { headers: basliklar(env, m.token) });
    if (!r.ok) return null;
    const rows = await r.json();
    const p = Array.isArray(rows) ? rows[0] : null;
    if (!p || p.owner_id !== k.uid) return null;
    return {
      uid: k.uid,
      pid: p.id,
      ad: String(p.name || 'Koi').trim().slice(0, 20) || 'Koi',
      renk: RENK.test(p.color || '') ? p.color : '#f27a32'
    };
  } catch (e) {
    return null;
  }
}
