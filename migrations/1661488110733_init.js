const { PgLiteral } = require('node-pg-migrate');

exports.up = (pgm) => {
  // ----- ADD UUID EXTENSION
  pgm.createExtension('uuid-ossp', {
    ifNotExists: true,
  });
  // ----- CREATE TABLES

  // --- config
  // table with static/semi-static information and consists of 1 row per unique pool.
  // operations on this table: insert for new pools, update for existing pools
  pgm.createTable('config', {
    config_id: {
      type: 'uuid', // uuid is created in the application
      primaryKey: true,
    },
    pool: { type: 'text', notNull: true, unique: true },
    project: { type: 'text', notNull: true },
    chain: { type: 'text', notNull: true },
    symbol: { type: 'text', notNull: true },
    poolMeta: 'text',
    underlyingTokens: { type: 'text[]' },
    rewardTokens: { type: 'text[]' },
    url: { type: 'text', notNull: true },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // --- yield
  // our timeseries table. insert only on hourly granularity
  pgm.createTable('yield', {
    yield_id: {
      type: 'uuid',
      default: new PgLiteral('uuid_generate_v4()'),
      primaryKey: true,
    },
    // configID is a FK in this table and references the PK (config_id) in config
    configID: {
      type: 'uuid',
      notNull: true,
      references: '"config"',
    },
    timestamp: { type: 'timestamptz', notNull: true },
    tvlUsd: { type: 'bigint', notNull: true },
    apy: { type: 'numeric', notNull: true },
    apyBase: 'numeric',
    apyReward: 'numeric',
  });

  // --- stat
  // table which contains rolling statistics required to calculate ML features values
  // and other things we use for plotting on the /overview page
  pgm.createTable('stat', {
    stat_id: {
      type: 'uuid', // uuid is created in application and identical to config_id
      primaryKey: true,
    },
    count: { type: 'smallint', notNull: true },
    meanAPY: { type: 'numeric', notNull: true },
    mean2APY: 'numeric',
    meanDR: { type: 'numeric', notNull: true },
    mean2DR: 'numeric',
    productDR: { type: 'numeric', notNull: true },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // --- median
  // median table content is used for the median chart on /overview (append only)
  pgm.createTable('median', {
    median_id: {
      type: 'uuid',
      default: new PgLiteral('uuid_generate_v4()'),
      primaryKey: true,
    },
    uniquePools: { type: 'integer', notNull: true },
    medianAPY: { type: 'numeric', notNull: true },
    timestamp: { type: 'timestamptz', notNull: true, unique: true },
  });

  // --- enriched
  // contains extra columns calculated during enrichment process
  // (such as ML predictions, if a pool is a stablecoin position etc.)
  pgm.createTable('enriched', {
    enriched_id: {
      type: 'uuid', // uuid is created in application and identical to config_id
      primaryKey: true,
    },
    apyPct1D: 'numeric',
    apyPct7D: 'numeric',
    apyPct30D: 'numeric',
    stablecoin: { type: 'boolean', notNull: true },
    ilRisk: { type: 'text', notNull: true },
    exposure: { type: 'text', notNull: true },
    predictions: { type: 'jsonb', notNull: true },
    mu: { type: 'numeric', notNull: true },
    sigma: { type: 'numeric', notNull: true },
    count: { type: 'smallint', notNull: true },
    outlier: { type: 'boolean', notNull: true },
    return: { type: 'numeric', notNull: true },
    apyMeanExpanding: { type: 'numeric', notNull: true },
    apyStdExpanding: { type: 'numeric', notNull: true },
    chain_factorized: { type: 'smallint', notNull: true },
    project_factorized: { type: 'smallint', notNull: true },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });
  // FUNCTIONS
  pgm.createFunction(
    'update_updated_at',
    [], // no params
    // options
    {
      language: 'plpgsql',
      returns: 'TRIGGER',
      replace: true,
    },
    // function body
    `
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END
    `
  );
  // TRIGGERS;
  pgm.createTrigger('config', 'update_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at',
    level: 'ROW',
  });
  pgm.createTrigger('stat', 'update_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at',
    level: 'ROW',
  });
  pgm.createTrigger('enriched', 'update_updated_at', {
    when: 'BEFORE',
    operation: 'UPDATE',
    function: 'update_updated_at',
    level: 'ROW',
  });
};