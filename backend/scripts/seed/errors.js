class SeedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SeedError";
    this.details = details;
  }
}

class ValidationError extends SeedError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = "ValidationError";
  }
}

class ImportError extends SeedError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = "ImportError";
  }
}

class StatsRebuildError extends SeedError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = "StatsRebuildError";
  }
}

module.exports = {
  SeedError,
  ValidationError,
  ImportError,
  StatsRebuildError,
};
