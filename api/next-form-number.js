const { readDb } = require('./_lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const db = await readDb();
    res.status(200).json({ formNumber: db.counter });
  } catch (err) {
    console.error('next-form-number error:', err);
    res.status(500).json({ error: 'Could not reach the database.' });
  }
};
