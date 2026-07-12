const { verifyRequest } = require('../_lib/auth');

module.exports = async (req, res) => {
  res.status(200).json({ isAdmin: verifyRequest(req) });
};
