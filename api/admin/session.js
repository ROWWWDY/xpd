const { getSession } = require('../_lib/auth');

module.exports = async (req, res) => {
  const session = getSession(req);
  res.status(200).json({
    isAdmin: !!session,
    username: session ? session.username : null,
    permRole: session ? session.permRole : null
  });
};
