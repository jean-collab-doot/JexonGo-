function send(res, status, body) {
  res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });

  return send(res, 200, {
    ok: true,
    disabled: true,
    message: 'Email delivery is disabled.',
  });
}
