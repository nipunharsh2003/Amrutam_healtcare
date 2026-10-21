'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'mfa_enabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('users', 'mfa_secret_ciphertext', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'mfa_secret_iv', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'mfa_secret_tag', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.createTable('profiles', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      first_name: { type: Sequelize.STRING(100), allowNull: false },
      last_name: { type: Sequelize.STRING(100), allowNull: false },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('doctors', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      specialization: { type: Sequelize.STRING(120), allowNull: false },
      bio: { type: Sequelize.TEXT, allowNull: true },
      license_number: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      verification_status: {
        type: Sequelize.ENUM('PENDING', 'VERIFIED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('doctors', ['specialization', 'verification_status'], {
      name: 'doctors_search_idx',
    });

    await queryInterface.createTable('availability_slots', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      doctor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      starts_at: { type: Sequelize.DATE, allowNull: false },
      ends_at: { type: Sequelize.DATE, allowNull: false },
      status: {
        type: Sequelize.ENUM('OPEN', 'BOOKED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'OPEN',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.sequelize.query(
      'ALTER TABLE availability_slots ADD CONSTRAINT availability_slots_interval_chk CHECK (ends_at > starts_at)',
    );
    await queryInterface.addIndex('availability_slots', ['doctor_id', 'status', 'starts_at'], {
      name: 'slots_search_idx',
    });

    await queryInterface.createTable('consultations', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      slot_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'availability_slots', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      doctor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'BOOKED',
      },
      started_at: { type: Sequelize.DATE, allowNull: true },
      completed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('consultations', ['patient_id', 'created_at'], {
      name: 'consultations_patient_created_idx',
    });
    await queryInterface.addIndex('consultations', ['doctor_id', 'status', 'created_at'], {
      name: 'consultations_doctor_status_idx',
    });
    await queryInterface.addIndex('consultations', ['status', 'created_at'], {
      name: 'consultations_status_created_idx',
    });

    await queryInterface.createTable('slot_reservations', {
      slot_id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        references: { model: 'availability_slots', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      consultation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'consultations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('prescriptions', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      consultation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'consultations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      patient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      doctor_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'doctors', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      details_ciphertext: { type: Sequelize.TEXT, allowNull: false },
      details_iv: { type: Sequelize.STRING(32), allowNull: false },
      details_tag: { type: Sequelize.STRING(32), allowNull: false },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('payments', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      consultation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'consultations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      amount_minor: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      status: {
        type: Sequelize.ENUM('PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      provider_reference: { type: Sequelize.STRING(191), allowNull: true, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      actor_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      event_type: { type: Sequelize.STRING(80), allowNull: false },
      target_type: { type: Sequelize.STRING(80), allowNull: true },
      target_id: { type: Sequelize.STRING(64), allowNull: true },
      metadata: { type: Sequelize.JSON, allowNull: false },
      request_id: { type: Sequelize.STRING(64), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['event_type', 'created_at'], {
      name: 'audit_event_created_idx',
    });

    await queryInterface.createTable('outbox_events', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      event_type: { type: Sequelize.STRING(100), allowNull: false },
      aggregate_type: { type: Sequelize.STRING(80), allowNull: false },
      aggregate_id: { type: Sequelize.STRING(64), allowNull: false },
      payload: { type: Sequelize.JSON, allowNull: false },
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED'),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      attempts: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
      available_at: { type: Sequelize.DATE, allowNull: false },
      locked_at: { type: Sequelize.DATE, allowNull: true },
      last_error_code: { type: Sequelize.STRING(40), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('outbox_events', ['status', 'available_at'], {
      name: 'outbox_delivery_idx',
    });

    await queryInterface.createTable('idempotency_keys', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      key: { type: Sequelize.STRING(128), allowNull: false },
      request_hash: { type: Sequelize.STRING(64), allowNull: false },
      response_body: { type: Sequelize.JSON, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('idempotency_keys', ['user_id', 'key'], {
      unique: true,
      name: 'idempotency_user_key_uq',
    });
    await queryInterface.addIndex('idempotency_keys', ['expires_at'], {
      name: 'idempotency_expires_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('idempotency_keys');
    await queryInterface.dropTable('outbox_events');
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('payments');
    await queryInterface.dropTable('prescriptions');
    await queryInterface.dropTable('slot_reservations');
    await queryInterface.dropTable('consultations');
    await queryInterface.removeConstraint('availability_slots', 'availability_slots_interval_chk');
    await queryInterface.dropTable('availability_slots');
    await queryInterface.dropTable('doctors');
    await queryInterface.dropTable('profiles');
    await queryInterface.removeColumn('users', 'mfa_secret_tag');
    await queryInterface.removeColumn('users', 'mfa_secret_iv');
    await queryInterface.removeColumn('users', 'mfa_secret_ciphertext');
    await queryInterface.removeColumn('users', 'mfa_enabled');
  },
};