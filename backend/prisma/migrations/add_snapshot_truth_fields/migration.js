// @prisma/generator-version 6.19.3
// This file is auto-generated. Do not edit.

const migration = {
  version: "5.0",
  name: "add_snapshot_truth_fields",
  inTransactions: true,
  steps: [
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "scanId",
      type: "TEXT",
      nullable: true,
    },
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "evidenceIds",
      type: "JSONB",
      nullable: true,
      default: "'[]'",
    },
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "providerVersion",
      type: "TEXT",
      nullable: true,
    },
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "engineVersion",
      type: "TEXT",
      nullable: true,
    },
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "responseHash",
      type: "TEXT",
      nullable: true,
    },
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "sourceType",
      type: "TEXT",
      nullable: true,
      default: "'unknown'",
    },
    {
      tag: "AlterTableAddColumn",
      table: "kmki_geo_score_snapshots",
      column: "scoreVersion",
      type: "TEXT",
      nullable: true,
    },
  ],
};

module.exports = { migration };
