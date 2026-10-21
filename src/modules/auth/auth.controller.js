const asyncHandler = require('../../utils/asyncHandler');
const authService = require('./auth.service');
const { User, Profile } = require('../models');

const safeUser = (user) => ({ id: user.id, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled });

exports.register = asyncHandler(async (req, res) => {
  const { user, profile } = await authService.register(req.body);
  res.status(201).json({ success: true, data: { user: safeUser(user), profile } });
});

exports.login = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.login(req.body);
  res.status(200).json({ success: true, data: { user: safeUser(user), accessToken, tokenType: 'Bearer', expiresIn: 900 } });
});

exports.getProfile = asyncHandler(async (req, res) => {
  const user = await User.findByPk(req.auth.userId, {
    attributes: ['id', 'email', 'role', 'mfaEnabled', 'createdAt'],
    include: [{ model: Profile, as: 'profile', attributes: ['firstName', 'lastName', 'phone'] }],
  });
  res.json({ success: true, data: { user } });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const [user, profile] = await Promise.all([
    User.findByPk(req.auth.userId, { attributes: ['id', 'email', 'role', 'mfaEnabled'] }),
    Profile.findOne({ where: { userId: req.auth.userId } }),
  ]);
  if (Object.keys(req.body).length) await profile.update(req.body);
  res.json({ success: true, data: { user, profile } });
});

exports.setupMfa = asyncHandler(async (req, res) => {
  const setup = await authService.setupMfa(req.auth.userId, req.body.password);
  res.status(201).json({ success: true, data: setup });
});

exports.verifyMfa = asyncHandler(async (req, res) => {
  const { user, accessToken } = await authService.verifyMfa(req.auth.userId, req.body.code);
  res.json({ success: true, data: { user: safeUser(user), accessToken, tokenType: 'Bearer', expiresIn: 900 } });
});