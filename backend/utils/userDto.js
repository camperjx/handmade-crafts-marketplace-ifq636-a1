const toUserDto = user => ({
  id: String(user._id), name: user.name, email: user.email, role: user.role,
  address: typeof user.address === 'string' ? user.address : '',
});
module.exports = { toUserDto };
