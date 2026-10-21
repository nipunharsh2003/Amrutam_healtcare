'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');

module.exports = {
  async up(queryInterface, Sequelize) {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!email || !password || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
      throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a 12-72 byte BOOTSTRAP_ADMIN_PASSWORD');
    }
    await queryInterface.sequelize.transaction(async (transaction) => {
      const [admins] = await queryInterface.sequelize.query(
        "SELECT COUNT(*) AS total FROM users WHERE role = 'ADMIN' FOR UPDATE",
        { transaction },
      );
      if (Number(admins[0].total) > 0) throw new Error('An administrator already exists; bootstrap is one-time only');

      const now = new Date();
      const userId = crypto.randomUUID();
      await queryInterface.bulkInsert('users', [{
        id: userId,
        email,
        password_hash: await bcrypt.hash(password, 12),
        role: 'ADMIN',
        is_active: true,
        mfa_enabled: false,
        created_at: now,
        updated_at: now,
      }], { transaction });
      await queryInterface.bulkInsert('profiles', [{
        id: crypto.randomUUID(),
        user_id: userId,
        first_name: 'System',
        last_name: 'Administrator',
        phone: null,
        created_at: now,
        updated_at: now,
      }], { transaction });
      await queryInterface.bulkInsert('audit_logs', [{
        id: crypto.randomUUID(),
        actor_user_id: userId,
        event_type: 'ADMIN_BOOTSTRAPPED',
        target_type: 'USER',
        target_id: userId,
        metadata: JSON.stringify({ role: 'ADMIN' }),
        request_id: null,
        created_at: now,
        updated_at: now,
      }], { transaction });
    });
  },

  async down(queryInterface) {
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    if (email) {
      const [rows] = await queryInterface.sequelize.query(
        'SELECT id FROM users WHERE email = :email AND role = \'ADMIN\'',
        { replacements: { email } },
      );
      if (rows[0]) {
        await queryInterface.bulkDelete('audit_logs', { actor_user_id: rows[0].id });
        await queryInterface.bulkDelete('profiles', { user_id: rows[0].id });
        await queryInterface.bulkDelete('users', { id: rows[0].id });
      }
    }
  },
};