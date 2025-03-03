const winston = require("winston");
const { createLogger, format, transports } = winston;
const { combine, timestamp, json } = format;

const logger = createLogger({
  level: "info",
  format: combine(timestamp(), json()),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "server.log" }),
  ],
});

// Stream for morgan to write logs to winston
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;