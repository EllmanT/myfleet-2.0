const formatContext = (context = {}) => {
  const pairs = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
  return pairs.length ? ` ${pairs.join(" ")}` : "";
};

const write = (level, message, context = {}) => {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}${formatContext(context)}`;
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  console.log(line);
};

const logger = {
  info: (message, context) => write("INFO", message, context),
  warn: (message, context) => write("WARN", message, context),
  error: (message, context) => write("ERROR", message, context),
  stepStart: (step, context) => write("INFO", `START ${step}`, context),
  stepEnd: (step, context) => write("INFO", `DONE ${step}`, context),
};

const timedStep = async (step, fn, context = {}) => {
  logger.stepStart(step, context);
  const start = Date.now();
  try {
    const result = await fn();
    logger.stepEnd(step, { ...context, durationMs: Date.now() - start });
    return result;
  } catch (error) {
    logger.error(`FAILED ${step}`, {
      ...context,
      durationMs: Date.now() - start,
      errorName: error.name,
      errorMessage: error.message,
      details: error.details,
    });
    throw error;
  }
};

module.exports = {
  logger,
  timedStep,
};
